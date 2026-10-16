# 马来语学习系统

面向中国学生和马来西亚华人的马来语学习项目。

| 目录 | 是什么 | 怎么跑 |
|---|---|---|
| `website/` | 宣传官网（纯静态 HTML），主要作用是让人打开小程序 | `cd website && npm run preview`，打开 http://localhost:4173 |
| `miniprogram/` | 微信小程序（原生 + 云开发），学生真正学习的地方 | 微信开发者工具 → 导入 `miniprogram/` 文件夹 |
| `docs/` | 项目方案、页面清单 | — |

方案和待定事项见 [docs/方案.md](docs/方案.md)。

## 官网

- 页面源文件在 `website/site/`，顶栏和页脚由 `website/scripts/build.mjs` 统一注入，不要在页面里手写。
- 品牌名、小程序码、老师介绍、运营方、备案号都在 `website/content/site.json`。留空的字段，页面上对应的那一段会自动不显示。
- `npm run build` 输出到 `website/dist/`，把这个文件夹上传到静态托管即可。

## 小程序

小程序是已上线系统 JomBelajar（www.bahasa.cn）的新客户端，直接调用它的接口，不另建后端。接口和功能清单见 [docs/JomBelajar功能清单.md](docs/JomBelajar功能清单.md)，视觉规范见 [docs/品牌规范.md](docs/品牌规范.md)（方向 C · 犀鸟）。

- `miniprogram/miniprogram/config.js`：
  - `useMock: true`：用本地演示数据，没有后端也能把整个流程点一遍。演示模式下，任意邮箱加 8 位以上密码就能登录。
  - 接真实接口时改成 `false`，同时在开发者工具里勾选「不校验合法域名」。
- `api/`：一个模块对应一组后端接口。`api/mock/` 是演示数据。
- 页面：
  - 4 个 tab：学习、阅读、测试、我的。
  - 4 个分包：单词学习、阅读详情、试卷、我的设置。
- 上线前还缺：小程序 AppID、后端的微信登录接口、刷新令牌不走 cookie。见功能清单第六节。
