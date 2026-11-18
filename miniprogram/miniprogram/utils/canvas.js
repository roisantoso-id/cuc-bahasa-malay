// canvas 2d 取节点 + 按像素比缩放；cb(ctx, width, height) 里直接用 css 像素画
const dpr = () => { try { return wx.getWindowInfo().pixelRatio || 2 } catch (e) { return 2 } }
function draw(page, sel, cb) {
  wx.createSelectorQuery().in(page).select(sel).fields({ node: true, size: true }).exec(res => {
    const r = res && res[0]
    if (!r || !r.node) return
    const ratio = dpr()
    const canvas = r.node
    canvas.width = r.width * ratio
    canvas.height = r.height * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.clearRect(0, 0, r.width, r.height)
    cb(ctx, r.width, r.height)
  })
}
module.exports = { draw }
