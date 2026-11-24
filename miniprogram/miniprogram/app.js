// 白天 / 夜晚主题：先包一层 Page()，每页自动带 data.th（utils/theme.js）
require('./utils/theme').wrapPage()
App({
  // dirty:学完一组 / 改了设置后置 true,首页 onShow 时刷新
  globalData: { dirty: true },
  onLaunch() {
    // iPhone 打开静音开关时也要能听到单词发音（新版微信只认这个全局设置，播放器上的 obeyMuteSwitch 已经不管用）
    if (wx.setInnerAudioOption) wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true })
  }
})
