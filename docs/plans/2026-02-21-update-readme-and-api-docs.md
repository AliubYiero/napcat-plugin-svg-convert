# 更新 README 和 API 文档计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 更新 README.md 以反映最新功能（外部图片下载、缓存管理），并创建详细的 API 文档文件。

---

## Task 1: 更新 README.md

**Files:**
- Modify: `README.md`

**更新内容：**
1. 更新功能特性列表（添加图片缓存、外部图片下载）
2. 更新项目结构（添加 cache-image 目录、image-cache-service.ts 等）
3. 更新 API 接口说明（添加 saveWebImage 参数、缓存管理 API）
4. 更新 WebUI 使用说明（添加缓存管理页面）
5. 更新安全限制说明

**Step 1: 更新 README 内容**

将 README 更新为完整版本，包含所有新功能。

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README with cache and image download features"
```

---

## Task 2: 创建 API 文档

**Files:**
- Create: `docs/API.md`

**内容：**
创建详细的 API 文档，包含：
1. 基础信息（Base URL、认证、数据格式）
2. SVG 渲染 API（详细说明、请求参数、响应格式、示例）
3. 服务状态 API
4. 缓存管理 API（列表、设置、删除、清空、查看图片）
5. 错误码说明
6. 使用示例（curl、JavaScript）

**Step 1: 创建 API.md**

编写完整的 API 文档。

**Step 2: Commit**

```bash
git add docs/API.md
git commit -m "docs: add detailed API documentation"
```

---

## Task 3: 验证和构建

```bash
pnpm run build
```

确保所有文档更新后构建成功。
