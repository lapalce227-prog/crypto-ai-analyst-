#!/bin/bash
cd "$(dirname "$0")/backend"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "请先创建 .env 文件（参考 .env.example）"
    exit 1
fi

# 安装依赖
pip install -r requirements.txt --break-system-packages -q

# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
