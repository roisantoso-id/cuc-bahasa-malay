// 测评页用的三个犀鸟姿势（banana-pro），纯绿底方便抠图：node design/placement-v1/gen-poses.cjs（WSL）
// 之后 python3 design/placement-v1/cut.py 抠透明、切成三张、转 webp 放进 miniprogram/pkg-word/placement/img/
const fs = require('fs')
const path = require('path')
const os = require('os')
const banana = require(path.join(os.homedir(), 'Projects/kalbu/scripts/banana.cjs'))
const A = path.join(__dirname, '../../miniprogram/miniprogram/assets')
const refs = ['bird-hero.png', 'cheer.jpg'].map(f => fs.readFileSync(path.join(A, f)))

const prompt = `Character sheet of the SAME mascot as the reference images: a cute 3D clay hornbill (big yellow beak, red-orange casque, navy-black body, white belly, orange feet, glossy clay render, soft studio light).
Draw exactly THREE separate poses in one row, evenly spaced with wide empty gaps between them, each pose fully inside the frame and not touching each other:
1 (left): standing, holding an open folded paper map with both wings, looking up hopefully, slight smile.
2 (middle): peeking over an invisible horizontal edge: only the head, neck and both wing tips gripping the edge are visible; the bottom of the drawing is cut by a perfectly straight horizontal line (as if the body is hidden behind a card). Curious, head slightly tilted.
3 (right): jumping with both wings raised high, beak open happily, feet off the ground, celebrating.
Background: one perfectly flat solid pure green color #00FF00 everywhere. No shadows on the background, no ground, no confetti, no text, no outlines around the character, no green tint on the character.`

;(async () => {
  const buf = await banana.generate(prompt, { refs, aspectRatio: '16:9', imageSize: '2K' })
  fs.writeFileSync(path.join(__dirname, 'poses-green.png'), buf)
  console.log('saved poses-green.png', buf.length)
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
