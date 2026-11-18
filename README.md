<div align="center">

<img src="website/site/img/bird/hero.webp" alt="JomBelajar 犀鸟" width="220">

# JomBelajar · 马来语 5000 高频词

**给中文母语者的马来语背单词系统：微信小程序 + 背单词网页 + 老师后台。**

[背单词网页](https://words.bahasa.cn/) · [官网](https://www.bahasa.cn/) · [架构图](docs/架构.md)

</div>

---

马来语最常用的 5000 个词，按出现频率排成「10 站旅程」，每站 500 词。每个词都有马来语真人发音、中文释义和例句，学过的词按记忆曲线安排复习。词表和释义由马来语专业团队整理审核，没审完的词不会出现在学生端。

## 有哪些部分

| | 给谁用 | 在哪里 | 技术 |
|---|---|---|---|
| **微信小程序** | 学生 | `miniprogram/` | 原生小程序，微信登录 |
| **背单词网页** | 学生（免登录） | [word-atlas-malayu](https://github.com/roisantoso-id/word-atlas-malayu) 仓库 | React · Vite · FSRS |
| **后台** | 老师、管理员 | `admin/public/` | 原生 JS |
| **接口** | 小程序和后台共用 | `admin/server.mjs` | Node · MySQL |
| **官网** | 访客 | `website/` | 静态 HTML + 构建脚本 |
| **词库** | 全部 | `content/vocab5000/` | xlsx → `build.py` → `words.json` |

```mermaid
flowchart LR
  MP["微信小程序"] --> API["Node 接口"]
  ADM["后台"] --> API
  API --> DB[("MySQL")]
  MP -.-> COS[("发音音频")]
  WEB["背单词网页"] -.-> COS
  XLSX["启航词表 xlsx"] --> JSON["words.json"]
  JSON --> API
  JSON --> WEB
```

完整的三张图（用户和界面、技术架构、服务器架构）在 [docs/架构.md](docs/架构.md)。

## 学生能做什么

- **微信小程序**：微信一键登录，第一次填学习资料；旅程首页看今天的新词和到期复习；词卡上选「认识 / 模糊 / 不认识」，中间穿插小测；站点词表、查词、单词本（收藏、错词、已掌握）；「我的护照」记录盖章和连续打卡。
- **背单词网页**：不用登录，打开就学；词卡、选义、听音辨词、例句补全、拼写；图鉴按词频段和词性筛选；打字和听写练习。

## 本地运行

需要 Node 22+。

```bash
# 接口 + 后台（演示模式：不校验微信登录，后台账号 admin / admin123）
docker run -d --name jb-mysql -p 127.0.0.1:3306:3306 -e MYSQL_ROOT_PASSWORD=dev -e MYSQL_DATABASE=jb mysql:8.0
cd admin && npm install
DEMO=1 DATABASE_URL=mysql://root:dev@127.0.0.1:3306/jb node server.mjs   # http://127.0.0.1:4200
```

```bash
# 官网
cd website && npm run preview   # http://localhost:4173
```

小程序：用微信开发者工具导入 `miniprogram/`。本地联调时把 `miniprogram/miniprogram/config.js` 的 `vocabApi` 改成 `http://127.0.0.1:4200`，并在开发者工具里关掉合法域名校验。

更多：[admin/README.md](admin/README.md)（接口、学习规则、单词状态）· [docs/背单词5000-设计.md](docs/背单词5000-设计.md) · [docs/小程序上线清单.md](docs/小程序上线清单.md)

## 词库

- 来源：启航整理的马来语高频词表（逐义项），音频按频率重新编号。
- `content/vocab5000/build.py` 生成 `words.json`：第 1–2957 个词已审核上架，其余只有音频，等释义补齐。
- 标了「AI 生成，建议复核」的释义单独标记，学生端不显示，老师在后台审过才放出。

## 部署

一台新加坡云服务器，Docker Compose 跑 Caddy（HTTPS + 静态文件 + 反代）和 Node 接口；数据库用云 MySQL，发音放对象存储。

```bash
bash deploy/deploy-compose.sh   # 接口、后台、Caddy 配置
bash deploy/deploy-website.sh   # 官网
```

脚本默认连本机 `~/.ssh/config` 里的主机别名 `jombelajar`。服务器配置模板见 [.env.example](.env.example)。

## 安全

这是公开仓库：

- 不提交任何密钥、密码、服务器地址、数据库地址。真实值只在服务器的 `.env`（权限 600）和维护者本机的 `ops/`（已忽略）。
- 小程序上传密钥放在本机 `wx/`，已在 `.gitignore`。
- 发现安全问题请私下联系维护者，不要开公开 Issue。

## 团队

- **张静灵**：副教授，马来语专业教师，课程内容主持
- **杨启航**：马来语专业本科生，词表整理
- **Santoso**：技术支持

背单词网页的界面和学习流程改编自开源项目 [词光 Word Atlas](https://github.com/designfuchen/word-atlas)（MIT）。
