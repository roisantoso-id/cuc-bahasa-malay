// 小程序配置。上线前:useMock 改 false,apiBase 确认是线上接口地址。
module.exports = {
  // JomBelajar 后端地址(接口都在 /api 下)
  apiBase: 'https://www.bahasa.cn/api',
  // true = 用本地演示数据,不请求后端;没有测试账号、后端还没支持微信登录时用
  useMock: true,
  // 后端加好 POST /auth/wechat 之后改成 true,登录页才显示「微信一键登录」
  wechatLogin: false
}
