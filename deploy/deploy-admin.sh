#!/usr/bin/env bash
# 部署背单词后台到服务器:bash deploy/deploy-admin.sh
# 前提:服务器上已有 /etc/jombelajar-admin.env、systemd 服务和 nginx 配置(见 admin/README.md)
set -euo pipefail
HOST="${HOST:-root@43.157.197.80}"
DIR=/opt/jombelajar-admin
cd "$(dirname "$0")/.."

ssh "$HOST" "mkdir -p $DIR"
rsync -az --delete --exclude data/ --exclude .env.example admin/ "$HOST:$DIR/"
ssh "$HOST" "test -f /etc/jombelajar-admin.env || { echo '服务器上还没有 /etc/jombelajar-admin.env'; exit 1; }; systemctl restart jombelajar-admin && sleep 1 && systemctl is-active jombelajar-admin"
echo "已部署 → https://admin.bahasa.cn/"
