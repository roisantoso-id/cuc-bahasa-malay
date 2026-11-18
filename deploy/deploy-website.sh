#!/usr/bin/env bash
# 构建官网并上传到腾讯云新加坡服务器(由 docker compose 里的 caddy 托管):bash deploy/deploy-website.sh
# 桌面目录在 iCloud 里,图片可能没下载到本地,直接构建会超时。所以从 git 里取出已提交的版本,在临时目录构建
set -euo pipefail
HOST="${HOST:-jombelajar}"  # ~/.ssh/config 里的别名
DIR=/opt/jombelajar/website
cd "$(dirname "$0")/.."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git archive HEAD website | tar -x -C "$TMP"
(cd "$TMP/website" && node scripts/build.mjs)
ssh "$HOST" "mkdir -p $DIR"
# /words/ 是背单词网页(word-atlas-malayu 仓库用 scripts/deploy.sh 单独部署),官网部署不能删它
rsync -az --delete --exclude /words/ "$TMP/website/dist/" "$HOST:$DIR/"
echo "已部署 → https://www.bahasa.cn/"
