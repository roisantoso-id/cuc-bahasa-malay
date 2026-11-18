// 学生身份：微信登录即可，服务端第一次登录会自动建学生，不用先注册。
// 姓名、学校等资料在「我的 → 完善资料」里选填。
const vocab = require('../api/vocab')

async function ensureStudent() {
  const me = await vocab.login()
  return me.student || {}
}
module.exports = { ensureStudent }
