// 上传头像:申请签名地址 → PUT 原始文件 → 确认 → 更新资料时带上资源 ID。
const http = require('./request')
const config = require('../config')

const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }

async function uploadAvatar(filePath, size) {
  const extension = (filePath.split('.').pop() || 'jpg').toLowerCase()
  const contentType = TYPES[extension] || 'image/jpeg'
  const { resourceId, presignedUrl } = await http.post('/uploads/users/avatar/presign', { originalName: `avatar.${extension}`, extension, contentType, size })
  if (!config.useMock) {
    const body = wx.getFileSystemManager().readFileSync(filePath)
    await new Promise((resolve, reject) => wx.request({
      url: presignedUrl, method: 'PUT', data: body, header: { 'Content-Type': contentType },
      success: r => (r.statusCode < 300 ? resolve() : reject(new Error('上传失败'))), fail: reject
    }))
  }
  await http.put(`/uploads/resources/${resourceId}/confirm`)
  return resourceId
}

module.exports = { uploadAvatar }
