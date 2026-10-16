// 登录:返回当前用户的 openid,首次登录时建用户记录。接云开发后,小程序用 wx.cloud.callFunction({ name: 'login' }) 调用。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  const users = db.collection('users')
  const { data } = await users.where({ openid: OPENID }).limit(1).get()
  if (!data.length) {
    await users.add({ data: { openid: OPENID, track: '', createdAt: db.serverDate() } })
  }
  return { openid: OPENID, user: data[0] || null }
}
