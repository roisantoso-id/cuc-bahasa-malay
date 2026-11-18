# 背单词服务（admin.bahasa.cn / api.bahasa.cn）

部署在腾讯云新加坡轻量服务器 43.134.55.33，用 Docker Compose 管理，配置在仓库根目录的 `docker-compose.yml`，服务器上的目录是 `/opt/jombelajar`，登录用户 `ubuntu`：

| 容器 | 做什么 |
|---|---|
| `web` | Caddy：HTTPS 证书自动申请续期；托管官网 www.bahasa.cn（`/opt/jombelajar/website`）和后台网页（`admin/public/`）；把 `/api/*`、`/uploads/*` 转给 `api` |
| `api` | Node 后端（`admin/server.mjs`）：小程序接口 `/api/app/*`、后台接口 `/api/admin/*`、老师照片 |

- 单词音频在**腾讯云 COS**（`jombelajar-audio-1314893093`，广州，公有读），库里只存文件名，接口返回 `AUDIO_BASE + 文件名`。
- 词库来自 `content/vocab5000/words.json`（`build.py` 从启航的 xlsx 和音频清单生成）。第一次启动时库里没有词，会自动导入。
- 数据库是**腾讯云 MySQL**（内网 10.3.4.2:3306，云数据库自带每日备份），连接串在 `.env` 的 `DATABASE_URL`。后端唯一的依赖是 `mysql2`。
- 建表在启动时自动完成；`rank` 在 MySQL 8 是保留字，代码里自动加反引号。

## 本机开发

需要一个 MySQL（5.7 或 8.0）：

```bash
docker run -d --name jb-mysql -p 127.0.0.1:3306:3306 -e MYSQL_ROOT_PASSWORD=dev -e MYSQL_DATABASE=jb mysql:8.0
cd admin && npm install
DEMO=1 DATABASE_URL=mysql://root:dev@127.0.0.1:3306/jb DEMO_AUDIO_DIR=~/dev/deloy/马来语5000高频词_音频 node server.mjs
```

- 后台：http://127.0.0.1:4200 ，账号 `admin`，密码 `admin123`。
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
2. **DNS**（阿里云）：`www`、`admin`、`api` 和 `@` 四条 A 记录指向 43.134.55.33（bahasa.cn 已备案，备案不在腾讯云）。防火墙要放行 80 和 443。
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

## 安全

- 后台只有一个管理员账号。
  - 密码用 scrypt 哈希保存。
  - 同一个 IP 10 分钟内输错 5 次就锁定。
  - 登录态是 HttpOnly cookie，带 `Secure`，12 小时过期。
- 小程序 token 是服务端用 HMAC 签名的 openid，30 天过期。
  - 签名密钥在第一次启动时随机生成，存在数据库里。
  - 每个用户每分钟最多请求 120 次。
- 只有 Caddy 对外开 80 和 443 端口。后端和数据库只在 Docker 内部网络里，外面访问不到。
- AppSecret、数据库密码只在服务器的 `/opt/jombelajar/.env` 里。COS 密钥不放服务器，只在上传音频时用。
- 学生导出的 CSV 做了防公式注入处理。
- COS 上传脚本：`admin/scripts/upload-audio-cos.mjs`，在自己的终端里运行。
