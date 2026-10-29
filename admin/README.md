# 背单词后台（admin.bahasa.cn）

用来管理小程序「背单词」的数据：

| 栏目 | 能做什么 |
|---|---|
| 场景 | 增删改、排序、上架 / 下架 |
| 单词 | 按场景和审核状态筛选；增删改；从表格粘贴批量导入（先预览）；切换「草稿 / 已审核」；生成并试听发音 |
| 老师 | 增删改、上传照片，小程序「关于老师」页读这里 |
| 学生 | 学生在小程序里注册的资料（只读），能看已学词数和最近活跃时间，可导出 CSV |

- 零依赖 Node 服务（`server.mjs`）加静态页面（`public/`）。
- 数据通过微信服务端接口直接读写**云开发**的数据库和云存储，和小程序是同一份数据。

## 本机试用（演示模式）

```bash
node admin/server.mjs
```

- 打开 http://127.0.0.1:4200 ，账号 `admin`，密码 `admin123`。
- 没有配置 APPID 时自动进入演示模式：
  - 数据存在 `admin/data/demo.json`，第一次启动时从 `content/words-seed.json` 生成，删掉这个文件就恢复初始数据；
  - 学生是假的演示数据；
  - 发音用的是 `content/audio/` 里的录音。

## 上线步骤（服务器 43.157.197.80）

1. **DNS**：加一条 A 记录 `admin.bahasa.cn` → `43.157.197.80`。
2. **配置文件**（你自己在服务器上填，密钥不要发给任何人）：
   ```bash
   scp admin/.env.example root@43.157.197.80:/etc/jombelajar-admin.env
   ssh root@43.157.197.80 'chmod 600 /etc/jombelajar-admin.env && vi /etc/jombelajar-admin.env'
   ```
   - 填 `APPID`、`APPSECRET`（公众平台 → 开发管理 → 开发设置）和 `CLOUD_ENV`（云开发环境 ID）。
   - `ADMIN_PASSWORD_HASH`：在自己电脑上运行 `node admin/scripts/hash-password.mjs`，把输出的那一行粘进去。
   - Azure 发音的 key 可以不填，不填就不能在后台生成发音。
3. **服务**：
   ```bash
   bash deploy/deploy-admin.sh   # 第一次会因为服务还没装而失败，先做下面这步
   scp admin/admin.service root@43.157.197.80:/etc/systemd/system/jombelajar-admin.service
   ssh root@43.157.197.80 'systemctl daemon-reload && systemctl enable --now jombelajar-admin'
   ```
4. **证书和 nginx**：
   1. 先只放 `deploy/nginx-admin.conf` 里的 80 端口那一段，然后执行 `mkdir -p /var/www/jombelajar-admin-acme`、`nginx -t`、`systemctl reload nginx`。
   2. 申请证书：`certbot certonly --webroot -w /var/www/jombelajar-admin-acme -d admin.bahasa.cn --deploy-hook "systemctl reload nginx"`。
   3. 把整份配置放到 `/etc/nginx/conf.d/jombelajar-admin.conf`，执行 `nginx -t && systemctl reload nginx`。
   4. 证书会自动续期：`certbot-renew.timer` 已经开着。
5. 以后更新代码：`bash deploy/deploy-admin.sh`。

## 云开发要先建好的集合

`scenes`、`words`、`teachers`、`students`、`progress`，权限见 `docs/背单词v1-上线步骤.md`。

后台用服务端接口读写，不受这些权限限制。种子词库可以在控制台导入 `content/import-*.jsonl`，也可以在后台的「单词 → 批量导入」里粘贴。

## 安全

- 只有一个管理员账号。密码用 scrypt 哈希保存；同一 IP 10 分钟内输错 5 次就锁定。
- 登录态是 HttpOnly cookie，经 HTTPS 访问时带 `Secure`，12 小时过期。服务重启后要重新登录。
- 服务只监听 127.0.0.1，只能通过 nginx 的 HTTPS 访问。
- AppSecret 和 Azure key 只在服务器的 `/etc/jombelajar-admin.env` 里。
