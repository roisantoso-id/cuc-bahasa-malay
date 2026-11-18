# 背单词服务（admin.bahasa.cn / api.bahasa.cn）

部署在腾讯云新加坡轻量服务器（本机 SSH 别名 `jombelajar`），用 Docker Compose 管理，配置在仓库根目录的 `docker-compose.yml`，服务器上的目录是 `/opt/jombelajar`，登录用户 `ubuntu`：

| 容器 | 做什么 |
|---|---|
| `web` | Caddy：HTTPS 证书自动申请续期；托管官网 www.bahasa.cn（`/opt/jombelajar/website`）和后台网页（`admin/public/`，由 `admin/web` 构建）；把 `/api/*`、`/uploads/*` 转给 `api` |
| `api` | Node 后端：`admin/server.mjs`（小程序接口 `/api/app/*`、老师照片）+ `admin/admin-api.mjs`（后台接口 `/api/admin/*`） |

- 单词音频在**腾讯云 COS**（新加坡，公有读，目录 `vocab5000/audio/`；学生在马来西亚，离新加坡最近），库里只存文件名，接口返回 `AUDIO_BASE + 文件名`。
- 词库来自 `content/vocab5000/words.json`（`build.py` 从启航的 xlsx 和音频清单生成）。第一次启动时库里没有词，会自动导入。
- 数据库是**腾讯云 MySQL**（走内网，云数据库自带每日备份），连接串在 `.env` 的 `DATABASE_URL`。后端唯一的依赖是 `mysql2`。
- 建表在启动时自动完成；`rank` 在 MySQL 8 是保留字，代码里自动加反引号。

## 本机开发

需要一个 MySQL（5.7 或 8.0）：

```bash
docker run -d --name jb-mysql -p 127.0.0.1:3306:3306 -e MYSQL_ROOT_PASSWORD=dev -e MYSQL_DATABASE=jb mysql:8.0
cd admin && npm install
DEMO=1 DATABASE_URL=mysql://root:dev@127.0.0.1:3306/jb DEMO_AUDIO_DIR=~/dev/deloy/马来语5000高频词_音频 node server.mjs
```

- 后台接口：http://127.0.0.1:4200 ，账号 `admin`，密码 `admin123`。
- 后台网页（React + shadcn/ui + Tailwind，源码在 `admin/web`）：另开一个终端 `npm --prefix admin/web install && npm --prefix admin/web run dev`，打开 http://localhost:5190 （`/api` 自动转给 4200）。
- 要看有数据的页面：`DATABASE_URL=… node admin/scripts/seed-demo.mjs` 造 40 个演示学生（只认本机数据库）。
- 改完网页 `npm --prefix admin/web run build`，结果在 `admin/public`（不进 git，部署脚本会先构建）。
- 小程序：`miniprogram/miniprogram/config.js` 里 `vocabApi` 填 `http://127.0.0.1:4200`。开发者工具里不校验合法域名（`project.config.json` 已经关了 urlCheck）。
- `DEMO=1` 是演示模式：小程序登录不校验微信，后台 admin / admin123。线上不要加。线上没填 APPID 或管理员密码时，对应的登录直接不可用，不会退回演示模式。
- `DEMO_AUDIO_DIR` 指向本机的音频目录。不填也行，只是没有声音。

## 学习规则

- 10 站，每站 500 词（按启航音频包的新序号）：吉隆坡、马六甲、怡保、槟城、金马伦、关丹、瓜拉登嘉楼、哥打巴鲁、古晋、亚庇。
- 每天新词默认 20 个，学生可以改成 10 / 20 / 30 / 50。新词从当前这一站往后取；复习每组最多 60 个。
- 盒子法：box 0–5 是在学，6 是已掌握。
  - 新词：认识进 2，模糊进 1，不认识进 0。
  - 复习：认识升一格，模糊不升，不认识回 0。
  - 下次复习隔几天按盒子取：1 / 1 / 2 / 4 / 7 / 15 / 30 天。日期按北京时间。
- 一站的词都学过一遍，这一站就「盖章」。

## 单词状态

- `approved` 已上架：小程序能学。
- `pending` 待补 / 下架：现在包括第 3028–5000 个词（只有音频，还没有释义），以及义项全是「AI生成，建议复核」的词。
- 义项上的 `check`（待复核）：学生看不到。老师在后台去掉勾，学生就能看到。
- 后台改过的词标记为「改过」。以后重新导入 words.json，默认不覆盖这些词。

## 上线步骤

1. **服务器**：腾讯云轻量，新加坡（境外，不受腾讯备案拦截），2 核 2G 起，镜像选 Docker CE 或 Ubuntu 22.04/24.04。在控制台绑定 SSH 公钥。防火墙要开 22、80、443。
2. **DNS**（阿里云）：`www`、`admin`、`api` 和 `@` `words` 五条 A 记录指向服务器公网 IP（bahasa.cn 已备案）。防火墙要放行 80 和 443。
3. **初始化**（只做一次）：
   ```bash
   ssh ubuntu@<IP> 'sudo bash -s' < deploy/server-setup.sh
   scp .env.example ubuntu@<IP>:/opt/jombelajar/.env
   node admin/scripts/hash-password.mjs      # 在自己电脑上运行,生成管理员密码哈希
   ```
   然后登录服务器，`chmod 600 /opt/jombelajar/.env`，填 `DATABASE_URL`、`APPID`、`APPSECRET`、`ADMIN_PASSWORD_HASH`。`AUDIO_BASE` 已经填好。
4. **部署**：`bash deploy/deploy-compose.sh`（后端），`bash deploy/deploy-website.sh`（官网）。Caddy 会自动申请证书，第一次要等十几秒。
5. **小程序**：`config.js` 的 `vocabApi` 已经是 `https://api.bahasa.cn`。到公众平台 → 开发管理 → 服务器域名：request 合法域名加 `https://api.bahasa.cn`，downloadFile 合法域名加 COS 地址。
6. 以后更新代码，再跑一次第 4 步。更新词库：在后台「概览 → 导入词库」上传新的 words.json。

常用命令（在服务器的 `/opt/jombelajar` 目录里运行）：

```bash
docker compose ps                     # 看状态
docker compose logs -f api            # 看后端日志
# 数据库在腾讯云 MySQL：备份和恢复在云数据库控制台做
```

## 后台页面和权限

| 页面 | 做什么 |
|---|---|
| 概览 | 学生数、今天在学、今天学了多少词、待复核释义；14 天趋势；各站上架进度；近 7 天学得最多；最近操作 |
| 学生 | 搜索、按活跃 / 起点 / 停用筛选、导出 CSV；右侧面板看 30 天学习、每站进度、记忆盒子、错词，改资料、写老师备注、停用账号（停用后小程序打不开学习页） |
| 单词 | 按站 / 状态 / 主题筛选；批量上架下架；编辑词条、义项（中英释义、例句、待复核）、更多例句、词光扩展字段（搭配、同族、同义、反义、提示、配图）；导入（先检查再写入）；导出词光格式 |
| 课程 | 10 站旅程：改站名、马来语名、一句话、介绍；开放 / 关闭（关闭后不发这一站的新词） |
| 老师 | 小程序「关于我们」的老师介绍和照片 |
| 后台账号 | 每人一个账号；新建（生成初始密码，第一次登录必须改）、换角色、停用、重置密码、删除 |
| 角色权限 | 内置：超级管理员、内容编辑、任课老师、只读；可以自建角色，按 16 项权限勾选 |
| 操作日志 | 登录、失败登录、所有修改，谁、什么时候、改了什么 |

- 第一次启动时，库里没有后台账号，就用 `.env` 的 `ADMIN_USER` / `ADMIN_PASSWORD_HASH` 建一个超级管理员。之后在「后台账号」里加人，不用再改 `.env`。
- 至少要留一个能用的超级管理员；不能停用、删除自己，不能改自己的角色；不是超级管理员的人不能动超级管理员账号，也不能把自己没有的权限给别人。

## 安全

- 后台账号存在 `admin_users` 表，角色在 `admin_roles`，登录会话在 `admin_sessions`（只存 token 的 sha256，重启服务不掉线），操作日志在 `audit_log`。
  - 密码用 scrypt 哈希保存，至少 8 位。
  - 同一个 IP 10 分钟内输错 5 次、同一个账号 30 分钟内输错 10 次就锁定。
  - 登录态是 HttpOnly cookie，带 `Secure`，保持 10 天，每次使用自动顺延（10 天不用才要重新登录）；改密码后其它设备下线，停用 / 换角色后对方马上下线。
  - 写操作检查 `Origin`，别的网站发来的请求一律拒绝。
- 小程序 token 是服务端用 HMAC 签名的 openid，30 天过期。
  - 签名密钥在第一次启动时随机生成，存在数据库里。
  - 每个用户每分钟最多请求 120 次。
- 只有 Caddy 对外开 80 和 443 端口。后端和数据库只在 Docker 内部网络里，外面访问不到。
- AppSecret、数据库密码只在服务器的 `/opt/jombelajar/.env` 里。COS 密钥不放服务器，只在上传音频时用。
- 学生导出的 CSV 做了防公式注入处理。
- COS 上传脚本：`admin/scripts/upload-audio-cos.mjs`，在自己的终端里运行。
