// 在服务器上直接建后台账号(还没有人能登录后台、或者要一次建好几个时用)
// 从标准输入读 JSON 数组:[{ "username": "zhangjingling", "name": "张静灵", "role": "super_admin", "passwordHash": "scrypt:盐:哈希" }]
//   密码在自己电脑上算好哈希再传(明文不经过服务器),账号第一次登录必须改密码;已经有的账号跳过,不改
//   在服务器上:docker compose exec -T api node scripts/create-admin.mjs < accounts.json
import mysql from 'mysql2/promise'

const url = process.env.DATABASE_URL
if (!url) { console.error('缺 DATABASE_URL'); process.exit(1) }
let input = ''
for await (const c of process.stdin) input += c
const list = JSON.parse(input)
if (!Array.isArray(list)) { console.error('要一个 JSON 数组'); process.exit(1) }

const db = await mysql.createConnection({ uri: url, charset: 'utf8mb4' })
const now = new Date().toISOString()
for (const a of list) {
  const username = String(a.username || '').toLowerCase()
  if (!/^[a-z0-9_.-]{3,32}$/.test(username) || !/^scrypt:[0-9a-f]+:[0-9a-f]{64}$/.test(String(a.passwordHash))) { console.log(`跳过 ${username}:账号或密码哈希格式不对`); continue }
  const [[role]] = await db.query('SELECT id, name FROM admin_roles WHERE code = ?', [a.role || 'viewer'])
  if (!role) { console.log(`跳过 ${username}:没有角色 ${a.role}`); continue }
  const [[exist]] = await db.query('SELECT id FROM admin_users WHERE username = ?', [username])
  if (exist) { console.log(`已经有 ${username},没改`); continue }
  await db.query('INSERT INTO admin_users (username, name, password_hash, role_id, status, must_change, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
    [username, String(a.name || username).slice(0, 40), a.passwordHash, role.id, 'active', now, now])
  await db.query('INSERT INTO audit_log (at, user_id, username, action, target, detail, ip) VALUES (?, NULL, ?, ?, ?, ?, ?)', [now, 'server-cli', 'user.create', username, `角色 ${role.name}`, 'server'])
  console.log(`已建 ${username}(${role.name}),第一次登录要改密码`)
}
await db.end()
