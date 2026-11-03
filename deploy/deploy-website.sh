#!/usr/bin/env bash
# 构建官网并上传到腾讯云广州服务器(由 docker compose 里的 caddy 托管):bash deploy/deploy-website.sh
# 2026-11-03 起官网从雅加达(43.157.197.80)搬到广州;nginx-website.conf 只是雅加达旧配置的存档
# 桌面目录在 iCloud 里,图片可能没下载到本地,直接构建会超时。所以从 git 里取出已提交的版本,在临时目录构建
set -euo pipefail
HOST="${HOST:-ubuntu@81.71.143.244}"
DIR=/opt/jombelajar/website
cd "$(dirname "$0")/.."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git archive HEAD website | tar -x -C "$TMP"
(cd "$TMP/website" && node scripts/build.mjs)
ssh "$HOST" "mkdir -p $DIR"
rsync -az --delete "$TMP/website/dist/" "$HOST:$DIR/"
echo "已部署 → https://www.bahasa.cn/"
