# NapCat SVG 渲染插件

一个 NapCat 插件，提供 SVG 转 PNG 渲染功能。通过 WebUI 界面或 API 接口将 SVG 代码渲染为 PNG 图片。

## ✨ 功能特性

- **SVG 转 PNG**: 使用 rsvg-convert 工具高质量渲染 SVG 为 PNG
- **WebUI 界面**: 提供可视化界面，支持粘贴 SVG 代码、实时渲染预览
- **API 接口**: 提供 REST API，支持程序化调用
- **环境检测**: 自动检测 rsvg-convert 工具是否已安装
- **安全防护**: 输入大小限制、执行超时、命令注入防护

## 📁 项目结构

```
napcat-plugin-svg-render/
├── src/
│   ├── index.ts              # 插件入口
│   ├── config.ts             # 配置定义
│   ├── types.ts              # TypeScript 类型定义
│   ├── core/
│   │   └── state.ts          # 全局状态管理
│   ├── handlers/
│   │   └── message-handler.ts # 消息处理器
│   ├── services/
│   │   ├── api-service.ts    # API 路由
│   │   └── svg-service.ts    # SVG 渲染服务
│   └── webui/                # React 前端
│       └── src/
│           ├── pages/
│           │   └── SvgRenderPage.tsx  # SVG 渲染页面
│           └── ...
├── dist/                     # 构建产物
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 安装 rsvg-convert

**Windows**:
- 通过 MSYS2 安装: `pacman -S mingw-w64-x86_64-librsvg`
- 或下载预编译二进制文件并添加到 PATH

**Linux**:
```bash
sudo apt-get install librsvg2-bin
```

**macOS**:
```bash
brew install librsvg
```

### 3. 验证安装

```bash
rsvg-convert --version
```

### 4. 构建插件

```bash
pnpm run build
```

### 5. 部署

将 `dist/` 目录复制到 NapCat 的插件目录，或在开发环境使用：

```bash
pnpm run deploy
```

## 🌐 API 接口

### 获取服务状态

```http
GET /plugin/<plugin-id>/api/svg/status
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "installed": true,
    "version": "rsvg-convert version 2.50.0"
  }
}
```

### 渲染 SVG

```http
POST /plugin/<plugin-id>/api/svg/render
Content-Type: application/json

{
  "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"><rect width=\"100\" height=\"100\" fill=\"red\"/></svg>"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "imageBase64": "data:image/png;base64,iVBORw0KG...",
    "format": "png"
  }
}
```

**错误响应**:
```json
{
  "code": -1,
  "message": "rsvg-convert 未安装，请先安装 librsvg 工具"
}
```

## 🖥️ WebUI 使用

1. 打开 NapCat WebUI
2. 进入插件管理页面
3. 点击 "SVG渲染" 标签
4. 粘贴 SVG 代码或点击 "加载示例"
5. 点击 "渲染为 PNG" 按钮
6. 查看渲染结果并下载

## ⚙️ 配置说明

### 安全限制

| 限制项 | 默认值 | 说明 |
|--------|--------|------|
| SVG 最大大小 | 1MB | 防止过大的 SVG 文件 |
| PNG 最大大小 | 10MB | 防止生成过大的图片 |
| 渲染超时 | 30秒 | 防止复杂 SVG 阻塞 |

## 🛠️ 开发

### 开发命令

```bash
# 构建插件
pnpm run build

# 仅构建 WebUI
pnpm run build:webui

# WebUI 开发服务器
pnpm run dev:webui

# 类型检查
pnpm run typecheck

# 部署到 NapCat
pnpm run deploy
```

### 技术栈

- **后端**: TypeScript, Node.js
- **前端**: React 18, TypeScript, TailwindCSS
- **渲染**: rsvg-convert (librsvg)

## 📝 许可证

MIT License