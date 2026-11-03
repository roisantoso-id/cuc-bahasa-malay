#!/usr/bin/env bash
# 部署背单词服务(小程序接口 + 后台)到服务器:bash deploy/deploy-admin.sh
# 前提:服务器上已有 /etc/jombelajar-admin.env、systemd 服务和 nginx 配置(见 admin/README.md)
# 代码放 /opt/jombelajar-admin/{admin,content/vocab5000};数据在 DATA_DIR(/var/lib/jombelajar),不会被覆盖
set -euo pipefail
HOST="${HOST:-root@43.157.197.80}"
DIR=/opt/jombelajar-admin
cd "$(dirname "$0")/.."

ssh "$HOST" "mkdir -p $DIR/admin $DIR/content/vocab5000 /var/lib/jombelajar"
rsync -az --delete --exclude data/ --exclude .env.example admin/ "$HOST:$DIR/admin/"
rsync -az content/vocab5000/words.json "$HOST:$DIR/content/vocab5000/"
ssh "$HOST" "test -f /etc/jombelajar-admin.env || { echo '服务器上还没有 /etc/jombelajar-admin.env'; exit 1; }; systemctl restart jombelajar-admin && sleep 1 && systemctl is-active jombelajar-admin"
echo "已部署 → https://admin.bahasa.cn/"
