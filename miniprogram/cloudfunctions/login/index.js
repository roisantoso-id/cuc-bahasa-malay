// 登录:返回 openid 和学生资料(没注册时 student 为 null)
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const { data } = await db.collection('students').where({ _openid: OPENID }).limit(1).get()
  if (data[0]) await db.collection('students').doc(data[0]._id).update({ data: { lastActiveAt: db.serverDate() } })
  return { openid: OPENID, student: data[0] || null }
}
