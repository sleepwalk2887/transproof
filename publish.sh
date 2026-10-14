#!/usr/bin/env bash
# 译校助手 · 一键上线（DSH 工作区快捷入口）
# 用法：bash publish.sh
# 实际发布的是 ~/.transproof-deploy/deploy.sh，指向源目录：
#   C:/Users/Andrew/WorkBuddy/2026-09-24-01-35-19/transproof
# 若要发布本工作区里这份（default-workspace/transproof），改用：
#   bash ~/.transproof-deploy/deploy.sh "$(pwd)/transproof"

bash "$HOME/.transproof-deploy/deploy.sh"
