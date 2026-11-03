// 小程序配置。
// vocabApi:背单词服务(admin/server.mjs,docker compose 部署在腾讯云广州)。
//   本机调试:先按 admin/README.md 起服务,这里填 http://127.0.0.1:4200,开发者工具勾选「不校验合法域名」;
//   上线:填 https://admin.bahasa.cn,并在公众平台把它加进 request 合法域名。
// apiBase / wechatLogin / useMock:旧的 JomBelajar 接口(阅读、测试等功能),第一版没有启用。
module.exports = {
  vocabApi: 'http://127.0.0.1:4200',
  apiBase: '',
  useMock: true,
  wechatLogin: false
}
