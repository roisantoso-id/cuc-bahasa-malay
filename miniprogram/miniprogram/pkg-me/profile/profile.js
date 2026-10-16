// 个人资料:头像(png/jpg/gif/webp,不超过 5MB)、昵称(60 字内)、简介(500 字内)
const { user, upload } = require('../../api/index')
const fmt = require('../../utils/format')

Page({
  data: { me: null, nickname: '', bio: '', avatar: '', avatarId: '', busy: false, joined: '' },
  async onLoad() {
    try {
      const me = await user.me()
      this.setData({ me, nickname: me.nickname || '', bio: me.bio || '', avatar: me.avatarUrl || '', joined: fmt.date(me.createdAt) })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    }
  },
  onNick(e) { this.setData({ nickname: e.detail.value }) },
  onBio(e) { this.setData({ bio: e.detail.value }) },
  chooseAvatar() {
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sizeType: ['compressed'],
      success: async r => {
        const f = r.tempFiles[0]
        if (f.size > 5 * 1024 * 1024) { wx.showToast({ title: '头像不能超过 5MB', icon: 'none' }); return }
        wx.showLoading({ title: '上传中' })
        try {
          const id = await upload.uploadAvatar(f.tempFilePath, f.size)
          this.setData({ avatar: f.tempFilePath, avatarId: id })
          wx.showToast({ title: '头像已上传，请保存资料以应用。', icon: 'none' })
        } catch (e) {
          wx.showToast({ title: e.message || '上传失败', icon: 'none' })
        } finally {
          wx.hideLoading()
        }
      }
    })
  },
  async save() {
    this.setData({ busy: true })
    try {
      const body = { nickname: this.data.nickname.trim() || null, bio: this.data.bio.trim() || null }
      if (this.data.avatarId) body.avatarMediaResourceId = this.data.avatarId
      await user.updateProfile(body)
      wx.showToast({ title: '个人资料已保存。', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
  }
})
