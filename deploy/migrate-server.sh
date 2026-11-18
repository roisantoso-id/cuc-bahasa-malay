#!/usr/bin/env bash
# 把整套服务（官网、后台、接口、数据库、老师照片、HTTPS 证书）从旧服务器搬到新服务器
#   NEW=ubuntu@<新服务器IP> bash deploy/migrate-server.sh
# 前提：本机能用密钥登录新旧两台。旧服务器不停，搬完验证好再改 DNS。
# 2026-11-18：因为 bahasa.cn 的备案不在腾讯云，广州机 443 被拦，搬到新加坡。
set -euo pipefail
OLD="${OLD:?用法：OLD=用户@旧服务器 NEW=用户@新服务器 bash deploy/migrate-server.sh}"
NEW="${NEW:?用法：NEW=ubuntu@<新服务器IP> bash deploy/migrate-server.sh}"
DIR=/opt/jombelajar
cd "$(dirname "$0")/.."
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
step() { printf '\n== %s\n' "$*"; }

step "1/6 新服务器装 Docker、swap、目录"
ssh "$NEW" 'sudo NO_CN_MIRROR=1 bash -s' < deploy/server-setup.sh

step "2/6 复制 .env（直接两台之间传，不落本机磁盘、不打印）"
ssh "$OLD" "cat $DIR/.env" | ssh "$NEW" "umask 077 && cat > $DIR/.env"

step "3/6 上传代码和官网"
HOST="$NEW" bash deploy/deploy-website.sh >/dev/null
ssh "$NEW" "mkdir -p $DIR/deploy $DIR/content/vocab5000"
rsync -az --delete --exclude node_modules/ --exclude data/ admin/ "$NEW:$DIR/admin/"
rsync -az docker-compose.yml .dockerignore "$NEW:$DIR/"
rsync -az deploy/Caddyfile "$NEW:$DIR/deploy/"
rsync -az content/vocab5000/words.json "$NEW:$DIR/content/vocab5000/"

step "4/6 先只起数据库，把旧库导过去"
ssh "$NEW" "cd $DIR && docker compose up -d db && until docker compose exec -T db pg_isready -U jombelajar -d jombelajar >/dev/null 2>&1; do sleep 2; done"
ssh "$OLD" "cd $DIR && docker compose exec -T db pg_dump -U jombelajar -d jombelajar -Fc" > "$TMP/db.dump"
ls -lh "$TMP/db.dump"
ssh "$NEW" "cd $DIR && docker compose exec -T db pg_restore -U jombelajar -d jombelajar --clean --if-exists --no-owner" < "$TMP/db.dump"

step "5/6 复制老师照片（uploads 卷）和 HTTPS 证书（caddy_data 卷）"
for v in uploads caddy_data; do
  ssh "$OLD" "docker run --rm -v jombelajar_$v:/v:ro alpine tar -C /v -cz ." > "$TMP/$v.tgz"
  ssh "$NEW" "docker volume create jombelajar_$v >/dev/null && docker run --rm -i -v jombelajar_$v:/v alpine tar -C /v -xz" < "$TMP/$v.tgz"
done

step "6/6 起全部服务并在新服务器本机自检"
ssh "$NEW" "cd $DIR && docker compose up -d --build && sleep 5 && docker compose ps && \
  for h in www.bahasa.cn admin.bahasa.cn api.bahasa.cn; do \
    printf '%s ' \$h; curl -sk -o /dev/null -w '%{http_code}\n' --resolve \$h:443:127.0.0.1 https://\$h/; done"
echo
echo "搬完。新服务器本机自检通过后，在阿里云 DNS 把 @、www、admin、api 改到新 IP。"
