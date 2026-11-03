# 背单词服务（admin.bahasa.cn）

一个 Node 进程，部署在腾讯云服务器 43.157.197.80：

| 路径 | 给谁用 | 做什么 |
|---|---|---|
| `/api/app/*` | 小程序 | 微信登录、注册、今日学习、打分、单词本、查词、统计 |
| `/api/admin/*` | 后台网页 | 概览、单词编辑和导入、学生列表和导出、老师信息 |
| 其余 | 后台网页 | `public/` 里的单页 |

- 零依赖：Node 22.13+ 自带的 `node:sqlite`。数据库是一个文件 `$DATA_DIR/app.db`。
- 单词音频放在**腾讯云 COS**（公有读），库里只存文件名，接口返回 `AUDIO_BASE + 文件名`。
- 词库来自 `content/vocab5000/words.json`（`build.py` 从启航的 xlsx 和音频清单生成）。第一次启动库是空的时候自动导入。

## 本机试用（演示模式）

```bash
DEMO_AUDIO_DIR=<解压后的启航音频目录> node admin/server.mjs
```

- 后台：http://127.0.0.1:4200 ，账号 `admin`，密码 `admin123`。
- 小程序：`miniprogram/miniprogram/config.js` 里 `vocabApi` 填 `http://127.0.0.1:4200`，开发者工具里勾选「不校验合法域名」（`project.config.json` 已经关了 urlCheck）。
- 没配 APPID 就是演示模式：小程序登录不校验微信，数据在 `admin/data/app.db`，删掉就重来。
- `DEMO_AUDIO_DIR` 不填也能用，只是没有声音。

## 学习规则

- 10 站，每站 500 词（按启航音频包的新序号）：吉隆坡、马六甲、怡保、槟城、金马伦、关丹、瓜拉登嘉楼、哥打巴鲁、古晋、亚庇。
- 每天新词默认 20 个（学生可改 10 / 20 / 30 / 50），从当前站往后取；复习每组最多 60 个。
- 盒子法：box 0–5 在学，6 已掌握。新词：认识进 2、模糊进 1、不认识进 0。复习：认识升一格，模糊不升，不认识回 0。下次复习隔 1 / 1 / 2 / 4 / 7 / 15 / 30 天。日期按北京时间。
- 一站的词都学过一遍就「盖章」。

## 单词状态

- `approved` 已上架：小程序能学。
- `pending` 待补 / 下架：现在是第 3028–5000 个词（只有音频，还没有释义）和义项全是「AI生成，建议复核」的词。
- 义项上的 `check`（待复核）：学生看不到。老师在后台去掉勾就显示。
- 后台改过的词标记为「改过」，以后重新导入 words.json 默认不覆盖。

## 上线步骤

1. **COS**：建一个存储桶（建议和服务器同地域），权限「公有读私有写」。把启航的 5000 个 mp3 传到 `vocab5000/` 目录：控制台直接拖文件夹，或者在自己的终端运行 `admin/scripts/upload-audio-cos.mjs`（用法见文件开头，密钥只在你自己的终端里用）。
2. **DNS**：`admin.bahasa.cn` A 记录指向 43.157.197.80。
3. **服务器配置**：
   ```bash
   scp admin/.env.example root@43.157.197.80:/etc/jombelajar-admin.env
   ssh root@43.157.197.80 'chmod 600 /etc/jombelajar-admin.env && mkdir -p /var/lib/jombelajar'
   node admin/scripts/hash-password.mjs   # 在自己电脑上运行,生成密码哈希
   ```
   然后自己登录服务器编辑 `/etc/jombelajar-admin.env`，填 `APPID`、`APPSECRET`、`ADMIN_PASSWORD_HASH`、`AUDIO_BASE`。
4. **装服务**：
   ```bash
   bash deploy/deploy-admin.sh   # 第一次会因为服务还没装而失败，先做下面这步
   scp admin/admin.service root@43.157.197.80:/etc/systemd/system/jombelajar-admin.service
   ssh root@43.157.197.80 'systemctl daemon-reload && systemctl enable --now jombelajar-admin'
   ```
5. **证书和 nginx**：
   1. 先只放 `deploy/nginx-admin.conf` 里的 80 端口那一段，然后 `mkdir -p /var/www/jombelajar-admin-acme && nginx -t && systemctl reload nginx`。
   2. `certbot certonly --webroot -w /var/www/jombelajar-admin-acme -d admin.bahasa.cn --deploy-hook "systemctl reload nginx"`。
   3. 放上整份配置到 `/etc/nginx/conf.d/jombelajar-admin.conf`，`nginx -t && systemctl reload nginx`。
6. **小程序**：`config.js` 的 `vocabApi` 改成 `https://admin.bahasa.cn`；公众平台 → 开发管理 → 服务器域名：request 合法域名加 `https://admin.bahasa.cn`。
7. 以后更新代码：`bash deploy/deploy-admin.sh`。更新词库：在后台「概览 → 导入词库」上传新的 words.json。

## 安全

- 后台只有一个管理员账号。密码用 scrypt 哈希；同一 IP 10 分钟内输错 5 次锁定。登录态是 HttpOnly cookie，HTTPS 下带 `Secure`，12 小时过期。
- 小程序 token 是服务端 HMAC 签名的 openid，30 天过期；签名密钥第一次启动时随机生成，存在数据库里。每个用户每分钟最多 120 次请求。
- 服务只监听 127.0.0.1，只能通过 nginx 的 HTTPS 访问。
- AppSecret 只在服务器的 `/etc/jombelajar-admin.env` 里；COS 密钥不放服务器，只在上传音频时用。
- 学生导出的 CSV 防公式注入。
