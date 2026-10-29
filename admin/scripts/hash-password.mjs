// 生成管理员密码哈希:node admin/scripts/hash-password.mjs
// 在自己的终端里运行,输入密码后把输出的整行 ADMIN_PASSWORD_HASH=… 写进 /etc/jombelajar-admin.env
import { randomBytes, scryptSync } from 'node:crypto'
import { createInterface } from 'node:readline'

const rl = createInterface({ input: process.stdin, output: process.stdout })
rl.question('管理员密码(至少 10 位):', pw => {
  rl.close()
  if (pw.length < 10) { console.error('密码太短'); process.exit(1) }
  const salt = randomBytes(16).toString('hex')
  console.log(`ADMIN_PASSWORD_HASH=scrypt:${salt}:${scryptSync(pw, salt, 32).toString('hex')}`)
})
