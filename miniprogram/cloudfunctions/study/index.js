// 背单词:overview 场景首页数据 / words 某场景词表 / start 开一组 / grade 记一次打分
// 复习间隔(盒子法):0 / 1 / 2 / 4 / 7 / 15 / 30 天;日期按北京时间算
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const INTERVALS = [0, 1, 2, 4, 7, 15, 30]
const NEW_PER_GROUP = 10
const REVIEW_PER_GROUP = 30
const day = (offset = 0) => new Date(Date.now() + 8 * 3600e3 + offset * 86400e3).toISOString().slice(0, 10)

async function all(query) {
  const out = []
  for (let skip = 0; ; skip += 1000) {
    const { data } = await query.skip(skip).limit(1000).get()
    out.push(...data)
    if (data.length < 1000) return out
  }
}

// 某场景有已审核的词就只用已审核的;一个都没有时先用草稿(方便老师审核前试用)
function usable(words) {
  const ok = words.filter(w => w.status === 'approved')
  return ok.length ? { list: ok, draft: false } : { list: words, draft: words.length > 0 }
}

async function load(openid) {
  const [scenes, words, progress] = await Promise.all([
    all(db.collection('scenes').where({ published: true }).orderBy('order', 'asc')),
    all(db.collection('words').orderBy('order', 'asc')),
    all(db.collection('progress').where({ _openid: openid }))
  ])
  return { scenes, words, progress, pmap: Object.fromEntries(progress.map(p => [p.wordId, p])) }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const today = day()

  if (event.action === 'overview') {
    const { scenes, words, progress, pmap } = await load(OPENID)
    const list = scenes.map(s => {
      const { list: ws, draft } = usable(words.filter(w => w.sceneId === s._id))
      return { ...s, total: ws.length, learned: ws.filter(w => pmap[w._id]).length, due: ws.filter(w => pmap[w._id] && pmap[w._id].box < 6 && pmap[w._id].due <= today).length, draft }
    })
    const learnedToday = progress.filter(p => p.firstAt === today).length
    return { scenes: list, dueTotal: list.reduce((n, s) => n + s.due, 0), learnedTotal: progress.length, learnedToday }
  }

  if (event.action === 'words') {
    const { scenes, words, pmap } = await load(OPENID)
    const scene = scenes.find(s => s._id === event.sceneId)
    if (!scene) return { error: '场景不存在或已下架' }
    const { list, draft } = usable(words.filter(w => w.sceneId === scene._id))
    return { scene, draft, words: list.map(w => ({ ...w, learned: !!pmap[w._id] })) }
  }

  if (event.action === 'start') {
    const { scenes, words, pmap } = await load(OPENID)
    const pub = new Set(scenes.map(s => s._id))
    let pool = []
    for (const s of scenes) pool.push(...usable(words.filter(w => w.sceneId === s._id)).list)
    if (event.sceneId) pool = pool.filter(w => w.sceneId === event.sceneId)
    pool = pool.filter(w => pub.has(w.sceneId))
    const due = pool.filter(w => pmap[w._id] && pmap[w._id].box < 6 && pmap[w._id].due <= today).slice(0, REVIEW_PER_GROUP)
    const fresh = event.reviewOnly ? [] : pool.filter(w => !pmap[w._id]).slice(0, NEW_PER_GROUP)
    return { items: [...due.map(w => ({ ...w, mode: 'review' })), ...fresh.map(w => ({ ...w, mode: 'new' }))] }
  }

  if (event.action === 'grade') {
    // result: know 认识 / vague 模糊 / forgot 不认识 / mastered 设为已掌握
    const col = db.collection('progress')
    const { data } = await col.where({ _openid: OPENID, wordId: event.wordId }).limit(1).get()
    const p = data[0] || { box: 0, wrong: 0 }
    let box = p.box
    if (event.result === 'mastered') box = 6
    else if (event.result === 'know') box = Math.min(box + 1, 6)
    else if (event.result === 'forgot') box = 0
    const due = event.result === 'forgot' ? today : day(Math.max(INTERVALS[box], 1))
    const patch = { box, due, wrong: p.wrong + (event.result === 'forgot' ? 1 : 0), lastAt: db.serverDate(), sceneId: event.sceneId || p.sceneId || '' }
    if (data[0]) await col.doc(data[0]._id).update({ data: patch })
    else await col.add({ data: { ...patch, _openid: OPENID, wordId: event.wordId, firstAt: today } })
    return { ok: true, box, due }
  }

  return { error: '未知操作' }
}
