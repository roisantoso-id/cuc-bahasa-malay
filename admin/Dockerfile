# 背单词服务镜像(构建上下文是仓库根目录,见 docker-compose.yml)
FROM node:22-alpine
WORKDIR /app/admin
# 国内服务器拉 npm 慢,默认用腾讯云镜像
ARG NPM_REGISTRY=https://mirrors.cloud.tencent.com/npm/
COPY admin/package.json admin/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --registry=$NPM_REGISTRY
COPY admin/ ./
# 第一次启动、库里没有词时自动导入
COPY content/vocab5000/words.json /app/content/vocab5000/words.json
RUN mkdir -p /data/uploads && chown -R node:node /data
ENV NODE_ENV=production ADMIN_HOST=0.0.0.0 ADMIN_PORT=4200 DATA_DIR=/data
USER node
EXPOSE 4200
CMD ["node", "server.mjs"]
