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

1. 用实体注册小程序，拿到 AppID，填进 `miniprogram/project.config.json` 的 `appid`（现在是测试号 `touristappid`）。
2. 开通云开发后，把环境 ID 填进 `miniprogram/miniprogram/config.js`；右键 `cloudfunctions/login` → 上传并部署。
3. 示例课程在 `miniprogram/miniprogram/data/courses.js`，学习记录现在存在手机本地（`utils/store.js`），第二阶段改成云数据库。
