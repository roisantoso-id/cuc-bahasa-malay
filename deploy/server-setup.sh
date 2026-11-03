#!/usr/bin/env bash
# 新服务器初始化(只跑一次):ssh root@<服务器IP> 'bash -s' < deploy/server-setup.sh
# 装 Docker(轻量服务器选了 Docker CE 镜像就已经有了)、配腾讯云镜像加速、建目录
set -euo pipefail
if ! command -v docker >/dev/null; then
  curl -fsSL https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker.gpg
  echo "deb [signed-by=/usr/share/keyrings/docker.gpg] https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -q && apt-get install -yq docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
# Docker Hub 在国内拉不动,用腾讯云内网镜像
if [ ! -f /etc/docker/daemon.json ]; then
  mkdir -p /etc/docker
  echo '{ "registry-mirrors": ["https://mirror.ccs.tencentyun.com"], "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "3" } }' > /etc/docker/daemon.json
  systemctl restart docker
fi
systemctl enable --now docker
mkdir -p /opt/jombelajar/backups
docker compose version
echo "下一步:把 .env.example 复制到 /opt/jombelajar/.env 并填好,然后在本机运行 deploy/deploy-compose.sh"
