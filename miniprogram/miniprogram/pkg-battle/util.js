// 对战分包共用的小工具：用时格式、题型说明、复盘列表整理
const fmtMs = ms => {
  const s = Math.round((Number(ms) || 0) / 100) / 10
  if (s < 60) return s.toFixed(1) + ' 秒'
  const m = Math.floor(s / 60)
  const r = Math.round(s - m * 60)
  return `${m} 分 ${r < 10 ? '0' + r : r} 秒`
}
const KIND = { ms2zh: '选中文意思', zh2ms: '选马来语', audio2ms: '听音选词' }
// 周一日期 2026-11-16 → 11月16日
const fmtWeek = w => (w ? `${Number(w.slice(5, 7))}月${Number(w.slice(8, 10))}日` : '')

// 复盘：picked 是我选的下标（-1 没答）；answer 只有公布答案时才有；right 没给时用 answer 算
function review(items) {
  return (items || []).map((q, i) => {
    const hasAnswer = Number.isInteger(q.answer)
    const picked = Number.isInteger(q.picked) ? q.picked : -1
    const ok = typeof q.right === 'boolean' ? q.right : hasAnswer && picked === q.answer
    return {
      no: i + 1,
      type: q.type,
      kind: KIND[q.type] || '',
      prompt: q.prompt,
      audio: q.audio,
      ok,
      pickedText: picked >= 0 ? q.options[picked] : '',
      answerText: hasAnswer ? q.options[q.answer] : ''
    }
  })
}

module.exports = { fmtMs, fmtWeek, KIND, review }
