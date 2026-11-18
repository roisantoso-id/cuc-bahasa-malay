#!/usr/bin/env bash
# 部署背单词服务到腾讯云新加坡服务器:HOST=ubuntu@<服务器IP> bash deploy/deploy-compose.sh
# 前提:服务器已经跑过 deploy/server-setup.sh,/opt/jombelajar/.env 已经填好
set -euo pipefail
HOST="${HOST:-ubuntu@43.134.55.33}"
DIR=/opt/jombelajar
cd "$(dirname "$0")/.."

ssh "$HOST" "mkdir -p $DIR/deploy $DIR/content/vocab5000"
rsync -az --delete --exclude node_modules/ --exclude data/ admin/ "$HOST:$DIR/admin/"
rsync -az docker-compose.yml .dockerignore "$HOST:$DIR/"
rsync -az deploy/Caddyfile "$HOST:$DIR/deploy/"
rsync -az content/vocab5000/words.json "$HOST:$DIR/content/vocab5000/"
ssh "$HOST" "cd $DIR && test -f .env || { echo '服务器上还没有 $DIR/.env'; exit 1; }; docker compose up -d --build && docker compose exec -T web caddy reload --config /etc/caddy/Caddyfile && docker compose ps"
