#!/usr/bin/env bash
# 构建官网并上传到服务器。用法:bash deploy/deploy-website.sh
# 需要本机能免密登录服务器(ssh root@HOST)。
set -euo pipefail
HOST="${HOST:-root@43.157.197.80}"
DIR=/var/www/jombelajar-website
cd "$(dirname "$0")/.."

(cd website && node scripts/build.mjs)
ssh "$HOST" "mkdir -p $DIR"
rsync -az --delete website/dist/ "$HOST:$DIR/"
# nginx 配置有变化才更新并重载
scp -q deploy/nginx-website.conf "$HOST:/tmp/jombelajar-website.conf"
ssh "$HOST" "if ! cmp -s /tmp/jombelajar-website.conf /etc/nginx/conf.d/jombelajar-website.conf; then cp /tmp/jombelajar-website.conf /etc/nginx/conf.d/jombelajar-website.conf && nginx -t && systemctl reload nginx && echo 'nginx 已重载'; fi"
echo "已部署 → https://www.bahasa.cn/"
