// 测评页的整幅场景图（banana-pro）：开始页的星空 + 发光小路 + 五块 3D 石板（不带字，字由页面叠上去），
// 答题 / 结果页共用的星空底。node design/placement-v1/gen-scene.cjs（WSL）
const fs = require('fs')
const path = require('path')
const os = require('os')
const banana = require(path.join(os.homedir(), 'Projects/kalbu/scripts/banana.cjs'))
const mock = fs.readFileSync(path.join(__dirname, 'mockup-1.png'))

const STYLE = `Same art direction as the reference UI mockup (left screen): deep teal-black night (#0a1f22 to #0d2a2e), tiny soft stars, warm amber glow (#e9b961), ivory (#f3ead6) stone slabs with soft 3D clay render, gentle depth of field. Elegant, calm, premium mobile game feel. No text, no letters, no numbers, no characters, no UI elements, no phone frame.`

const jobs = [
  {
    out: 'scene-intro.png', aspectRatio: '3:4',
    prompt: `${STYLE}
Illustration for the background of a mobile screen (portrait 3:4). A winding glowing path made of tiny golden light dots climbs from the lower right up to the top. Along the path sit exactly FIVE thick rounded-rectangle ivory stone slabs, seen slightly from above, each with a soft warm glow underneath, blank flat tops:
slab 1 (largest, closest) lower right, around 72% from left and 80% from top;
slab 2 middle left, around 28% from left and 60% from top;
slab 3 middle right, around 70% from left and 42% from top;
slab 4 (smaller, farther, dimmer) upper left, around 32% from left and 25% from top;
slab 5 (smallest, farthest, dimmest) top right, around 64% from left and 9% from top.
Keep the lower-left corner (left 45%, bottom 25%) empty dark ground with faint mist (a mascot will stand there). Slabs are clearly separated, the same ivory color, no carvings.`
  },
  {
    out: 'bg-stars.png', aspectRatio: '9:16',
    prompt: `${STYLE}
Very subtle full-screen background for a mobile app (portrait 9:16): deep teal-black gradient, sparse tiny stars, two faint soft amber glows (one top center, one lower right), faint mist at the bottom. Mostly empty and dark so ivory cards and text on top stay readable. Nothing else.`
  }
]

;(async () => {
  for (const j of jobs) {
    const buf = await banana.generate(j.prompt, { refs: [mock], aspectRatio: j.aspectRatio, imageSize: '2K' })
    fs.writeFileSync(path.join(__dirname, j.out), buf)
    console.log('saved', j.out, buf.length)
  }
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
