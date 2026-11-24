// 听起来像的干扰项：听音选词、看义选词不再随便抽三个词（马来语词彼此差得远，一听就排除），
// 而是挑拼写 / 发音最接近的词，比如 makan → makam / masak / makanan。
//
// 打分（越小越像）：
//   1. 整词编辑距离，按长度归一
//   2. 去掉常见词缀（me-/ber-/di-/ter-/pe-…，-kan/-an/-i/-nya）后的词根编辑距离
//   3. 开头两个字母一样、结尾两个字母一样各减一点；长度差太多加一点
// 词表缓存在内存里，后台改了词（审核、改拼写）10 分钟内生效。

const PRE = ['memper', 'mempel', 'menge', 'meny', 'meng', 'mem', 'men', 'me', 'ber', 'be', 'di', 'ter', 'te', 'peng', 'pem', 'pen', 'per', 'pe', 'ke', 'se']
const SUF = ['kannya', 'annya', 'kan', 'nya', 'an', 'i', 'lah', 'kah']
const norm = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '')

export function rootOf(w) {
  let s = norm(w)
  for (const p of PRE) if (s.length - p.length >= 3 && s.startsWith(p)) { s = s.slice(p.length); break }
  for (const x of SUF) if (s.length - x.length >= 3 && s.endsWith(x)) { s = s.slice(0, -x.length); break }
  return s
}

export function lev(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

export function score(a, b) {
  const x = norm(a), y = norm(b)
  const ra = rootOf(a), rb = rootOf(b)
  let s = lev(x, y) / Math.max(x.length, y.length) + 0.6 * lev(ra, rb) / Math.max(ra.length, rb.length, 1)
  if (x.slice(0, 2) === y.slice(0, 2)) s -= 0.15
  if (x.slice(-2) === y.slice(-2)) s -= 0.15
  if (Math.abs(x.length - y.length) > 3) s += 0.3
  return s
}

// words: [{ rank, ms, zh }]。返回 pick(word, n) → 最像的 n 个（不含自己、不含拼写相同或意思相同的词）
// 从最像的前 n+3 个里随机挑 n 个，同一个词每次考的干扰项不完全一样
export function makeAlike(words) {
  const cache = new Map()
  return function pick(w, n = 3, rnd = Math.random) {
    let top = cache.get(w.rank)
    if (!top) {
      const me = norm(w.ms)
      const root = rootOf(w.ms)
      let sameRoot = 0
      top = []
      // 不要专有名词（Makkah、Perlis）；同词根的变形（makan → makanan）最多留一个，不然四个选项全是一家
      for (const [, o] of words
        .filter(o => o.rank !== w.rank && norm(o.ms) !== me && o.zh && o.zh !== w.zh && !/^[A-Z]/.test(o.ms) && !/\s/.test(o.ms) === !/\s/.test(w.ms))
        .map(o => [score(w.ms, o.ms), o])
        .sort((p, q) => p[0] - q[0])) {
        if (rootOf(o.ms) === root && sameRoot++) continue
        top.push(o)
        if (top.length >= n + 3) break
      }
      cache.set(w.rank, top)
    }
    return top.map(o => [rnd(), o]).sort((p, q) => p[0] - q[0]).slice(0, n).map(p => p[1])
  }
}

// 带缓存的取法：loader 返回全部已审核的词 [{ rank, ms, zh }]
export function alikeSource(loader, ttl = 10 * 60e3) {
  let at = 0, pick = null, busy = null
  return async () => {
    if (pick && Date.now() - at < ttl) return pick
    if (!busy) busy = loader().then(ws => { pick = makeAlike(ws); at = Date.now(); busy = null; return pick }, e => { busy = null; throw e })
    return busy
  }
}
