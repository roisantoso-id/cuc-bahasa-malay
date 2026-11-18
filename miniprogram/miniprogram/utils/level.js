// 从 levels（每站 total / learned / stamped / open）算出当前站和这一站的进度，给头像外圈和 L 小标用
module.exports = function lvOf(levels) {
  const list = levels || []
  const cur = list.find(l => l.open && !l.stamped) || list.filter(l => l.open).pop() || list[0]
  if (!cur) return { level: 1, pct: 0 }
  return { level: cur.level, pct: cur.total ? Math.round(cur.learned / cur.total * 100) : 0 }
}
