---
type: learning
domain: learning
status: compiled
updated: 2026-11-13
tags: [Obsidian, GitHub, 供应链, 使用说明]
---

# GitHub 仓库与跨设备使用说明

这是一个可在 Obsidian 中直接打开的供应链 + 采购管理知识库。仓库包含四本现有 SCMP 教材的 34 个自足精读章节、634 道章节自测题、全文 OCR 底稿、学习导航、诊断工具、模板和维护脚本。

> [!important] 先在 Obsidian 打开
> 从 GitHub 克隆后，在 Obsidian 中选择“打开本地仓库（Open folder as vault）”，选择整个 `雨月的供应链学习库` 文件夹。入口是 [[首页]]，完整验收台账是 [[90_来源与维护/教材完整度总表]]。

## 仓库内容

- `00_导航/`：首页、学习地图、认证备考导航和跨设备使用入口。
- `20_采购管理/` 至 `50_组织与领导力/`：34 个章节页及跨章节概念页。
- `60_诊断工具/`、`70_学习与复盘/`、`80_模板/`：练习、诊断、复盘和可复用模板。
- `90_来源与维护/`：来源档案、OCR 全文底稿、原始逐页 JSON、完整度总表和校验工具。
- `.obsidian/`：可共享的 Obsidian 核心配置；本机窗口状态 `workspace.json` 不会提交。

原书 PDF 保存在本地桌面目录，不提交到 GitHub。仓库保留从 PDF 生成的 OCR 文本和原始 JSON，便于没有原书时检索；精确数字、表格、公式和法条仍应以原页为证据边界。

## 在新设备使用

需要安装 Git 和 Obsidian，并登录有该私有仓库权限的 GitHub 账号：

```powershell
git clone https://github.com/jack4862/雨月的供应链学习库.git
```

然后在 Obsidian 中打开克隆后的文件夹。首次打开先看：

1. [[首页]]
2. [[00_导航/使用手册]]
3. [[00_导航/认证备考导航]]
4. [[90_来源与维护/教材完整度总表]]

## 更新仓库

开始学习前先拉取最新版本：

```powershell
git pull --ff-only
```

修改或新增知识页后，运行校验：

```powershell
node "90_来源与维护/工具/kb-audit.mjs"
node "90_来源与维护/工具/kb-completeness.mjs"
```

两项都为 `PASS` 后提交并推送：

```powershell
git add .
git commit -m "docs: update supply chain knowledge base"
git push
```

## 跨设备注意事项

- `.obsidian/workspace.json`、缓存、临时渲染图和操作系统元数据已被 `.gitignore` 排除，避免把本机窗口路径带到另一台设备。
- OCR 原始数据文件较大，但仍在普通 Git 仓库可接受范围内；如果未来加入 PDF、图片或视频，应先评估仓库体积，不要直接提交。
- 原始 PDF 和 OCR 内容可能涉及版权或个人资料，默认使用私有仓库；若改为公开仓库，请先确认内容和版权边界。
- 学习入口、章节来源和页码边界以 [[index]]、[[90_来源与维护/来源总表]] 与 [[log]] 为准。

## 相关页面

- [[首页]]
- [[00_导航/使用手册]]
- [[00_导航/认证备考导航]]
- [[90_来源与维护/教材完整度总表]]
- [[index]]
