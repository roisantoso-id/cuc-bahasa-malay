// 入门测评三屏效果图（banana-pro，走 Vertex）：node design/placement-v1/gen.cjs（在 WSL 里跑，服务账号在 ~/.config/macloud）
// 参考图：现有犀鸟吉祥物（保持人物一致），设计系统沿用 design/mp-v3「词光夜航」
const fs = require('fs')
const path = require('path')
const os = require('os')
const banana = require(path.join(os.homedir(), 'Projects/kalbu/scripts/banana.cjs'))
const A = path.join(__dirname, '../../miniprogram/miniprogram/assets')
const refs = ['bird-hero.png', 'cheer.jpg'].map(f => fs.readFileSync(path.join(A, f)))

const prompt = `UI design mockup for a WeChat mini program that teaches Chinese speakers Malay vocabulary ("JomBelajar · 马来语高频词").
Show THREE iPhone screens side by side on a soft warm-grey studio background, flat front view, crisp UI, pixel-perfect, like a Dribbble shot. All UI text in Simplified Chinese except Malay words.

Keep the mascot EXACTLY like the reference images: a cute 3D clay hornbill with a big yellow beak, red-orange casque, navy-black body, white belly, orange feet. Same character on every screen, different poses. The mascot is part of the layout (peeking over cards, sitting on the progress bar, holding things), not a sticker in a corner.

Design system "词光夜航" (night voyage): deep teal-black background #0a1f22 with faint stars, ivory cards #f3ead6 with dark ink text, amber accent #e9b961, mint green #8fc8a0 for correct, coral #e8836a sparingly. Malay words in an elegant italic serif (Georgia italic). Chinese headings in a refined Song serif. Rounded 16px cards, pill buttons, generous spacing, soft glows. Playful and alive like Duolingo, but more elegant; no clutter, no emoji.

Screen 1 — 测评开始: the hornbill stands on a winding night path that climbs 5 glowing stepping stones labeled 入门 初级 中级 中高级 高级 (like stations on a journey), holding a small map. Speech bubble from the bird: "先测测你认识多少词，3 分钟就好". Title "找到你的起点". Big ivory pill button at bottom "开始测评 →", small text link under it "先跳过，从入门学起".

Screen 2 — 答题: top: thin progress bar with a tiny glowing star at the fill end, right side "8 / 30". A small amber chip "第 2 档 · 初级  3/6". Center: a large ivory card showing the Malay word "makanan" in big italic serif with a round speaker button; the hornbill peeks over the top edge of the card, curious, one wing on the card. Below: four answer rows (ivory outline, rounded): "A 食物", "B 学校", "C 衣服", "D 天气", one row (A) gently highlighted in amber as selected, plus a dashed-outline row "不认识". Tiny caption: "选你最确定的，不会就选不认识".

Screen 3 — 测评结果: confetti; the hornbill jumps with wings up (like the cheer reference). A round amber stamp tilted: "推荐 · 中级". Big number "1,000" with caption "估算你认识的高频词". A 5-step staircase chart: 入门 ✓ 初级 ✓ glowing mint, 中级 highlighted amber with a small flag "从这里学", 中高级 高级 dim. Short line: "答错的词会最先推给你，学得顺会自动升一档". Ivory pill button "从中级开始学 →", text link "再测一次".`

;(async () => {
  const buf = await banana.generate(prompt, { refs, aspectRatio: '16:9', imageSize: '2K' })
  const out = path.join(__dirname, 'mockup-1.png')
  fs.writeFileSync(out, buf)
  console.log('saved', out, buf.length)
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
