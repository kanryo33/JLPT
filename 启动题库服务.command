#!/bin/bash
# JLPT 题库本地服务一键启动
# 双击本文件即可在浏览器打开题库（图片/音频都能正常播放）
cd "$(dirname "$0")"
NODE="/Users/kanryo/.workbuddy/binaries/node/versions/22.22.2/bin/node"
PORT=8080
# 若端口已占用则先结束旧进程
if lsof -ti tcp:$PORT >/dev/null 2>&1; then
  kill $(lsof -ti tcp:$PORT) 2>/dev/null
  sleep 1
fi
"$NODE" server.js &
sleep 2
open "http://localhost:$PORT"
