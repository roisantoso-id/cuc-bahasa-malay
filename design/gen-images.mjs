// 生成设计配图(GPT Image 2,异步任务:提交 → 轮询 → 下载)。
// 用法:node design/gen-images.mjs [名字前缀…]   例:node design/gen-images.mjs a-   只生方向 A
// Key:读环境变量 LK_API_KEY;没设就从本机 teach-image skill 的脚本里读,不写进本仓库。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://api.lk888.ai'
const KEY = process.env.LK_API_KEY
  || readFileSync(join(homedir(), '.claude/skills/teach-image/gen-ppt-images.js'), 'utf8').match(/LK_API_KEY \|\| '([^']+)'/)?.[1]
if (!KEY) throw new Error('没有 LK_API_KEY')

// 图里一律不放文字:马来文 / 中文都在网页上排,避免模型拼错
const NO_TEXT = 'Absolutely no text, letters, words, numbers, signage writing or watermarks anywhere in the image.'

const A = `Fine copperplate etching / engraving illustration, crisp cross-hatched linework, printed in deep forest-green ink (#1f4d3a) on warm cream paper (#f4efe4), with very sparing muted gold (#b08a3e) accents. Looks like a plate from a scholarly university-press book. Calm, authoritative, timeless. ${NO_TEXT}`
const B = `Flat gouache-style illustration with subtle paper grain, Malaysian Nanyang / Peranakan feeling. Palette: peacock teal (#0f6e7a), coral pink (#e8745b), turmeric yellow (#e3a81b), jade green (#3f8f6b), on warm cream (#fbf4e8). Clean shapes, gentle shadows, sunny tropical light. ${NO_TEXT}`
// 方向 C 的吉祥物:每张图都用同一段描述,保证形象一致
const HORNBILL = 'The mascot is a friendly cartoon rhinoceros hornbill: round chubby body in deep navy-black, white belly, big expressive eyes, a large curved orange-and-yellow beak with a red-orange casque on top, short wings that work like hands.'
const C = `Modern playful 3D-ish flat illustration with soft rounded shapes and bold clean colors, like a friendly mobile-app mascot. Palette: bright leaf green (#3cb371), sunny yellow (#ffc83d), sky blue (#4aa8ff), coral (#ff6b5a), on clean off-white (#fafaf7). ${HORNBILL} ${NO_TEXT}`

const PROMPTS = [
  { name: 'a-hero', size: '1536x1024', prompt: `${A} A wide view of a quiet old Kuala Lumpur street at morning: colonial shophouses with arched five-foot-way corridors, the copper domes of the Sultan Abdul Samad Building in the distance, a few palm trees. In the foreground on the right, an open hardcover book lying on a wooden desk with a fountain pen. Leave the left 40% of the image as calm empty paper for a headline.` },
  { name: 'a-books', size: '1024x1024', prompt: `${A} Still life: a neat stack of three hardcover language textbooks, a small brass desk bell, a frangipani flower resting on top, and a pair of round reading glasses. Centered, generous empty margins.` },
  { name: 'a-ornament', size: '1536x1024', prompt: `${A} A single horizontal decorative ornament band inspired by Malay songket textile and wood-carving (ukiran) motifs: symmetrical floral and leaf scrolls, centered, on plain cream paper. Thin and elegant, used as a section divider.` },
  { name: 'b-hero', size: '1536x1024', prompt: `${B} A row of colourful Penang Peranakan shophouses with patterned tile facades, wooden shutters, hanging lanterns and potted plants; frangipani and banana leaves frame the scene. A young student walks by holding a smartphone. Leave the left 40% as a calm cream area with only soft leaf shadows, for a headline.` },
  { name: 'b-tile', size: '1024x1024', prompt: `${B} A seamless square Peranakan ceramic tile pattern: four-way symmetric floral medallion with peony and leaf shapes, crisp edges, flat colours, suitable to repeat as a background pattern.` },
  { name: 'b-kopitiam', size: '1024x1024', prompt: `${B} Top-down view of a marble kopitiam table: a glass of teh tarik with froth, a plate of colourful kuih lapis and onde-onde, a bowl of mee, a small dish of tauhu, chopsticks and a spoon. Centered, cheerful, appetizing.` },
  { name: 'c-hero', size: '1536x1024', prompt: `${C} The hornbill mascot stands on the right side waving happily with one wing, holding a smartphone with the other wing; around it float a few rounded speech-bubble shapes (empty, no text) and small leaves. Leave the left 40% clean for a headline.` },
  { name: 'c-study', size: '1024x1024', prompt: `${C} The same hornbill mascot sits cross-legged reading a book, with a few blank flashcards floating around it and a small tropical plant beside it. Centered, plain background.` },
  { name: 'c-cheer', size: '1024x1024', prompt: `${C} The same hornbill mascot jumps with joy, wings up, confetti and small stars around it, celebrating finishing a lesson. Centered, plain background.` },
]

const only = process.argv.slice(2)
const todo = only.length ? PROMPTS.filter(p => only.some(o => p.name.startsWith(o))) : PROMPTS

async function submit(prompt, size) {
  const r = await fetch(`${BASE}/v1/media/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-2', prompt, size, quality: 'standard', n: 1 }),
  })
  const d = await r.json()
  const tid = d?.data?.task_id
  if (!tid) throw new Error('没拿到 task_id: ' + JSON.stringify(d))
  return tid
}

async function poll(tid, label) {
  for (let i = 0; i < 80; i++) {
    await new Promise(s => setTimeout(s, 3000))
    const d = await (await fetch(`${BASE}/v1/media/status?task_id=${tid}`, { headers: { Authorization: `Bearer ${KEY}` } })).json()
    if (d.is_final) {
      if (d.state === 'success' && d.result_url) return d.result_url
      throw new Error(`${label} 失败: ${d.error || d.status}`)
    }
  }
  throw new Error(`${label} 超时`)
}

const results = await Promise.all(todo.map(async p => {
  try {
    const url = await poll(await submit(p.prompt, p.size), p.name)
    const dir = join(HERE, '生成图', p.name.split('-')[0])
    mkdirSync(dir, { recursive: true })
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
    writeFileSync(join(dir, `${p.name}.png`), buf)
    return `✅ ${p.name} (${(buf.length / 1024).toFixed(0)} KB)`
  } catch (e) {
    return `❌ ${p.name}: ${e.message}`
  }
}))
console.log(results.join('\n'))
