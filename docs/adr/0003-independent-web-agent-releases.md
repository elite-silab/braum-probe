# ADR-0003：网站与 Agent 使用独立发行版本

- 状态：已采纳
- 日期：2026-07-27

## 背景

网站、Cloudflare Worker 与 Agent 位于同一仓库。GitHub 的 Latest Release 对整个仓库只有一个，原有 Agent 下载地址又依赖 `/releases/latest/download`。如果直接发布网站版本，Latest 会改变并导致 Agent 安装脚本找不到二进制文件。

## 决策

- 网站使用 `web-v*` 标签，由 `Web Release` 工作流创建 Release，并标记为 Latest。
- Agent 使用 `agent-v*` 标签，由 `Agent Release` 工作流构建二进制文件，不标记为 Latest。
- 历史 `v0.1.0` 作为旧格式的 Agent 首版保留。
- Agent 下载地址固定到明确的发行标签，不再依赖仓库级 Latest。
- 已发布标签保持不可变；修复通过新版本发布。

## 取舍

优点是两个组件可以独立迭代，网站发版不会破坏 Agent 安装，GitHub 项目页也能明确展示网站最新版本。代价是发布者需要维护两个版本序列，并在 Agent 升级后同步固定下载地址。

## 备选方案

- 共用一个产品版本：流程简单，但网站与 Agent 必须同步发版，不符合独立迭代需求。
- 网站 Release 标记为预发行：不会抢占 Latest，但会错误表达正式网站版本的稳定性。
- 继续使用 `/releases/latest`：配置最少，但任何网站 Release 都可能破坏节点安装，风险不可接受。
