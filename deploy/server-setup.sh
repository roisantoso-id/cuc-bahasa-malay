#!/usr/bin/env bash
# 新服务器初始化(只跑一次):ssh ubuntu@<服务器IP> 'sudo bash -s' < deploy/server-setup.sh
# 装 Docker(轻量服务器选了 Docker CE 镜像就已经有了)、配腾讯云镜像加速、加 2G swap、建目录
# 登录用户(轻量 Ubuntu 默认是 ubuntu)加进 docker 组,之后部署不用 sudo
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
# 内存小的机器加 swap,防止构建镜像时内存不够
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
U="${SUDO_USER:-root}"
[ "$U" != root ] && usermod -aG docker "$U"
mkdir -p /opt/jombelajar/backups
chown -R "$U:$U" /opt/jombelajar
docker compose version
echo "下一步:把 .env.example 复制到 /opt/jombelajar/.env 并填好,然后在本机运行 deploy/deploy-compose.sh"
