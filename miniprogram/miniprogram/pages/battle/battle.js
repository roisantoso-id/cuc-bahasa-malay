const setTab = require('../../utils/tab')
// 对战：本周擂台倒计时、进入擂台、好友 PK、周榜（只看第一名和我的邻居）、最近的 PK
const vocab = require('../../api/vocab')

const day = iso => (iso ? `${Number(iso.slice(5, 7))}月${Number(iso.slice(8, 10))}日` : '')
// 犀鸟头像：按用户编号固定选一只（以后接入微信头像后换成真头像）
const POSES = ['avatar', 'study', 'cheer', 'pass', 'welcome', 'checkin']
const av = id => `/assets/${POSES[Math.abs(Number(id) || 0) % POSES.length]}.jpg`
const TABS = [{ k: 'all', t: '全站' }, { k: 'school', t: '本校' }, { k: 'class', t: '本班' }, { k: 'schools', t: '学校榜' }]

// 到下周一 00:00（北京时间）还有多久
function countdown() {
  const bj = new Date(Date.now() + 8 * 3600e3)           // 用 UTC 字段读北京时间
  const dow = (bj.getUTCDay() + 6) % 7                    // 周一 = 0
  const next = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate() + (7 - dow))
  const left = Math.max(0, next - bj.getTime())
  const d = Math.floor(left / 86400e3), h = Math.floor(left % 86400e3 / 3600e3), m = Math.floor(left % 3600e3 / 60e3)
  const jan1 = Date.UTC(bj.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((bj.getTime() - jan1) / 86400e3 + new Date(jan1).getUTCDay() + 1) / 7)
  return { d, h, m, week }
}

// 只留第一名和我上下各两名
function nearby(list) {
  const i = list.findIndex(x => x.me)
  const rows = []
  const push = (x, gap) => rows.push({ ...x, gap: !!gap })
  if (i < 0) { list.slice(0, 5).forEach(x => push(x)); return { rows, chase: '' } }
  if (list.length) push(list[0])
  const lo = Math.max(1, i - 2), hi = Math.min(list.length - 1, i + 2)
  for (let k = lo; k <= hi; k++) push(list[k], k === lo && lo > 1)
  const chase = i > 0 ? `差 ${Math.max(1, list[i - 1].points - list[i].points)} 分追上 ${list[i - 1].name}` : '你是第一名'
  return { rows, chase }
}

Page({
  data: { view: 'loading', error: '', levels: [], level: 0, arena: null, me: null, pks: [], busy: false, showPk: false, tabs: TABS, tab: 'all', podium: [], board: [], boardLoading: false, boardNote: '', chase: '', cd: { d: 0, h: 0, m: 0, week: 0 } },
  onShow() {
    setTab(this, 2); this.tick(); this.timer = setInterval(() => this.tick(), 30000); this.load() },
  onHide() { clearInterval(this.timer) },
  onUnload() { clearInterval(this.timer) },
  tick() { this.setData({ cd: countdown() }) },
  async onPullDownRefresh() { await this.load(); wx.stopPullDownRefresh() },
  async load() {
    if (this.loading) return
    this.loading = true
    try {
      const [h, arena, mine] = await Promise.all([
        vocab.home(),
        vocab.arena().catch(() => null),
        vocab.pkMine().catch(() => [])
      ])
      const levels = (h.levels || []).filter(l => l.open).map(l => ({ level: l.level, city: l.city }))
      let level = this.data.level
      if (!levels.some(l => l.level === level)) level = levels.some(l => l.level === h.level) ? h.level : (levels[0] ? levels[0].level : 0)
      const pks = (Array.isArray(mine) ? mine : (mine && mine.list) || []).map(p => ({ ...p, date: day(p.createdAt) })).slice(0, 5)
      const tries = arena ? Math.max(0, Math.min(3, arena.triesLeft)) : 3
      const levelIdx = Math.max(0, levels.findIndex(l => l.level === level))
      this.setData({ view: 'ok', levels, level, levelIdx, levelNames: levels.map(l => '第' + l.level + '站'), arena, pks, tries: [0, 1, 2].map(i => i < tries) })
      this.board()
    } catch (e) {
      if (this.data.view !== 'ok') this.setData({ view: 'error', error: e.message })
      else wx.showToast({ title: e.message, icon: 'none' })
    }
    this.loading = false
  },
  async board() {
    const tab = this.data.tab
    this.seq = (this.seq || 0) + 1
    const seq = this.seq
    this.setData({ boardLoading: true })
    try {
      const r = tab === 'schools' ? await vocab.schools() : await vocab.rank(tab)
      if (seq !== this.seq) return
      if (r.needProfile) return this.setData({ board: [], chase: '', boardLoading: false, boardNote: `完善资料，填上学校${tab === 'class' ? '和班级' : ''}才能看` })
      const school = tab === 'schools'
      const list = (r.list || []).map(x => school
        ? { place: x.place, name: x.school, sub: x.members + ' 人在学', points: x.points, me: !!x.mine, mark: (x.school || '?').slice(0, 1) }
        : { place: x.place, name: x.name, sub: x.school || '', points: x.points, me: !!x.me, av: av(x.aid) })
      const { rows, chase } = nearby(list)
      // 前三名上领奖台（显示顺序 2-1-3），下面只列第 4 名以后、我附近的几行
      const podium = list.length >= 3 ? [list[1], list[0], list[2]] : list.slice(0, 2).reverse()
      const me = r.me ? { ...r.me, av: av(r.me.aid) } : null
      this.setData({ podium, board: rows.filter(x => x.place > 3), chase: school ? '' : chase, boardLoading: false, boardNote: list.length ? '' : '本周还没有人上榜，学几个词就能上榜', me })
    } catch (e) {
      if (seq === this.seq) this.setData({ board: [], boardLoading: false, boardNote: e.message })
    }
  },
  pickTab(e) {
    const k = e.currentTarget.dataset.k
    if (k === this.data.tab) return
    this.setData({ tab: k })
    this.board()
  },
  togglePk() { this.setData({ showPk: !this.data.showPk }) },
  pickLevel(e) { this.setData({ level: e.currentTarget.dataset.l }) },
  pickLevelIdx(e) { const i = Number(e.detail.value); this.setData({ levelIdx: i, level: this.data.levels[i].level }) },
  async create() {
    if (this.data.busy || !this.data.level) return
    this.setData({ busy: true })
    try {
      const { id } = await vocab.pkCreate(this.data.level)
      wx.navigateTo({ url: `/pkg-battle/play/play?kind=pk&id=${id}` })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    }
    this.setData({ busy: false })
  },
  arena() { wx.navigateTo({ url: '/pkg-battle/arena/arena' }) },
  rank() { wx.navigateTo({ url: '/pkg-battle/rank/rank?tab=' + this.data.tab }) },
  open(e) { wx.navigateTo({ url: `/pkg-battle/pk/pk?id=${e.currentTarget.dataset.id}` }) },
  onShareAppMessage() { return { title: '一起背马来语单词，来比一比', path: '/pages/home/home' } }
})
