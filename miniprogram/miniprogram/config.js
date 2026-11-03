// 小程序配置。
// vocabApi:背单词服务(admin/server.mjs,docker compose 部署在腾讯云广州)。
//   本机调试:先按 admin/README.md 起服务(DEMO=1),这里改成 http://127.0.0.1:4200;
//   线上:https://api.bahasa.cn(公众平台 request 合法域名里要加上它)。
// apiBase / wechatLogin / useMock:旧的 JomBelajar 接口(阅读、测试等功能),第一版没有启用。
module.exports = {
  vocabApi: 'https://api.bahasa.cn',
  apiBase: '',
  useMock: true,
  wechatLogin: false
}
