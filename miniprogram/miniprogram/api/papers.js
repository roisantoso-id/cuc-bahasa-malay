// 在线测试和错题本。
const http = require('./request')
const { qs } = http

module.exports = {
  list: (p = {}) => http.get(`/papers${qs({ page: p.page || 1, pageSize: p.pageSize || 20, categoryId: p.categoryId, keyword: p.keyword })}`),
  categories: () => http.get(`/paper-categories${qs({ page: 1, pageSize: 100 })}`),
  detail: id => http.get(`/papers/${id}`),
  start: id => http.post(`/papers/${id}/attempts`),
  attempt: id => http.get(`/paper-attempts/${id}`),
  // answer 只放一个字段:selectedOptionId / booleanAnswer / textAnswer / textAnswers
  saveAnswer: (attemptId, questionId, answer) => http.put(`/paper-attempts/${attemptId}/answers/${questionId}`, answer),
  clearAnswer: (attemptId, questionId) => http.del(`/paper-attempts/${attemptId}/answers/${questionId}`),
  submit: id => http.post(`/paper-attempts/${id}/submit`),
  result: id => http.get(`/paper-attempts/${id}/result`),
  wrongList: (status = 'Pending', page = 1, pageSize = 50) => http.get(`/paper-wrong-questions${qs({ status, page, pageSize })}`),
  wrongDetail: id => http.get(`/paper-wrong-questions/${id}`),
  redo: (id, answer) => http.post(`/paper-wrong-questions/${id}/redo`, answer)
}
