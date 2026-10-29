// 关于我们 / 研发团队:和官网 /about/ 内容一致
const BOOKS = [
  { img: 'tongyuan', role: '专著', title: '同源异流', pub: '光明日报出版社' },
  { img: 'warisan', role: '马来文专著', title: 'Warisan Kebudayaan Minangkabau', pub: 'Akar Indonesia' },
  { img: 'poems', role: '译著', title: '马来西亚诗选', pub: '作家出版社' },
  { img: 'newspaper', role: '教材', title: '马来语报刊选读', pub: '世界图书出版公司' },
  { img: 'literature', role: '教材', title: '新经典马来文学史教程', pub: '外语教学与研究出版社' },
  { img: 'writing', role: '教材', title: '马来语写作教程', pub: '中国传媒大学出版社' }
]

const vocab = require('../../api/vocab')

Page({
  data: { books: BOOKS, lead: null, others: [] },
  async onLoad() {
    try {
      const list = await vocab.teachers()
      const withUrl = await Promise.all(list.map(async t => ({ ...t, photoUrl: await vocab.fileUrl(t.photo) })))
      this.setData({ lead: withUrl[0] || null, others: withUrl.slice(1) })
    } catch (e) { /* 拿不到就只显示书架和技术支持 */ }
  },
  preview(e) {
    const urls = BOOKS.map(b => `/pkg-me/img/${b.img}.jpg`)
    wx.previewImage({ current: urls[e.currentTarget.dataset.i], urls })
  },
  previewLive() {
    wx.previewImage({ urls: ['/pkg-me/img/rtm-live.jpg'] })
  },
  copyLink(e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.url })
  }
})
