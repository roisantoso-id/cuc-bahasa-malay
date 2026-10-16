// 个人资料、学习设置、收藏本、停止复习的词、账户安全。
const http = require('./request')
const { qs } = http

module.exports = {
  me: () => http.get('/users/me'),
  updateProfile: body => http.put('/users/me/profile', body), // {nickname, avatarMediaResourceId, bio}
  getStudySettings: () => http.get('/users/me/word-study-settings'),
  // 三个字段必须都传,漏传 desiredRetention 会被重置成 0.9
  saveStudySettings: s => http.put('/users/me/word-study-settings', {
    dailyWordStudyCount: s.dailyWordStudyCount,
    dailyWordReviewCount: s.dailyWordReviewCount,
    desiredRetention: s.desiredRetention
  }),
  favorites: (page = 1, pageSize = 20) => http.get(`/users/me/word-favorites${qs({ page, pageSize })}`),
  addFavorite: wordId => http.put(`/users/me/word-favorites/${wordId}`),
  removeFavorite: wordId => http.del(`/users/me/word-favorites/${wordId}`),
  exclusions: (page = 1, pageSize = 20) => http.get(`/users/me/word-review-exclusions${qs({ page, pageSize })}`),
  restoreExclusion: wordId => http.del(`/users/me/word-review-exclusions/${wordId}`),
  resetPassword: (newPassword, verificationCode) => http.put('/users/me/reset-password', { newPassword, verificationCode }),
  changeEmail: (newEmail, verificationCode) => http.put('/users/me/change-email', { newEmail, verificationCode }),
  deleteAccount: verificationCode => http.del('/users/me/delete-account', { verificationCode })
}
