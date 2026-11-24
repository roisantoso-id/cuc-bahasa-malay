// AI 发音：后台「单词 → 发音 → AI 生成」用。Azure 语音合成（马来西亚马来语 HD 声音），
// 生成的 mp3 存在服务器 /data/uploads/tts/（和老师照片同一个卷），库里 audio 存 /uploads/tts/xxx.mp3。
// 密钥放服务器 .env：AZURE_TTS_KEY、AZURE_TTS_REGION（默认 eastus）。没配就提示「还没配」，不影响别的功能。
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

// 三个马来西亚马来语 HD 声音（2026-11 Azure 上 ms-MY 只有这三个 HD，另有老的 YasminNeural / OsmanNeural 偏机械）
export const VOICES = [
  { id: 'yasmin', name: 'Yasmin 女声', voice: 'ms-MY-Yasmin:DragonHDLatestNeural' },
  { id: 'nadira', name: 'Nadira 女声', voice: 'ms-MY-Nadira:DragonHDLatestNeural' },
  { id: 'osman', name: 'Osman 男声', voice: 'ms-MY-Osman:DragonHDLatestNeural' }
]
export const RATES = { slow: '-15%', normal: '+0%' }

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function createTts({ key, region = 'eastus', dir }) {
  mkdirSync(join(dir, 'tts'), { recursive: true })
  const recent = [] // 简单限流：整个后台每分钟最多 30 次
  return {
    ready: !!key,
    async make({ rank, text, voice, rate }) {
      if (!key) throw Object.assign(new Error('服务器还没配 AI 发音的密钥（AZURE_TTS_KEY）'), { code: 400 })
      const v = VOICES.find(x => x.id === voice) || VOICES[0]
      const r = RATES[rate] || RATES.normal
      const t = String(text || '').trim().slice(0, 200)
      if (!t) throw Object.assign(new Error('要读的内容是空的'), { code: 400 })
      const now = Date.now()
      while (recent.length && now - recent[0] > 60e3) recent.shift()
      if (recent.length >= 30) throw Object.assign(new Error('生成太频繁了，等一分钟再试'), { code: 429 })
      recent.push(now)
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ms-MY"><voice name="${v.voice}"><prosody rate="${r}">${esc(t)}</prosody></voice></speak>`
      let buf, last
      // HD 声音偶尔要几十秒才返回，超时给 90 秒，失败重试一次
      for (let i = 0; i < 2 && !buf; i++) {
        try {
          const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
            method: 'POST', signal: AbortSignal.timeout(90e3),
            headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3', 'User-Agent': 'jombelajar-admin' },
            body: ssml
          })
          const b = Buffer.from(await res.arrayBuffer())
          if (!res.ok || b.length < 1000) throw new Error(`Azure ${res.status}`)
          buf = b
        } catch (e) { last = e }
      }
      if (!buf) { console.error('tts', last); throw Object.assign(new Error('AI 发音生成失败，过一会儿再试'), { code: 502 }) }
      const name = `w${Number(rank) || 0}-${v.id}-${randomBytes(4).toString('hex')}.mp3`
      writeFileSync(join(dir, 'tts', name), buf)
      return { audio: `/uploads/tts/${name}`, voice: v.id, voiceName: v.name, rate: rate === 'slow' ? 'slow' : 'normal' }
    }
  }
}
