// 显示用的小工具:词性、复习间隔、日期、题型。
const POS = { Noun: '名词', Verb: '动词', Adjective: '形容词', Adverb: '副词', Pronoun: '代词', Determiner: '限定词', Preposition: '介词', Conjunction: '连词', Interjection: '感叹词', Numeral: '数词', Particle: '助词', Other: '其他' }
const QTYPE = { SingleChoice: '单选题', TrueFalse: '判断题', FillBlank: '填空题', Dictation: '听写题' }
const RATING = { Again: '重来', Hard: '困难', Good: '良好', Easy: '简单' }

function interval(sec) {
  if (sec === undefined || sec === null) return '待计算'
  if (sec < 60) return `${Math.round(sec)} 秒`
  if (sec < 3600) return `${Math.round(sec / 60)} 分钟`
  if (sec < 86400) return `${Math.round(sec / 3600)} 小时`
  return `${Math.round(sec / 86400)} 天`
}

function date(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function duration(sec) {
  const s = Math.round(sec || 0)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// 给义项加中文词性
const senses = list => (list || []).map(s => ({ ...s, posLabel: POS[s.partOfSpeech] || s.partOfSpeech }))

module.exports = { POS, QTYPE, RATING, interval, date, duration, senses }
