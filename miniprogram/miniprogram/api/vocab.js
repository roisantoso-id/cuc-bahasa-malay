// 背单词接口:有云环境走云函数,没有就用本地演示数据(api/mock/vocab.js)。页面只调这里。
const config = require('../config')
const mock = require('./mock/vocab')

const cloudOn = () => !!(config.cloudEnv && wx.cloud)

async function call(name, data = {}) {
  if (!cloudOn()) return mock.call(name, data)
  const { result } = await wx.cloud.callFunction({ name, data })
  if (result && result.error) throw new Error(result.error)
  return result
}

let me = null // 当前学生资料(内存缓存)

module.exports = {
  isCloud: cloudOn,
  async login(force) {
    if (me && !force) return me
    const r = await call('login')
    me = { openid: r.openid, student: r.student }
    return me
  },
  async register(form) {
    const r = await call('register', form)
    if (!r.ok) throw new Error(r.error)
    me = { ...(me || {}), student: r.student }
    return r.student
  },
  overview: () => call('study', { action: 'overview' }),
  sceneWords: sceneId => call('study', { action: 'words', sceneId }),
  start: (sceneId, reviewOnly) => call('study', { action: 'start', sceneId, reviewOnly }),
  grade: (wordId, sceneId, result) => call('study', { action: 'grade', wordId, sceneId, result }),
  // 老师信息:公共集合,小程序直接读
  async teachers() {
    if (!cloudOn()) return mock.teachers()
    const { data } = await wx.cloud.database().collection('teachers').orderBy('order', 'asc').get()
    return data
  },
  // 云存储里的音频 / 图片(cloud:// 开头)换成临时地址
  async fileUrl(fileID) {
    if (!fileID) return ''
    if (!/^cloud:\/\//.test(fileID)) return fileID
    const { fileList } = await wx.cloud.getTempFileURL({ fileList: [fileID] })
    return (fileList[0] && fileList[0].tempFileURL) || ''
  }
}
