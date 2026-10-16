// 单词学习:新学(learning)和复习(review)共用一套接口。
// 每次操作都要带当前词的 itemConcurrencyStamp,用最新返回的 session 里的值。
const http = require('./request')
const { qs } = http

const base = (mode, id) => `/word-study/${mode}/sessions/${id}`

module.exports = {
  learningOverview: () => http.get('/word-study/learning/overview'),
  reviewOverview: () => http.get('/word-study/review/overview'),
  start: mode => http.post(`/word-study/${mode}/sessions`),
  get: (mode, id) => http.get(base(mode, id)),
  rate: (mode, id, item, result) => http.post(`${base(mode, id)}/items/${item.itemId}/memorization`, { result, itemConcurrencyStamp: item.itemConcurrencyStamp }),
  // 跳过时也要传 answer:""
  spell: (mode, id, item, answer, skip) => http.post(`${base(mode, id)}/items/${item.itemId}/spelling`, { answer: skip ? '' : answer, skip, itemConcurrencyStamp: item.itemConcurrencyStamp }),
  exclude: (id, item) => http.post(`${base('review', id)}/items/${item.itemId}/exclude`, { itemConcurrencyStamp: item.itemConcurrencyStamp }),
  summary: (mode, id, skipSpelling) => http.post(`${base(mode, id)}/summary`, { skipSpelling }),
  toSpelling: (mode, id) => http.post(`${base(mode, id)}/spelling`),
  more: id => http.post(`${base('learning', id)}/more`),
  results: (mode, id) => http.get(`${base(mode, id)}/results`),
  today: (page = 1, pageSize = 20) => http.get(`/word-study/review/today${qs({ page, pageSize })}`),
  checkIns: (year, month) => http.get(`/word-study/check-ins${qs({ year, month })}`)
}
