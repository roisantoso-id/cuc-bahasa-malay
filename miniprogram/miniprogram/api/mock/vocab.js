// 演示模式:和云函数 login / register / study 返回结构一致,数据存在手机本地
const SEED = require('../../data/vocab-seed')

const INTERVALS = [0, 1, 2, 4, 7, 15, 30]
const day = (offset = 0) => new Date(Date.now() + 8 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10)
const get = (k, d) => { const v = wx.getStorageSync(k); return v === '' || v === undefined ? d : v }
const set = (k, v) => wx.setStorageSync(k, v)
const usable = ws => { const ok = ws.filter(w => w.status === 'approved'); return ok.length ? { list: ok, draft: false } : { list: ws, draft: ws.length > 0 } }

function study(e) {
  const today = day()
  const pmap = get('vocab_progress', {})
  const scenes = SEED.scenes.filter(s => s.published).sort((a, b) => a.order - b.order)
  const wordsOf = id => usable(SEED.words.filter(w => w.sceneId === id).sort((a, b) => a.order - b.order))
  const isDue = w => pmap[w._id] && pmap[w._id].box < 6 && pmap[w._id].due <= today
  if (e.action === 'overview') {
    const list = scenes.map(s => { const { list: ws, draft } = wordsOf(s._id); return { ...s, total: ws.length, learned: ws.filter(w => pmap[w._id]).length, due: ws.filter(isDue).length, draft } })
    const ps = Object.values(pmap)
    return { scenes: list, dueTotal: list.reduce((n, s) => n + s.due, 0), learnedTotal: ps.length, learnedToday: ps.filter(p => p.firstAt === today).length }
  }
  if (e.action === 'words') {
    const scene = scenes.find(s => s._id === e.sceneId)
    if (!scene) return { error: '场景不存在或已下架' }
    const { list, draft } = wordsOf(scene._id)
    return { scene, draft, words: list.map(w => ({ ...w, learned: !!pmap[w._id] })) }
  }
  if (e.action === 'start') {
    let pool = scenes.flatMap(s => wordsOf(s._id).list)
    if (e.sceneId) pool = pool.filter(w => w.sceneId === e.sceneId)
    const due = pool.filter(isDue).slice(0, 30)
    const fresh = e.reviewOnly ? [] : pool.filter(w => !pmap[w._id]).slice(0, 10)
    return { items: [...due.map(w => ({ ...w, mode: 'review' })), ...fresh.map(w => ({ ...w, mode: 'new' }))] }
  }
  if (e.action === 'grade') {
    const p = pmap[e.wordId] || { box: 0, wrong: 0, firstAt: today }
    let box = p.box
    if (e.result === 'mastered') box = 6
    else if (e.result === 'know') box = Math.min(box + 1, 6)
    else if (e.result === 'forgot') box = 0
    pmap[e.wordId] = { ...p, box, due: e.result === 'forgot' ? today : day(Math.max(INTERVALS[box], 1)), wrong: p.wrong + (e.result === 'forgot' ? 1 : 0), sceneId: e.sceneId }
    set('vocab_progress', pmap)
    return { ok: true, box, due: pmap[e.wordId].due }
  }
  return { error: '未知操作' }
}

async function call(name, data) {
  await new Promise(r => setTimeout(r, 80))
  if (name === 'login') return { openid: 'demo-openid', student: get('vocab_student', null) }
  if (name === 'register') {
    if (!String(data.name || '').trim()) return { ok: false, error: '请填写姓名或昵称' }
    if (!String(data.school || '').trim()) return { ok: false, error: '请填写学校' }
    if (!/^1\d{10}$|^\+?\d{8,15}$/.test(String(data.phone || '').replace(/[\s-]/g, ''))) return { ok: false, error: '手机号格式不对' }
    if (!data.agree) return { ok: false, error: '请先阅读并同意隐私保护指引' }
    const { agree, ...rest } = data
    const s = { ...rest, _openid: 'demo-openid', createdAt: new Date().toISOString() }
    set('vocab_student', s)
    return { ok: true, student: s }
  }
  if (name === 'study') {
    const r = study(data)
    if (r.error) throw new Error(r.error)
    return r
  }
  throw new Error('未知云函数 ' + name)
}

const teachers = async () => [
  { _id: 't1', name: '张静灵', title: '副教授 · 中国传媒大学马来语专业教师', role: '课程主持', photo: '/pkg-me/img/zhang.jpg', bio: '长期从事马来语教学与马来世界文化研究。出版专著《同源异流》、马来文专著 Warisan Kebudayaan Minangkabau，译著《马来西亚诗选》；参与编撰《马来语报刊选读》《新经典马来文学史教程》《马来语写作教程》。', order: 1 },
  { _id: 't2', name: '杨启航', title: '中国传媒大学马来语专业本科生', role: '团队成员', photo: '/pkg-me/img/yang.jpg', bio: '获国家留学基金管理委员会资助赴马来西亚理科大学交流学习，曾受邀参加马来西亚国家广播电视台《早安马来西亚》直播访谈。', order: 2 }
]

module.exports = { call, teachers }
