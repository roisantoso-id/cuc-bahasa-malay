// 学生头像：小程序用微信官方头像选择器选图 → wx.uploadFile 传到这里 → 存 /data/uploads/av-*.jpg → 交给微信异步图片检测（media_check_async）
// 检测结果由微信「消息推送」打到 /api/wx/push（公众平台 → 开发管理 → 消息推送，明文 JSON，Token 填服务器 .env 的 WX_PUSH_TOKEN）
// 检测通过前：头像只有本人看得到（studentOut 返回），榜单 / PK 里别人看到的还是犀鸟；不合规的直接删文件。
import { randomBytes, createHash } from 'node:crypto'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

export function createAvatar({ one, run, DATA, ENV, DEMO, accessToken }) {
  const PUBLIC = (ENV.API_PUBLIC_URL || 'https://api.bahasa.cn').replace(/\/$/, '')
  const MAX = 2 * 1024 * 1024
  const urlOf = name => (name ? `${PUBLIC}/uploads/${name}` : '')
  const rm = name => { if (name) try { unlinkSync(join(DATA, 'uploads', name)) } catch (e) { /* 已经没了 */ } }

  async function raw(req) {
    const chunks = []; let n = 0
    for await (const c of req) { n += c.length; if (n > MAX + 64 * 1024) throw Object.assign(new Error('图片不能超过 2MB'), { code: 413 }); chunks.push(c) }
    return Buffer.concat(chunks)
  }
  // 只取 multipart 里第一个带 filename 的文件
  function fileFrom(buf, ctype) {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ctype || '')
    if (!m) return null
    const b = Buffer.from('--' + (m[1] || m[2]).trim())
    let i = buf.indexOf(b)
    while (i >= 0) {
      const next = buf.indexOf(b, i + b.length)
      if (next < 0) break
      const part = buf.subarray(i + b.length + 2, next - 2) // 去掉开头 \r\n 和结尾 \r\n
      const h = part.indexOf('\r\n\r\n')
      if (h > 0 && /filename=/i.test(part.subarray(0, h).toString())) return part.subarray(h + 4)
      i = next
    }
    return null
  }
  const kind = f => (f[0] === 0xff && f[1] === 0xd8 ? 'jpg' : f[0] === 0x89 && f[1] === 0x50 ? 'png' : '')

  async function upload(req, st) {
    const f = fileFrom(await raw(req), req.headers['content-type'])
    if (!f || !f.length) throw Object.assign(new Error('没收到图片'), { code: 400 })
    const ext = kind(f)
    if (!ext) throw Object.assign(new Error('只支持 jpg、png 图片'), { code: 400 })
    if (f.length > MAX) throw Object.assign(new Error('图片不能超过 2MB'), { code: 413 })
    const name = `av-${st.id}-${randomBytes(5).toString('hex')}.${ext}`
    writeFileSync(join(DATA, 'uploads', name), f)
    const old = (await one('SELECT avatar FROM students WHERE id = ?', st.id) || {}).avatar
    let trace = '', ok = DEMO ? 1 : 0
    if (!DEMO) {
      const d = await (await fetch(`https://api.weixin.qq.com/wxa/media_check_async?access_token=${await accessToken()}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ media_url: urlOf(name), media_type: 2, version: 2, scene: 1, openid: st.openid })
      })).json()
      if (d.errcode) { rm(name); throw Object.assign(new Error('头像检测暂时不可用，请稍后再试'), { code: 503 }) }
      trace = d.trace_id || ''
    }
    await run('UPDATE students SET avatar = ?, avatar_ok = ?, avatar_trace = ? WHERE id = ?', name, ok, trace, st.id)
    if (old && old !== name) rm(old)
    return { avatar: urlOf(name), pending: !ok }
  }

  // 微信消息推送：GET 校验服务器地址；POST 收检测结果（明文 JSON）
  async function push(req, res, url, send) {
    const token = ENV.WX_PUSH_TOKEN || ''
    const sig = createHash('sha1').update([token, url.searchParams.get('timestamp') || '', url.searchParams.get('nonce') || ''].sort().join('')).digest('hex')
    if (!token || sig !== url.searchParams.get('signature')) { res.writeHead(403); return res.end('forbidden') }
    if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(url.searchParams.get('echostr') || '') }
    const chunks = []; for await (const c of req) chunks.push(c)
    let m = {}; try { m = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch (e) { /* 不是 JSON 就忽略 */ }
    if (m.Event === 'wxa_media_check' && m.trace_id) {
      const s = await one('SELECT id, avatar FROM students WHERE avatar_trace = ?', m.trace_id)
      if (s) {
        const pass = m.result ? m.result.suggest === 'pass' : !m.isrisky
        if (pass) await run('UPDATE students SET avatar_ok = 1 WHERE id = ?', s.id)
        else { rm(s.avatar); await run(`UPDATE students SET avatar = '', avatar_ok = 0, avatar_trace = '' WHERE id = ?`, s.id) }
      }
    }
    res.writeHead(200, { 'content-type': 'text/plain' }); res.end('success')
  }

  return {
    COLUMNS: [
      ['students', 'avatar', `VARCHAR(120) NOT NULL DEFAULT ''`],
      ['students', 'avatar_ok', `TINYINT NOT NULL DEFAULT 0`],
      ['students', 'avatar_trace', `VARCHAR(64) NOT NULL DEFAULT ''`]
    ],
    upload, push, urlOf, rm,
    // 给别人看的头像：检测通过才给
    publicUrl: s => (s && s.avatar && s.avatar_ok ? urlOf(s.avatar) : '')
  }
}
