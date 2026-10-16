// 学习数据。第一版存在手机本地(wx storage);接云开发后把这几个函数改成读写云数据库即可,页面不用动。
const courses = require('../data/courses')

// 单词复习:盒子 0–6,对应下次复习间隔(天)
const INTERVALS = [0, 1, 2, 4, 7, 15, 30]

const today = (offset = 0) => {
  const d = new Date(Date.now() + offset * 86400000)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const get = (k, def) => {
  const v = wx.getStorageSync(k)
  return v === '' || v === undefined ? def : v
}
const set = (k, v) => wx.setStorageSync(k, v)

function getTrack() { return get('track', '') }
function setTrack(track) { set('track', track) }

function coursesFor(track) { return courses.filter(c => c.track === track) }

function findLesson(id) {
  for (const c of courses) {
    const l = c.lessons.find(x => x.id === id)
    if (l) return l
  }
  return null
}

// { [lessonId]: { score, at } }
function getDone() { return get('done', {}) }

function nextLesson(track) {
  const done = getDone()
  for (const c of coursesFor(track)) {
    const l = c.lessons.find(x => !done[x.id])
    if (l) return l
  }
  return null
}

// 学完一课:记成绩,生词放进复习
function finishLesson(lessonId, score) {
  const done = getDone()
  done[lessonId] = { score, at: today() }
  set('done', done)
  const reviews = get('reviews', {})
  for (const w of findLesson(lessonId).words) {
    if (!reviews[w.ms]) reviews[w.ms] = { box: 0, due: today(1), zh: w.zh }
  }
  set('reviews', reviews)
  markDay()
}

function dueWords() {
  const reviews = get('reviews', {})
  const t = today()
  return Object.keys(reviews).filter(ms => reviews[ms].due <= t).map(ms => ({ ms, zh: reviews[ms].zh }))
}

// grade: 0 忘了 / 1 模糊 / 2 记得
function gradeWord(ms, grade) {
  const reviews = get('reviews', {})
  const r = reviews[ms]
  if (!r) return
  if (grade === 0) r.box = 0
  else if (grade === 2) r.box = Math.min(r.box + 1, INTERVALS.length - 1)
  r.due = today(grade === 0 ? 0 : Math.max(INTERVALS[r.box], 1))
  set('reviews', reviews)
  markDay()
}

function markDay() {
  const days = get('days', [])
  if (days[days.length - 1] !== today()) {
    days.push(today())
    set('days', days)
  }
}

function stats() {
  return {
    days: get('days', []).length,
    lessons: Object.keys(getDone()).length,
    words: Object.keys(get('reviews', {})).length
  }
}

module.exports = { getTrack, setTrack, coursesFor, findLesson, getDone, nextLesson, finishLesson, dueWords, gradeWord, stats }
