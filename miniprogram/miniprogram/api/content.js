// 文章、视频、音频播放地址。
const http = require('./request')
const { qs } = http

module.exports = {
  articles: (p = {}) => http.get(`/articles${qs({ page: p.page || 1, pageSize: p.pageSize || 20, categoryId: p.categoryId, keyword: p.keyword })}`),
  article: id => http.get(`/articles/${id}`),
  articleCategories: () => http.get(`/article-categories${qs({ page: 1, pageSize: 100 })}`),
  videos: (p = {}) => http.get(`/videos${qs({ page: p.page || 1, pageSize: p.pageSize || 20, categoryId: p.categoryId, keyword: p.keyword })}`),
  video: id => http.get(`/videos/${id}`),
  videoCategories: () => http.get(`/video-categories${qs({ page: 1, pageSize: 100 })}`),
  videoPlayback: id => http.post(`/videos/${id}/playback`),
  saveVideoProgress: (id, positionSeconds) => http.put(`/videos/${id}/progress`, { positionSeconds }),
  // 音频地址 5 分钟过期,每次播放前现取
  audioPlayback: id => http.post(`/audio/${id}/playback`)
}
