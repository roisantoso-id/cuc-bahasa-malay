// 本机演示数据:造 40 个学生和最近 30 天的学习记录,方便看后台页面
//   DATABASE_URL=mysql://用户:密码@127.0.0.1:3306/库名 node admin/scripts/seed-demo.mjs
// 只允许连本机数据库(127.0.0.1 / localhost),防止误写线上库
import mysql from 'mysql2/promise'

const url = process.env.DATABASE_URL || ''
const host = (() => { try { return new URL(url).hostname } catch { return '' } })()
if (!['127.0.0.1', 'localhost'].includes(host)) { console.error('只能对本机数据库造演示数据(DATABASE_URL 的主机要是 127.0.0.1 / localhost)'); process.exit(1) }
const db = await mysql.createConnection({ uri: url, charset: 'utf8mb4' })
const q = (sql, ...a) => db.query(sql, a)

const day = (o = 0) => new Date(Date.now() + 8 * 3600e3 + o * 86400e3).toISOString().slice(0, 10)
const pick = a => a[Math.floor(Math.random() * a.length)]
const SUR = ['陈', '林', '黄', '张', '李', '王', '吴', '刘', '蔡', '杨', '郑', '许', '何', '谢', '罗']
const GIV = ['子涵', '欣怡', '浩然', '诗琪', '宇轩', '佳慧', '俊杰', '雨桐', '嘉豪', '美琳', '志明', '晓雯', '伟杰', '慧敏']
const SCHOOLS = ['中国传媒大学', '北京外国语大学', '广西民族大学', '云南民族大学', '吉隆坡尊孔独中', '槟城钟灵独中']

const [[{ n }]] = await q('SELECT COUNT(*) n FROM students')
if (n > 0) { console.log(`已经有 ${n} 个学生,不再造`); process.exit(0) }
for (let i = 1; i <= 40; i++) {
  const created = day(-Math.floor(Math.random() * 40))
  const active = Math.random() < 0.8
  const lastDays = active ? Math.floor(Math.random() * 10) : 15 + Math.floor(Math.random() * 20)
  const [r] = await q(`INSERT INTO students (openid, name, school, class_name, track, phone, daily_new, created_at, last_active_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    `demo-seed-${i}`, pick(SUR) + pick(GIV), pick(SCHOOLS), `马来语 ${2023 + (i % 3)} 级`, Math.random() < 0.3 ? 'some' : 'zero', `138${String(10000000 + i * 7919).slice(0, 8)}`,
    pick([10, 20, 20, 30]), created + 'T02:00:00.000Z', day(-lastDays) + 'T12:00:00.000Z', i % 17 === 0 ? 'disabled' : 'active')
  const sid = r.insertId
  let rank = 1
  for (let d = 29; d >= lastDays; d--) {
    if (Math.random() < 0.35) continue
    const nNew = Math.floor(5 + Math.random() * 20), nRev = Math.floor(Math.random() * 30)
    await q('INSERT INTO daily (student_id, day, new_cnt, review_cnt, right_cnt) VALUES (?, ?, ?, ?, ?)', sid, day(-d), nNew, nRev, Math.floor((nNew + nRev) * 0.7))
    for (let k = 0; k < nNew; k++, rank++) {
      const box = Math.floor(Math.random() * 7)
      await q('INSERT IGNORE INTO progress (student_id, `rank`, box, due, wrong, seen, fav, first_at, last_day, last_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        sid, rank, box, day(Math.floor(Math.random() * 5)), Math.random() < 0.25 ? 1 + Math.floor(Math.random() * 4) : 0, 1 + Math.floor(Math.random() * 4), Math.random() < 0.05 ? 1 : 0, day(-d), day(-d), day(-d) + 'T12:00:00.000Z')
    }
  }
}
console.log('造好了 40 个演示学生')
await db.end()
