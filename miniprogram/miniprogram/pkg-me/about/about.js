// 关于我们 / 研发团队:和官网 /about/ 内容一致
const BOOKS = [
  { img: 'tongyuan', role: '专著', title: '同源异流', pub: '光明日报出版社' },
  { img: 'warisan', role: '马来文专著', title: 'Warisan Kebudayaan Minangkabau', pub: 'Akar Indonesia' },
  { img: 'poems', role: '译著', title: '马来西亚诗选', pub: '作家出版社' },
  { img: 'newspaper', role: '教材', title: '马来语报刊选读', pub: '世界图书出版公司' },
  { img: 'literature', role: '教材', title: '新经典马来文学史教程', pub: '外语教学与研究出版社' },
  { img: 'writing', role: '教材', title: '马来语写作教程', pub: '中国传媒大学出版社' }
]

Page({
  data: { books: BOOKS },
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
