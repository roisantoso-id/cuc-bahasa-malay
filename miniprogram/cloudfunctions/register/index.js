// 学生注册 / 修改资料:姓名、学校、班级、起点、手机号
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const clean = (s, max) => String(s || '').trim().slice(0, max)

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const data = {
    name: clean(event.name, 30),
    school: clean(event.school, 60),
    className: clean(event.className, 40),
    track: event.track === 'heritage' ? 'heritage' : 'zero',
    phone: clean(event.phone, 20)
  }
  if (!data.name) return { ok: false, error: '请填写姓名或昵称' }
  if (!data.school) return { ok: false, error: '请填写学校' }
  if (!/^1\d{10}$|^\+?\d{8,15}$/.test(data.phone.replace(/[\s-]/g, ''))) return { ok: false, error: '手机号格式不对' }
  if (!event.agree) return { ok: false, error: '请先阅读并同意隐私保护指引' }

  const col = db.collection('students')
  const { data: found } = await col.where({ _openid: OPENID }).limit(1).get()
  if (found[0]) {
    await col.doc(found[0]._id).update({ data: { ...data, lastActiveAt: db.serverDate() } })
  } else {
    // 云函数里写入要自己带 _openid,这样「仅创建者可读写」的权限对小程序端也成立
    await col.add({ data: { ...data, _openid: OPENID, createdAt: db.serverDate(), lastActiveAt: db.serverDate() } })
  }
  const { data: me } = await col.where({ _openid: OPENID }).limit(1).get()
  return { ok: true, student: me[0] }
}
