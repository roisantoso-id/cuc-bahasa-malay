#!/bin/sh
# 把 parts/ 拼成 index.html，再给每个方向截一张整页图
cd "$(dirname "$0")" && cat parts/*.html > index.html
[ "$1" = "shot" ] && NODE_PATH=/Users/mac/dev/word-atlas-malayu/node_modules node shot.cjs
