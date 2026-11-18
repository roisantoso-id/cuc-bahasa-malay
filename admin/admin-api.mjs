// 后台接口 /api/admin/*:账号密码登录、角色权限、学生、单词、课程(10 站)、老师、后台账号、操作日志
// server.mjs 把数据库和通用函数传进来(makeAdminApi(ctx)),这里不直接连库
import { randomBytes, createHash } from 'node:crypto'

// ---------------- 权限目录 ----------------
// 每个接口要一项权限;超级管理员的角色是 ['*'],什么都能做,不能改
export const PERMISSIONS = [
  { group: '概览', items: [['overview.view', '查看概览']] },
  { group: '学生', items: [['students.view', '查看学生和学习情况'], ['students.edit', '修改学生资料、停用账号'], ['students.export', '导出学生 CSV']] },
  { group: '单词', items: [['words.view', '查看词库'], ['words.edit', '修改和新增单词'], ['words.publish', '上架 / 下架'], ['words.import', '导入词库']] },
  { group: '课程', items: [['courses.view', '查看课程(10 站)'], ['courses.edit', '修改课程、开放 / 关闭']] },
  { group: '老师', items: [['teachers.view', '查看老师介绍'], ['teachers.edit', '修改老师介绍和照片']] },
  { group: '系统', items: [['users.view', '查看后台账号'], ['users.manage', '新建、停用后台账号,重置密码'], ['roles.manage', '管理角色和权限'], ['audit.view', '查看操作日志']] }
]
const ALL_PERMS = PERMISSIONS.flatMap(g => g.items.map(i => i[0]))
export const BUILTIN_ROLES = [
  { code: 'super_admin', name: '超级管理员', description: '所有权限,能管理账号和角色', permissions: ['*'] },
  { code: 'editor', name: '内容编辑', description: '维护词库、课程和老师介绍', permissions: ['overview.view', 'words.view', 'words.edit', 'words.publish', 'words.import', 'courses.view', 'courses.edit', 'teachers.view', 'teachers.edit'] },
  { code: 'teacher', name: '任课老师', description: '看学生学习情况、导出名单,看词库', permissions: ['overview.view', 'students.view', 'students.export', 'words.view', 'courses.view', 'teachers.view'] },
  { code: 'viewer', name: '只读', description: '只能看,不能改', permissions: ['overview.view', 'students.view', 'words.view', 'courses.view', 'teachers.view'] }
]

// 登录保持 10 天;每次用后台都往后顺延(滑动过期),10 天里一直有在用就不用重新输密码
const SESSION_MS = 10 * 86400e3
const RENEW_AFTER = 3600e3 // 离上次顺延超过 1 小时才写一次库,免得每个请求都写
const sha = s => createHash('sha256').update(String(s)).digest('hex')
const now = () => new Date().toISOString()

export function makeAdminApi(ctx) {
  const { all, one, run, tx, body, send, fail, str, ip, cookie, day, csvCell, importWords, cleanSense, savePhoto, levelsOf, streakOf, reloadStops, hashPassword, checkPassword, AUDIO_BASE, DEMO } = ctx
  const ipFails = new Map(), userFails = new Map()
  const recent = (m, k, ms) => { const t = (m.get(k) || []).filter(x => x > Date.now() - ms); m.set(k, t); return t }

  const parsePerms = r => { try { return JSON.parse(r.permissions || '[]') } catch { return [] } }
  const can = (s, perm) => s.perms.includes('*') || s.perms.includes(perm)
  const deny = () => Object.assign(new Error('没有权限做这件事'), { code: 403 })
  const bad = msg => Object.assign(new Error(msg), { code: 400 })
  const need = (s, ...perms) => { if (!perms.some(p => can(s, p))) throw deny() }
  const isSuper = s => s.perms.includes('*')

  async function audit(s, req, action, target = '', detail = '') {
    await run('INSERT INTO audit_log (at, user_id, username, action, target, detail, ip) VALUES (?, ?, ?, ?, ?, ?, ?)',
      now(), s ? s.id : null, s ? s.username : '', action, str(target, 120), typeof detail === 'string' ? str(detail, 2000) : JSON.stringify(detail).slice(0, 2000), ip(req))
  }

  // 第一次启动:建 4 个内置角色;库里没有后台账号时,用 .env 的 ADMIN_USER / ADMIN_PASSWORD_HASH 建超级管理员(演示模式 admin / admin123)
  async function bootstrap({ ADMIN_USER, ADMIN_HASH }) {
    for (const r of BUILTIN_ROLES) {
      await run('INSERT IGNORE INTO admin_roles (code, name, description, permissions, builtin, created_at) VALUES (?, ?, ?, ?, 1, ?)', r.code, r.name, r.description, JSON.stringify(r.permissions), now())
    }
    if (!(await one('SELECT 1 FROM admin_users LIMIT 1'))) {
      if (!ADMIN_HASH) { console.warn('⚠ 还没有后台账号:在 .env 填 ADMIN_PASSWORD_HASH 后重启,会自动建超级管理员'); return }
      const role = await one(`SELECT id FROM admin_roles WHERE code = 'super_admin'`)
      await run('INSERT INTO admin_users (username, name, password_hash, role_id, status, must_change, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)', ADMIN_USER, '管理员', ADMIN_HASH, role.id, 'active', now(), now())
      console.log(`已建超级管理员 ${ADMIN_USER}`)
    }
  }

  const cookieFor = (req, token) => `jb_admin=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`
  async function session(req) {
    const t = cookie(req, 'jb_admin')
    if (!t) return null
    const r = await one(`SELECT s.expires_at, u.id, u.username, u.name, u.status, u.must_change, r.code role_code, r.name role_name, r.permissions
      FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id LEFT JOIN admin_roles r ON r.id = u.role_id WHERE s.token_hash = ?`, sha(t))
    if (!r || r.expires_at < Date.now() || r.status !== 'active') return null
    // 要顺延就带上新 cookie(每个请求自己的,不能放共享变量里)
    let renew = ''
    if (r.expires_at < Date.now() + SESSION_MS - RENEW_AFTER) {
      await run('UPDATE admin_sessions SET expires_at = ? WHERE token_hash = ?', Date.now() + SESSION_MS, sha(t))
      renew = cookieFor(req, t)
    }
    return { renew, id: r.id, username: r.username, name: r.name, mustChange: !!r.must_change, role: { code: r.role_code, name: r.role_name }, perms: parsePerms(r), token: t }
  }
  const killSessions = uid => run('DELETE FROM admin_sessions WHERE user_id = ?', uid)
  const validPassword = pw => { if (String(pw || '').length < 8) throw bad('密码至少 8 位'); if (String(pw).length > 128) throw bad('密码太长') }

  // 角色里不能出现自己没有的权限(防止给自己升权)
  function checkGrant(s, perms) {
    if (isSuper(s)) return
    if (perms.includes('*') || perms.some(p => !can(s, p))) throw Object.assign(new Error('不能授予自己没有的权限'), { code: 403 })
  }
  const cleanPerms = list => [...new Set((Array.isArray(list) ? list : []).filter(p => ALL_PERMS.includes(p)))]

  function page(url, def = 20) {
    const size = Math.min(Math.max(Number(url.searchParams.get('size')) || def, 1), 200)
    const p = Math.max(Number(url.searchParams.get('page')) || 1, 1)
    return { size, page: p, offset: (p - 1) * size }
  }

  const userOut = u => ({ id: u.id, username: u.username, name: u.name, status: u.status, mustChange: !!u.must_change, roleId: u.role_id, roleCode: u.role_code, roleName: u.role_name, lastLoginAt: u.last_login_at, lastLoginIp: u.last_login_ip, createdAt: u.created_at })
  const USER_SQL = 'SELECT u.*, r.code role_code, r.name role_name FROM admin_users u LEFT JOIN admin_roles r ON r.id = u.role_id'
  async function superCount(exceptId = 0) {
    return (await one(`SELECT COUNT(*) n FROM admin_users u JOIN admin_roles r ON r.id = u.role_id WHERE r.code = 'super_admin' AND u.status = 'active' AND u.id <> ?`, exceptId)).n
  }

  function wordAdminOut(w) {
    let extra = {}
    try { extra = JSON.parse(w.extra || '{}') || {} } catch {}
    return { rank: w.rank, ms: w.ms, root: w.root, level: w.level, topic: w.topic || '', senses: JSON.parse(w.senses || '[]'), audio: w.audio, audioUrl: w.audio ? AUDIO_BASE + w.audio : '', status: w.status, edited: !!w.edited, updatedAt: w.updated_at, extra }
  }
  const listOf = (v, n = 20, max = 80) => (Array.isArray(v) ? v : String(v || '').split(/[,，;；\n]/)).map(x => str(x, max)).filter(Boolean).slice(0, n)
  const cleanExtra = e => ({
    ex: (Array.isArray(e.ex) ? e.ex : []).map(x => ({ ms: str(x.ms, 400), zh: str(x.zh, 400) })).filter(x => x.ms).slice(0, 10),
    col: listOf(e.col), fam: listOf(e.fam), syn: listOf(e.syn), ant: listOf(e.ant),
    tip: str(e.tip, 500), note: str(e.note, 500), image: str(e.image, 300)
  })
  const cleanSenseFull = s => { const o = cleanSense(s); const en = str(s.en, 200); if (en) o.en = en; return o }

  // 本页面以外来的写请求一律拒绝(防 CSRF):Origin 和 Host 对不上就 403
  function sameOrigin(req) {
    const o = req.headers.origin
    if (!o) return true
    try { return new URL(o).host === (req.headers['x-forwarded-host'] || req.headers.host) } catch { return false }
  }

  return { bootstrap, async handle(req, res, p, url) {
    if (req.method !== 'GET' && !sameOrigin(req)) return fail(res, 403, '来源不对')

    if (p === '/api/admin/login' && req.method === 'POST') {
      const addr = ip(req)
      const b = await body(req)
      const username = str(b.username ?? b.user, 40).toLowerCase()
      if (recent(ipFails, addr, 10 * 60e3).length >= 5 || recent(userFails, username, 30 * 60e3).length >= 10) return fail(res, 429, '登录失败次数太多,请过一会儿再试')
      const u = username && await one(`${USER_SQL} WHERE u.username = ?`, username)
      if (!u || !checkPassword(b.password, u.password_hash)) {
        ipFails.get(addr).push(Date.now()); userFails.get(username)?.push(Date.now())
        if (u) await audit({ id: u.id, username: u.username }, req, 'login.fail', u.username)
        return fail(res, 401, '账号或密码不对')
      }
      if (u.status !== 'active') return fail(res, 403, '这个账号已停用,请联系管理员')
      const token = randomBytes(32).toString('hex')
      await run('DELETE FROM admin_sessions WHERE expires_at < ?', Date.now())
      await run('INSERT INTO admin_sessions (token_hash, user_id, created_at, expires_at, ip, ua) VALUES (?, ?, ?, ?, ?, ?)', sha(token), u.id, now(), Date.now() + SESSION_MS, addr, str(req.headers['user-agent'], 200))
      await run('UPDATE admin_users SET last_login_at = ?, last_login_ip = ? WHERE id = ?', now(), addr, u.id)
      await audit({ id: u.id, username: u.username }, req, 'login', u.username)
      return send(res, 200, { ok: true }, { 'set-cookie': cookieFor(req, token) })
    }

    const s = await session(req)
    if (!s) return fail(res, 401, '请先登录')
    if (s.renew) res.setHeader('set-cookie', s.renew)
    if (p === '/api/admin/logout') {
      await run('DELETE FROM admin_sessions WHERE token_hash = ?', sha(s.token))
      return send(res, 200, { ok: true }, { 'set-cookie': 'jb_admin=; Path=/; Max-Age=0' })
    }
    if (p === '/api/admin/me') {
      const perms = isSuper(s) ? ALL_PERMS : s.perms
      return send(res, 200, { user: { id: s.id, username: s.username, name: s.name, role: s.role }, permissions: perms, mustChange: s.mustChange, demo: DEMO, audioBase: AUDIO_BASE })
    }
    if (p === '/api/admin/me/password' && req.method === 'POST') {
      const b = await body(req)
      const u = await one('SELECT * FROM admin_users WHERE id = ?', s.id)
      if (!checkPassword(b.old, u.password_hash)) return fail(res, 400, '原密码不对')
      validPassword(b.password)
      if (b.password === b.old) return fail(res, 400, '新密码不能和原密码一样')
      await run('UPDATE admin_users SET password_hash = ?, must_change = 0, updated_at = ? WHERE id = ?', hashPassword(b.password), now(), s.id)
      await run('DELETE FROM admin_sessions WHERE user_id = ? AND token_hash <> ?', s.id, sha(s.token)) // 其它设备下线
      await audit(s, req, 'me.password', s.username)
      return send(res, 200, { ok: true })
    }
    if (p === '/api/admin/me/sessions') {
      const rows = await all('SELECT token_hash, created_at, expires_at, ip, ua FROM admin_sessions WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC', s.id, Date.now())
      return send(res, 200, rows.map(r => ({ current: r.token_hash === sha(s.token), createdAt: r.created_at, ip: r.ip, ua: r.ua })))
    }
    // 要求先改初始密码:除了上面几个接口,别的都不让用
    if (s.mustChange) return fail(res, 403, '请先修改初始密码')

    // ---------- 概览 ----------
    if (p === '/api/admin/overview') {
      need(s, 'overview.view')
      const today = day(), from = day(-13)
      const daily = await all('SELECT day, COUNT(DISTINCT student_id) active, SUM(new_cnt) learned, SUM(review_cnt) reviewed FROM daily WHERE day >= ? AND (new_cnt + review_cnt) > 0 GROUP BY day', from)
      const signups = await all('SELECT LEFT(created_at, 10) d, COUNT(*) n FROM students WHERE created_at >= ? GROUP BY d', from)
      const byDay = Object.fromEntries(daily.map(r => [r.day, r])), su = Object.fromEntries(signups.map(r => [r.d, r.n]))
      const trend = Array.from({ length: 14 }, (_, i) => { const d = day(i - 13); const r = byDay[d] || {}; return { day: d, active: Number(r.active || 0), learned: Number(r.learned || 0), reviewed: Number(r.reviewed || 0), signups: Number(su[d] || 0) } })
      const words = await all('SELECT level, status, COUNT(*) n FROM words GROUP BY level, status')
      const courses = await all('SELECT level, city, ms, published FROM courses ORDER BY level')
      const out = {
        students: (await one('SELECT COUNT(*) n FROM students')).n,
        newStudents7: (await one('SELECT COUNT(*) n FROM students WHERE created_at >= ?', day(-6))).n,
        activeToday: (await one('SELECT COUNT(DISTINCT student_id) n FROM daily WHERE day = ? AND (new_cnt + review_cnt) > 0', today)).n,
        active7: (await one('SELECT COUNT(DISTINCT student_id) n FROM daily WHERE day >= ? AND (new_cnt + review_cnt) > 0', day(-6))).n,
        learnedToday: (await one('SELECT COALESCE(SUM(new_cnt), 0) n FROM daily WHERE day = ?', today)).n,
        reviewedToday: (await one('SELECT COALESCE(SUM(review_cnt), 0) n FROM daily WHERE day = ?', today)).n,
        check: (await one(`SELECT COUNT(*) n FROM words WHERE senses LIKE '%"check":true%'`)).n,
        trend, words, courses
      }
      if (can(s, 'audit.view')) out.recent = await all('SELECT id, at, username, action, target FROM audit_log ORDER BY id DESC LIMIT 8')
      if (can(s, 'students.view')) out.topStudents = await all(`SELECT s.id, s.name, s.school, SUM(d.new_cnt) learned, SUM(d.review_cnt) reviewed FROM daily d JOIN students s ON s.id = d.student_id WHERE d.day >= ? GROUP BY s.id, s.name, s.school ORDER BY learned DESC LIMIT 6`, day(-6))
      return send(res, 200, out)
    }

    // ---------- 学生 ----------
    if (p === '/api/admin/students' || p === '/api/admin/students.csv') {
      need(s, p.endsWith('.csv') ? 'students.export' : 'students.view')
      const q = str(url.searchParams.get('q'), 40).replace(/[%_]/g, ''), status = url.searchParams.get('status') || '', active = url.searchParams.get('active') || '', track = url.searchParams.get('track') || ''
      const conds = [], args = []
      if (q) { const l = `%${q}%`; conds.push('(s.name LIKE ? OR s.school LIKE ? OR s.class_name LIKE ? OR s.phone LIKE ?)'); args.push(l, l, l, l) }
      if (['active', 'disabled'].includes(status)) { conds.push('s.status = ?'); args.push(status) }
      if (['zero', 'some'].includes(track)) { conds.push('s.track = ?'); args.push(track) }
      if (active === '7d') { conds.push('s.last_active_at >= ?'); args.push(day(-6)) }
      if (active === 'idle') { conds.push('(s.last_active_at < ? OR s.last_active_at IS NULL)'); args.push(day(-13)) }
      const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''
      const SQL = `SELECT s.*, (SELECT COUNT(*) FROM progress p WHERE p.student_id = s.id AND p.seen > 0) learned, (SELECT COUNT(*) FROM progress p WHERE p.student_id = s.id AND p.box = 6) mastered,
        (SELECT COUNT(*) FROM daily d WHERE d.student_id = s.id AND (d.new_cnt + d.review_cnt) > 0) days FROM students s ${where} ORDER BY s.last_active_at DESC, s.id DESC`
      if (p.endsWith('.csv')) {
        const rows = await all(SQL, ...args)
        await audit(s, req, 'students.export', `${rows.length} 人`)
        const head = ['姓名', '学校', '班级', '起点', '手机号', '状态', '已学', '已掌握', '学习天数', '注册时间', '最近活跃']
        const lines = rows.map(r => [r.name, r.school, r.class_name, r.track === 'some' ? '会说一些' : '零基础', r.phone, r.status === 'disabled' ? '已停用' : '正常', r.learned, r.mastered, r.days, r.created_at, r.last_active_at].map(csvCell).join(','))
        res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="students-${day()}.csv"`, 'cache-control': 'no-store' })
        return res.end('﻿' + [head.join(','), ...lines].join('\n'))
      }
      const pg = page(url)
      const total = (await one(`SELECT COUNT(*) n FROM students s ${where}`, ...args)).n
      const rows = await all(`${SQL} LIMIT ? OFFSET ?`, ...args, pg.size, pg.offset)
      const counts = await one(`SELECT COUNT(*) total, SUM(status = 'disabled') disabled, SUM(last_active_at >= ?) active7, SUM(last_active_at < ? OR last_active_at IS NULL) idle, SUM(track = 'some') some FROM students`, day(-6), day(-13))
      return send(res, 200, { total, page: pg.page, size: pg.size, counts, rows: rows.map(r => ({ id: r.id, name: r.name, school: r.school, className: r.class_name, track: r.track, phone: r.phone, status: r.status, note: r.note, dailyNew: r.daily_new, learned: r.learned, mastered: r.mastered, days: r.days, createdAt: r.created_at, lastActiveAt: r.last_active_at })) })
    }
    const sm = /^\/api\/admin\/students\/(\d+)$/.exec(p)
    if (sm && req.method === 'GET') {
      need(s, 'students.view')
      const st = await one('SELECT * FROM students WHERE id = ?', Number(sm[1]))
      if (!st) return fail(res, 404, '没有这个学生')
      const rows = await all('SELECT day, new_cnt, review_cnt, right_cnt FROM daily WHERE student_id = ? AND day >= ? ORDER BY day', st.id, day(-29))
      const by = Object.fromEntries(rows.map(r => [r.day, r]))
      const days = Array.from({ length: 30 }, (_, i) => { const d = day(i - 29); const r = by[d] || {}; return { day: d, new: r.new_cnt || 0, review: r.review_cnt || 0 } })
      const boxes = Array(7).fill(0)
      for (const r of await all('SELECT box, COUNT(*) n FROM progress WHERE student_id = ? AND seen > 0 GROUP BY box', st.id)) boxes[r.box] = r.n
      const wrong = await all(`SELECT w.rank, w.ms, w.senses, p.wrong, p.box FROM progress p JOIN words w ON w.rank = p.rank WHERE p.student_id = ? AND p.wrong > 0 ORDER BY p.wrong DESC, p.last_at DESC LIMIT 12`, st.id)
      const tot = await one('SELECT SUM(seen > 0) learned, SUM(box = 6) mastered, COALESCE(SUM(fav), 0) fav, SUM(wrong > 0 AND box < 6) wrong FROM progress WHERE student_id = ?', st.id)
      const studyDays = (await one('SELECT COUNT(*) n FROM daily WHERE student_id = ? AND (new_cnt + review_cnt) > 0', st.id)).n
      return send(res, 200, {
        student: { id: st.id, name: st.name, school: st.school, className: st.class_name, track: st.track, phone: st.phone, status: st.status, note: st.note, dailyNew: st.daily_new, createdAt: st.created_at, lastActiveAt: st.last_active_at },
        total: { learned: Number(tot.learned || 0), mastered: Number(tot.mastered || 0), fav: Number(tot.fav || 0), wrong: Number(tot.wrong || 0), studyDays },
        days, boxes, levels: await levelsOf(st.id, true), ...(await streakOf(st.id)),
        wrong: wrong.map(w => ({ rank: w.rank, ms: w.ms, zh: (JSON.parse(w.senses || '[]')[0] || {}).zh || '', wrong: w.wrong, box: w.box }))
      })
    }
    if (sm && req.method === 'PUT') {
      need(s, 'students.edit')
      const id = Number(sm[1]), b = await body(req)
      const st = await one('SELECT * FROM students WHERE id = ?', id)
      if (!st) return fail(res, 404, '没有这个学生')
      const d = { name: str(b.name ?? st.name, 30), school: str(b.school ?? st.school, 60), class_name: str(b.className ?? st.class_name, 40), phone: str(b.phone ?? st.phone, 20).replace(/[\s-]/g, ''),
        track: ['zero', 'some'].includes(b.track) ? b.track : st.track, daily_new: [10, 20, 30, 50].includes(Number(b.dailyNew)) ? Number(b.dailyNew) : st.daily_new,
        note: str(b.note ?? st.note, 500), status: ['active', 'disabled'].includes(b.status) ? b.status : st.status }
      if (!d.name) return fail(res, 400, '姓名不能为空')
      await run('UPDATE students SET name = ?, school = ?, class_name = ?, phone = ?, track = ?, daily_new = ?, note = ?, status = ? WHERE id = ?', d.name, d.school, d.class_name, d.phone, d.track, d.daily_new, d.note, d.status, id)
      const changed = Object.keys(d).filter(k => String(d[k] ?? '') !== String(st[k] ?? ''))
      await audit(s, req, d.status !== st.status ? (d.status === 'disabled' ? 'student.disable' : 'student.enable') : 'student.edit', `${d.name} #${id}`, changed.join(', '))
      return send(res, 200, { ok: true })
    }

    // ---------- 单词 ----------
    if (p === '/api/admin/words' && req.method === 'GET') {
      need(s, 'words.view')
      const level = Number(url.searchParams.get('level')) || 0, status = url.searchParams.get('status') || '', topic = str(url.searchParams.get('topic'), 32), k = str(url.searchParams.get('q'), 40).toLowerCase().replace(/[%_]/g, '')
      const conds = [], args = []
      if (level) { conds.push('level = ?'); args.push(level) }
      if (['approved', 'pending'].includes(status)) { conds.push('status = ?'); args.push(status) }
      if (status === 'check') conds.push(`senses LIKE '%"check":true%'`)
      if (status === 'edited') conds.push('edited = 1')
      if (topic) { conds.push('topic = ?'); args.push(topic) }
      if (k) { const l = `%${k}%`; conds.push('(lower(ms) LIKE ? OR lower(root) LIKE ? OR senses LIKE ? OR rank = ?)'); args.push(l, l, l, Number(k) || -1) }
      const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''
      const pg = page(url, 50)
      const total = (await one(`SELECT COUNT(*) n FROM words ${where}`, ...args)).n
      const rows = await all(`SELECT * FROM words ${where} ORDER BY rank LIMIT ? OFFSET ?`, ...args, pg.size, pg.offset)
      const lc = level ? 'WHERE level = ?' : '', la = level ? [level] : []
      const counts = await one(`SELECT COUNT(*) total, SUM(status = 'approved') approved, SUM(status = 'pending') pending, SUM(senses LIKE '%"check":true%') \`check\`, SUM(edited = 1) edited FROM words ${lc}`, ...la)
      const topics = await all(`SELECT topic, COUNT(*) n FROM words WHERE topic <> '' GROUP BY topic ORDER BY n DESC`)
      return send(res, 200, { total, page: pg.page, size: pg.size, counts, topics, words: rows.map(wordAdminOut) })
    }
    if (p === '/api/admin/words/export.json') {
      need(s, 'words.view')
      // Word Atlas(词光)的数据格式:w / senses(pos zh en)/ ex(en = 马来语例句)/ col fam syn ant / tip / cefr / topic
      const rows = await all(`SELECT * FROM words WHERE status = 'approved' ORDER BY rank`)
      const out = rows.map(wordAdminOut).map(w => ({ id: `${String(w.rank).padStart(4, '0')}_${w.ms.replace(/\W+/g, '-')}`, rank: w.rank, w: w.ms, root: w.root,
        senses: w.senses.filter(x => !x.check).map(x => ({ pos: x.pos, zh: x.zh, en: x.en || '' })),
        ex: [...w.senses.filter(x => !x.check && x.exMs).map(x => ({ en: x.exMs, zh: x.exZh })), ...(w.extra.ex || []).map(x => ({ en: x.ms, zh: x.zh }))],
        col: w.extra.col || [], fam: w.extra.fam || [], syn: w.extra.syn || [], ant: w.extra.ant || [], tip: w.extra.tip || '', note: w.extra.note || '',
        cefr: `T${w.level}`, topic: w.topic, image: w.extra.image || '', audio: w.audioUrl }))
      await audit(s, req, 'words.export', `${out.length} 词`)
      return send(res, 200, out, { 'content-disposition': `attachment; filename="malay-words-${day()}.json"` })
    }
    if (p === '/api/admin/words/import' && req.method === 'POST') {
      need(s, 'words.import')
      const b = await body(req, 16 * 1024 * 1024)
      if (!Array.isArray(b.words)) return fail(res, 400, '格式不对:要一个单词数组(build.py 生成的 words.json,或词光导出的 json)')
      // 词光格式(w / ex.en)转成我们的格式
      const list = b.words.map(w => w.ms ? w : { rank: w.rank, ms: w.w, root: w.root || '', level: Number(String(w.cefr || '').replace(/\D/g, '')) || 0, audio: String(w.audio || '').split('/').pop(), status: 'approved', topic: w.topic,
        senses: (w.senses || []).map((x, i) => ({ ...x, exMs: i === 0 && w.ex?.[0] ? w.ex[0].en : '', exZh: i === 0 && w.ex?.[0] ? w.ex[0].zh : '' })),
        extra: { ex: (w.ex || []).slice(1).map(x => ({ ms: x.en, zh: x.zh })), col: w.col, fam: w.fam, syn: w.syn, ant: w.ant, tip: w.tip, note: w.note } })
      const valid = list.filter(w => Number.isInteger(Number(w.rank)) && Number(w.rank) > 0 && w.ms)
      if (b.dryRun) {
        const ranks = valid.map(w => Number(w.rank))
        const exist = ranks.length ? (await all('SELECT rank, edited FROM words WHERE rank IN (?)', ranks)) : []
        return send(res, 200, { dryRun: true, total: list.length, valid: valid.length, invalid: list.length - valid.length, update: exist.length, create: valid.length - exist.length, keepEdited: b.overwriteEdited ? 0 : exist.filter(e => e.edited).length })
      }
      const r = await importWords(valid, { overwriteEdited: !!b.overwriteEdited })
      // 扩展字段(例句、搭配、主题……)只在新数据里有值时才写
      for (const w of valid) if (w.extra || w.topic) await run('UPDATE words SET topic = ?, extra = ? WHERE rank = ? AND edited = 0', str(w.topic, 32), JSON.stringify(cleanExtra(w.extra || {})), Number(w.rank))
      await audit(s, req, 'words.import', `${r.changed} / ${r.total}`, { overwriteEdited: !!b.overwriteEdited })
      return send(res, 200, r)
    }
    if (p === '/api/admin/words/batch' && req.method === 'POST') {
      need(s, 'words.publish')
      const b = await body(req, 64 * 1024)
      const ranks = (Array.isArray(b.ranks) ? b.ranks : []).map(Number).filter(Number.isInteger).slice(0, 500)
      if (!ranks.length || !['approved', 'pending'].includes(b.status)) return fail(res, 400, '参数不对')
      let ok = 0, skipped = 0
      for (const w of await all('SELECT rank, senses FROM words WHERE rank IN (?)', ranks)) {
        if (b.status === 'approved' && !JSON.parse(w.senses || '[]').some(x => !x.check)) { skipped++; continue }
        await run('UPDATE words SET status = ?, edited = 1, updated_at = ? WHERE rank = ?', b.status, now(), w.rank); ok++
      }
      await audit(s, req, b.status === 'approved' ? 'words.publish' : 'words.unpublish', `${ok} 词`, ranks.slice(0, 50).join(','))
      return send(res, 200, { ok, skipped })
    }
    if (p === '/api/admin/words' && req.method === 'POST') {
      need(s, 'words.edit')
      const b = await body(req, 64 * 1024)
      const ms = str(b.ms, 80)
      if (!ms) return fail(res, 400, '马来语不能为空')
      const rank = Number(b.rank) || ((await one('SELECT COALESCE(MAX(rank), 0) n FROM words')).n + 1)
      if (await one('SELECT 1 FROM words WHERE rank = ?', rank)) return fail(res, 400, `序号 ${rank} 已经有词了`)
      const level = Number(b.level) || Math.min(Math.ceil(rank / 500), 10)
      const senses = (Array.isArray(b.senses) ? b.senses : []).map(cleanSenseFull).filter(x => x.zh)
      await run('INSERT INTO words (rank, ms, root, level, topic, senses, extra, audio, status, edited, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
        rank, ms, str(b.root, 80), level, str(b.topic, 32), JSON.stringify(senses), JSON.stringify(cleanExtra(b.extra || {})), str(b.audio, 200), 'pending', now())
      await audit(s, req, 'word.create', `${ms} #${rank}`)
      return send(res, 200, { ok: true, rank })
    }
    const wm = /^\/api\/admin\/words\/(\d+)$/.exec(p)
    if (wm && req.method === 'GET') {
      need(s, 'words.view')
      const w = await one('SELECT * FROM words WHERE rank = ?', Number(wm[1]))
      if (!w) return fail(res, 404, '没有这个词')
      const learners = await one('SELECT COUNT(*) n, SUM(box = 6) mastered, SUM(wrong) wrong FROM progress WHERE rank = ? AND seen > 0', w.rank)
      const history = can(s, 'audit.view') ? await all(`SELECT at, username, action, detail FROM audit_log WHERE target LIKE ? ORDER BY id DESC LIMIT 10`, `%#${w.rank}`) : []
      return send(res, 200, { ...wordAdminOut(w), learners: { n: Number(learners.n || 0), mastered: Number(learners.mastered || 0), wrong: Number(learners.wrong || 0) }, history })
    }
    if (wm && req.method === 'PUT') {
      need(s, 'words.edit', 'words.publish')
      const b = await body(req, 64 * 1024), rank = Number(wm[1])
      const w = await one('SELECT * FROM words WHERE rank = ?', rank)
      if (!w) return fail(res, 404, '没有这个词')
      const editing = ['ms', 'root', 'senses', 'extra', 'topic', 'level', 'audio'].some(k => b[k] !== undefined)
      if (editing) need(s, 'words.edit')
      const senses = Array.isArray(b.senses) ? b.senses.map(cleanSenseFull).filter(x => x.zh) : JSON.parse(w.senses || '[]')
      const ms = b.ms !== undefined ? str(b.ms, 80) : w.ms
      if (!ms) return fail(res, 400, '马来语不能为空')
      let status = w.status
      if (b.status !== undefined && b.status !== w.status) { need(s, 'words.publish'); status = b.status === 'approved' ? 'approved' : 'pending' }
      if (status === 'approved' && !senses.some(x => !x.check)) return fail(res, 400, '至少要有一条审过的释义才能上架')
      const level = b.level !== undefined ? Math.min(Math.max(Number(b.level) || 1, 1), 99) : w.level
      await run('UPDATE words SET ms = ?, root = ?, level = ?, topic = ?, senses = ?, extra = ?, audio = ?, status = ?, edited = 1, updated_at = ? WHERE rank = ?',
        ms, b.root !== undefined ? str(b.root, 80) : w.root, level, b.topic !== undefined ? str(b.topic, 32) : (w.topic || ''), JSON.stringify(senses),
        b.extra !== undefined ? JSON.stringify(cleanExtra(b.extra)) : (w.extra || '{}'), b.audio !== undefined ? str(b.audio, 200) : w.audio, status, now(), rank)
      const what = status !== w.status ? (status === 'approved' ? 'word.publish' : 'word.unpublish') : 'word.edit'
      await audit(s, req, what, `${ms} #${rank}`)
      return send(res, 200, { ok: true })
    }

    // ---------- 课程(旅程 10 站) ----------
    if (p === '/api/admin/courses' && req.method === 'GET') {
      need(s, 'courses.view')
      const courses = await all('SELECT * FROM courses ORDER BY level')
      const words = await all('SELECT level, status, COUNT(*) n FROM words GROUP BY level, status')
      const learners = await all('SELECT w.level, COUNT(DISTINCT p.student_id) n FROM progress p JOIN words w ON w.rank = p.rank WHERE p.seen > 0 GROUP BY w.level')
      const L = Object.fromEntries(learners.map(r => [r.level, r.n]))
      return send(res, 200, courses.map(c => {
        const ws = words.filter(w => w.level === c.level)
        return { level: c.level, city: c.city, ms: c.ms, note: c.note, intro: c.intro, published: !!c.published, updatedAt: c.updated_at,
          approved: ws.filter(w => w.status === 'approved').reduce((n, w) => n + w.n, 0), pending: ws.filter(w => w.status === 'pending').reduce((n, w) => n + w.n, 0), learners: L[c.level] || 0 }
      }))
    }
    const cm = /^\/api\/admin\/courses\/(\d+)$/.exec(p)
    if (cm && req.method === 'PUT') {
      need(s, 'courses.edit')
      const level = Number(cm[1]), b = await body(req, 16 * 1024)
      const c = await one('SELECT * FROM courses WHERE level = ?', level)
      if (!c) return fail(res, 404, '没有这一站')
      const d = { city: str(b.city ?? c.city, 20), ms: str(b.ms ?? c.ms, 40), note: str(b.note ?? c.note, 60), intro: str(b.intro ?? c.intro, 1000), published: b.published === undefined ? c.published : (b.published ? 1 : 0) }
      if (!d.city) return fail(res, 400, '站名不能为空')
      await run('UPDATE courses SET city = ?, ms = ?, note = ?, intro = ?, published = ?, updated_at = ? WHERE level = ?', d.city, d.ms, d.note, d.intro, d.published, now(), level)
      await reloadStops()
      await audit(s, req, d.published !== c.published ? (d.published ? 'course.open' : 'course.close') : 'course.edit', `第 ${level} 站 ${d.city}`)
      return send(res, 200, { ok: true })
    }

    // ---------- 老师 ----------
    if (p === '/api/admin/teachers' && req.method === 'GET') { need(s, 'teachers.view'); return send(res, 200, await all('SELECT * FROM teachers ORDER BY sort, id')) }
    const tm = /^\/api\/admin\/teachers(?:\/(\d+))?$/.exec(p)
    if (tm && (req.method === 'POST' || req.method === 'PUT')) {
      need(s, 'teachers.edit')
      const b = await body(req, 8 * 1024 * 1024)
      const d = { name: str(b.name, 30), title: str(b.title, 100), role: str(b.role, 30), bio: str(b.bio, 1000), photo: str(b.photo, 300), sort: Number(b.sort) || 0 }
      if (!d.name) return fail(res, 400, '请填写姓名')
      if (b.photoData) d.photo = savePhoto(b.photoData)
      if (tm[1]) await run('UPDATE teachers SET name = ?, title = ?, role = ?, bio = ?, photo = ?, sort = ? WHERE id = ?', d.name, d.title, d.role, d.bio, d.photo, d.sort, Number(tm[1]))
      else await run('INSERT INTO teachers (name, title, role, bio, photo, sort) VALUES (?, ?, ?, ?, ?, ?)', d.name, d.title, d.role, d.bio, d.photo, d.sort)
      await audit(s, req, tm[1] ? 'teacher.edit' : 'teacher.create', d.name)
      return send(res, 200, { ok: true })
    }
    if (tm && tm[1] && req.method === 'DELETE') {
      need(s, 'teachers.edit')
      const t = await one('SELECT name FROM teachers WHERE id = ?', Number(tm[1]))
      await run('DELETE FROM teachers WHERE id = ?', Number(tm[1]))
      await audit(s, req, 'teacher.delete', t ? t.name : `#${tm[1]}`)
      return send(res, 200, { ok: true })
    }

    // ---------- 后台账号 ----------
    if (p === '/api/admin/users' && req.method === 'GET') {
      need(s, 'users.view', 'users.manage')
      return send(res, 200, (await all(`${USER_SQL} ORDER BY u.status, u.id`)).map(userOut))
    }
    if (p === '/api/admin/users' && req.method === 'POST') {
      need(s, 'users.manage')
      const b = await body(req)
      const username = str(b.username, 40).toLowerCase()
      if (!/^[a-z0-9_.-]{3,32}$/.test(username)) return fail(res, 400, '账号只能用 3–32 位小写字母、数字、. _ -')
      if (await one('SELECT 1 FROM admin_users WHERE username = ?', username)) return fail(res, 400, '这个账号已经有了')
      const role = await one('SELECT * FROM admin_roles WHERE id = ?', Number(b.roleId))
      if (!role) return fail(res, 400, '请选择角色')
      checkGrant(s, parsePerms(role))
      validPassword(b.password)
      const r = await run('INSERT INTO admin_users (username, name, password_hash, role_id, status, must_change, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)', username, str(b.name, 40) || username, hashPassword(b.password), role.id, 'active', now(), now())
      await audit(s, req, 'user.create', username, `角色 ${role.name}`)
      return send(res, 200, { ok: true, id: r.insertId })
    }
    const um = /^\/api\/admin\/users\/(\d+)(\/password)?$/.exec(p)
    if (um) {
      need(s, 'users.manage')
      const id = Number(um[1])
      const u = await one(`${USER_SQL} WHERE u.id = ?`, id)
      if (!u) return fail(res, 404, '没有这个账号')
      // 不是超级管理员,就不能动超级管理员的账号
      if (!isSuper(s) && u.role_code === 'super_admin') throw deny()
      if (um[2] && req.method === 'POST') {
        const b = await body(req)
        validPassword(b.password)
        await run('UPDATE admin_users SET password_hash = ?, must_change = ?, updated_at = ? WHERE id = ?', hashPassword(b.password), id === s.id ? 0 : 1, now(), id)
        if (id !== s.id) await killSessions(id)
        await audit(s, req, 'user.password', u.username)
        return send(res, 200, { ok: true })
      }
      if (req.method === 'PUT') {
        const b = await body(req)
        const status = ['active', 'disabled'].includes(b.status) ? b.status : u.status
        let roleId = u.role_id
        if (b.roleId !== undefined && Number(b.roleId) !== u.role_id) {
          const role = await one('SELECT * FROM admin_roles WHERE id = ?', Number(b.roleId))
          if (!role) return fail(res, 400, '没有这个角色')
          if (id === s.id) return fail(res, 400, '不能改自己的角色')
          checkGrant(s, parsePerms(role)); roleId = role.id
        }
        if (id === s.id && status === 'disabled') return fail(res, 400, '不能停用自己')
        const leavingSuper = u.role_code === 'super_admin' && u.status === 'active' && (status === 'disabled' || roleId !== u.role_id)
        if (leavingSuper && !(await superCount(id))) return fail(res, 400, '至少要留一个能用的超级管理员')
        await run('UPDATE admin_users SET name = ?, role_id = ?, status = ?, updated_at = ? WHERE id = ?', str(b.name ?? u.name, 40) || u.username, roleId, status, now(), id)
        if (status === 'disabled' || roleId !== u.role_id) await killSessions(id)
        await audit(s, req, status !== u.status ? (status === 'disabled' ? 'user.disable' : 'user.enable') : 'user.edit', u.username)
        return send(res, 200, { ok: true })
      }
      if (req.method === 'DELETE') {
        if (id === s.id) return fail(res, 400, '不能删除自己')
        if (u.role_code === 'super_admin' && !(await superCount(id))) return fail(res, 400, '至少要留一个能用的超级管理员')
        await killSessions(id)
        await run('DELETE FROM admin_users WHERE id = ?', id)
        await audit(s, req, 'user.delete', u.username)
        return send(res, 200, { ok: true })
      }
    }

    // ---------- 角色 ----------
    if (p === '/api/admin/roles' && req.method === 'GET') {
      need(s, 'users.view', 'users.manage', 'roles.manage')
      const roles = await all('SELECT r.*, (SELECT COUNT(*) FROM admin_users u WHERE u.role_id = r.id) users FROM admin_roles r ORDER BY r.builtin DESC, r.id')
      return send(res, 200, { catalog: PERMISSIONS, roles: roles.map(r => ({ id: r.id, code: r.code, name: r.name, description: r.description, permissions: parsePerms(r), builtin: !!r.builtin, users: r.users })) })
    }
    if (p === '/api/admin/roles' && req.method === 'POST') {
      need(s, 'roles.manage')
      const b = await body(req, 16 * 1024)
      const name = str(b.name, 20)
      if (!name) return fail(res, 400, '请填写角色名称')
      const perms = cleanPerms(b.permissions)
      checkGrant(s, perms)
      const code = 'custom_' + randomBytes(4).toString('hex')
      const r = await run('INSERT INTO admin_roles (code, name, description, permissions, builtin, created_at) VALUES (?, ?, ?, ?, 0, ?)', code, name, str(b.description, 100), JSON.stringify(perms), now())
      await audit(s, req, 'role.create', name, perms.join(','))
      return send(res, 200, { ok: true, id: r.insertId })
    }
    const rm = /^\/api\/admin\/roles\/(\d+)$/.exec(p)
    if (rm) {
      need(s, 'roles.manage')
      const role = await one('SELECT * FROM admin_roles WHERE id = ?', Number(rm[1]))
      if (!role) return fail(res, 404, '没有这个角色')
      if (role.code === 'super_admin') return fail(res, 400, '超级管理员的权限不能改')
      const mine = await one('SELECT role_id FROM admin_users WHERE id = ?', s.id)
      if (mine.role_id === role.id && !isSuper(s)) return fail(res, 400, '不能改自己所在的角色')
      if (req.method === 'PUT') {
        const b = await body(req, 16 * 1024)
        const perms = b.permissions !== undefined ? cleanPerms(b.permissions) : parsePerms(role)
        checkGrant(s, perms)
        await run('UPDATE admin_roles SET name = ?, description = ?, permissions = ? WHERE id = ?', str(b.name ?? role.name, 20) || role.name, str(b.description ?? role.description, 100), JSON.stringify(perms), role.id)
        const before = parsePerms(role)
        await audit(s, req, 'role.edit', role.name, { add: perms.filter(x => !before.includes(x)), remove: before.filter(x => !perms.includes(x)) })
        return send(res, 200, { ok: true })
      }
      if (req.method === 'DELETE') {
        if (role.builtin) return fail(res, 400, '内置角色不能删')
        if ((await one('SELECT COUNT(*) n FROM admin_users WHERE role_id = ?', role.id)).n) return fail(res, 400, '还有账号在用这个角色,先把他们换到别的角色')
        await run('DELETE FROM admin_roles WHERE id = ?', role.id)
        await audit(s, req, 'role.delete', role.name)
        return send(res, 200, { ok: true })
      }
    }

    // ---------- 操作日志 ----------
    if (p === '/api/admin/audit') {
      need(s, 'audit.view')
      const q = str(url.searchParams.get('q'), 40).replace(/[%_]/g, ''), range = url.searchParams.get('range') || '7d', kind = str(url.searchParams.get('kind'), 20)
      const conds = [], args = []
      const since = { '24h': Date.now() - 86400e3, '7d': Date.now() - 7 * 86400e3, '30d': Date.now() - 30 * 86400e3 }[range]
      if (since) { conds.push('at >= ?'); args.push(new Date(since).toISOString()) }
      if (q) { const l = `%${q}%`; conds.push('(username LIKE ? OR target LIKE ? OR detail LIKE ?)'); args.push(l, l, l) }
      if (kind) { conds.push('action LIKE ?'); args.push(kind.replace(/[^a-z]/g, '') + '%') }
      const where = conds.length ? 'WHERE ' + conds.join(' AND ') : ''
      const pg = page(url, 50)
      const total = (await one(`SELECT COUNT(*) n FROM audit_log ${where}`, ...args)).n
      const rows = await all(`SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, ...args, pg.size, pg.offset)
      const sinceArgs = since ? [new Date(since).toISOString()] : []
      const kinds = await all(`SELECT SUBSTRING_INDEX(action, '.', 1) k, COUNT(*) n FROM audit_log ${since ? 'WHERE at >= ?' : ''} GROUP BY k ORDER BY n DESC`, ...sinceArgs)
      return send(res, 200, { total, page: pg.page, size: pg.size, kinds, rows: rows.map(r => ({ id: r.id, at: r.at, userId: r.user_id, username: r.username, action: r.action, target: r.target, detail: r.detail, ip: r.ip })) })
    }

    return fail(res, 404, '接口不存在')
  } }
}
