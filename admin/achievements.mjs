// 成就与犀鸟形象：学生达成条件后服务器自动解锁、永久记录；学生只能在已解锁的犀鸟形象里选头像（不能自己上传图片）。
// 图片放在官网静态目录 website/site/mascot/<key>.webp（WebP，360px；旧 .jpg 留着兼容）（www.bahasa.cn/mascot/…），原图在 design/mascot/。
// 判定规则：
//   - 十站：这一站的词全部学过（levelsOf 的 stamped）→ 解锁这一站的男、女两套服装
//   - 打卡：历史最长连续天数 ≥ 3 / 7 / 30 / 100
//   - 对战：第一次 PK；PK 三连胜（≥2 人参加且自己分最高，按时间连续 3 场）；擂台某周进前十；本周学校榜第一
//   - 学习量：学过的词 ≥ 100 / 500 / 1000 / 3000 / 5000
// 已解锁的写进 achievements 表，之后条件变化（比如断签）也不会收回。
export function createAchievements({ all, one, run, day, levelsOf, weekStart }) {
  const IMG = 'https://www.bahasa.cn/mascot/'
  const STATIONS = [
    ['kl', '吉隆坡', ['kl-male-baju-melayu', '马来传统服 Baju Melayu'], ['kl-female-baju-kurung', '马来长裙 Baju Kurung']],
    ['melaka', '马六甲', ['melaka-male-baba', '峇峇装'], ['melaka-female-nyonya-kebaya', '娘惹可峇雅']],
    ['ipoh', '怡保', ['ipoh-male-tangzhuang', '唐装'], ['ipoh-female-cheongsam', '旗袍']],
    ['penang', '槟城', ['penang-male-kurta', '印裔长衫 Kurta'], ['penang-female-saree', '纱丽 Saree']],
    ['cameron', '金马伦', ['cameron-male-orang-asli', '原住民服饰（男）'], ['cameron-female-orang-asli', '原住民服饰（女）']],
    ['kuantan', '关丹', ['kuantan-male-fisherman', '东海岸渔民装'], ['kuantan-female-kebaya-labuh', '长可峇雅 Kebaya Labuh']],
    ['terengganu', '瓜拉登嘉楼', ['terengganu-male-songket', '登嘉楼宋吉锦礼服'], ['terengganu-female-songket', '宋吉锦长裙']],
    ['kotabharu', '哥打巴鲁', ['kotabharu-male-wau', '吉兰丹风筝装'], ['kotabharu-female-kebarung', 'Baju Kebarung']],
    ['kuching', '古晋', ['kuching-male-iban-warrior', '伊班战士装'], ['kuching-female-iban', '伊班银饰盛装']],
    ['kk', '亚庇', ['kk-male-kadazan', '卡达山杜顺男装'], ['kk-female-kadazan', '卡达山杜顺女装']]
  ]
  const ITEMS = []
  STATIONS.forEach(([, city, m, f], i) => {
    for (const [key, title] of [m, f]) ITEMS.push({ key, type: 'costume', title, desc: `第 ${i + 1} 站${city}通关解锁`, level: i + 1 })
  })
  const B = (key, title, desc) => ITEMS.push({ key: 'badge-' + key, type: 'badge', title, desc })
  B('streak-3', '连续打卡 3 天', '连续 3 天学习'); B('streak-7', '连续打卡 7 天', '连续 7 天学习')
  B('streak-30', '连续打卡 30 天', '连续 30 天学习'); B('streak-100', '连续打卡 100 天', '连续 100 天学习')
  B('battle-first-pk', '初次 PK', '完成第一场好友 PK'); B('battle-pk-3', 'PK 三连胜', '好友 PK 连赢 3 场')
  B('battle-arena-top10', '擂台前十', '每周擂台进入全站前十'); B('battle-school-1', '学校榜第一', '所在学校拿到周榜第一')
  for (const n of [100, 500, 1000, 3000, 5000]) B('words-' + n, `学会 ${n} 个词`, `累计学过 ${n} 个词`)
  const BY = Object.fromEntries(ITEMS.map(x => [x.key, x]))
  const out = (x, at) => ({ key: x.key, type: x.type, title: x.title, desc: x.desc, img: IMG + x.key + '.webp', unlocked: !!at, at: at || '' })
  const imgOf = key => (key && BY[key] && BY[key].type === 'costume' ? IMG + key + '.webp' : '')

  const SCHEMA = [`CREATE TABLE IF NOT EXISTS achievements (student_id INT NOT NULL, \`key\` VARCHAR(64) NOT NULL, at VARCHAR(32), seen TINYINT NOT NULL DEFAULT 0, PRIMARY KEY (student_id, \`key\`)) DEFAULT CHARSET = utf8mb4`]

  async function bestStreak(sid) {
    const days = (await all('SELECT day FROM daily WHERE student_id = ? AND (new_cnt + review_cnt) > 0 ORDER BY day', sid)).map(r => r.day)
    let best = 0, run = 0, prev = null
    for (const d of days) {
      run = prev && (Date.parse(d) - Date.parse(prev)) === 86400e3 ? run + 1 : 1
      best = Math.max(best, run); prev = d
    }
    return best
  }
  // 现在满足的条件（不管以前有没有记过）
  async function earned(st) {
    const sid = st.id, keys = []
    for (const l of await levelsOf(sid)) if (l.stamped && STATIONS[l.level - 1]) keys.push(STATIONS[l.level - 1][2][0], STATIONS[l.level - 1][3][0])
    const s = await bestStreak(sid)
    for (const n of [3, 7, 30, 100]) if (s >= n) keys.push('badge-streak-' + n)
    const learned = (await one('SELECT COUNT(*) n FROM progress WHERE student_id = ? AND seen > 0', sid)).n
    for (const n of [100, 500, 1000, 3000, 5000]) if (learned >= n) keys.push('badge-words-' + n)
    const pks = await all(`SELECT e.pk_id, e.score, e.created_at, (SELECT MAX(x.score) FROM pk_entry x WHERE x.pk_id = e.pk_id) top,
      (SELECT COUNT(*) FROM pk_entry x WHERE x.pk_id = e.pk_id) players FROM pk_entry e WHERE e.student_id = ? ORDER BY e.created_at`, sid)
    if (pks.length) keys.push('badge-battle-first-pk')
    let streak = 0
    for (const p of pks) { streak = p.players >= 2 && p.score >= p.top ? streak + 1 : 0; if (streak >= 3) { keys.push('badge-battle-pk-3'); break } }
    const weeks = await all('SELECT week, score, ms FROM arena_entry WHERE student_id = ?', sid)
    for (const w of weeks) {
      const place = (await one('SELECT COUNT(*) n FROM arena_entry WHERE week = ? AND (score > ? OR (score = ? AND ms < ?))', w.week, w.score, w.score, w.ms)).n + 1
      if (place <= 10) { keys.push('badge-battle-arena-top10'); break }
    }
    if (st.school) {
      const top = await one(`SELECT s.school FROM daily d JOIN students s ON s.id = d.student_id WHERE d.day >= ? AND s.school <> ''
        GROUP BY s.school ORDER BY SUM(d.new_cnt * 2 + d.review_cnt + d.right_cnt) DESC LIMIT 1`, weekStart())
      if (top && top.school === st.school) keys.push('badge-battle-school-1')
    }
    return keys
  }
  // 查成就：把新满足的写进表；fresh = 还没弹过「解锁」提示的
  async function list(st) {
    const now = new Date().toISOString()
    for (const k of await earned(st)) await run('INSERT IGNORE INTO achievements (student_id, `key`, at, seen) VALUES (?, ?, ?, 0)', st.id, k, now)
    const rows = await all('SELECT `key`, at, seen FROM achievements WHERE student_id = ?', st.id)
    const got = Object.fromEntries(rows.map(r => [r.key, r]))
    const fresh = rows.filter(r => !r.seen && BY[r.key]).map(r => out(BY[r.key], r.at))
    return { items: ITEMS.map(x => out(x, got[x.key] && got[x.key].at)), fresh, mascot: st.mascot || '', mascotImg: imgOf(st.mascot) }
  }
  async function markSeen(st) { await run('UPDATE achievements SET seen = 1 WHERE student_id = ?', st.id); return { ok: true } }
  async function setMascot(st, key) {
    if (key && !(BY[key] && BY[key].type === 'costume')) throw Object.assign(new Error('没有这个形象'), { code: 400 })
    if (key && !(await one('SELECT 1 FROM achievements WHERE student_id = ? AND `key` = ?', st.id, key))) throw Object.assign(new Error('还没解锁这个形象'), { code: 403 })
    await run('UPDATE students SET mascot = ? WHERE id = ?', key || '', st.id)
    return { ok: true, mascot: key || '', mascotImg: imgOf(key) }
  }
  async function handle(st, p, req, body) {
    if (p === '/api/app/achievements' && req.method === 'GET') return list(st)
    if (p === '/api/app/achievements/seen' && req.method === 'POST') return markSeen(st)
    if (p === '/api/app/mascot' && req.method === 'POST') return setMascot(st, String((await body(req)).key || ''))
    return undefined
  }
  return { SCHEMA, COLUMNS: [['students', 'mascot', `VARCHAR(64) NOT NULL DEFAULT ''`]], handle, imgOf }
}
