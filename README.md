# NapCat SVG 渲染插件

一个 NapCat 插件，提供 SVG 转 PNG 渲染功能。通过 WebUI 界面或 API 接口将 SVG 代码渲染为 PNG 图片，支持外部图片下载和缓存管理。

## 功能特性

- **SVG 转 PNG**: 使用 rsvg-convert 工具高质量渲染 SVG 为 PNG
- **外部图片下载**: 自动下载 SVG 中引用的网络图片（`<image href="http://...">`）
- **图片缓存**: 支持缓存下载的网络图片，避免重复下载
- **缓存管理**: WebUI 提供缓存管理页面，可查看、删除、清空缓存
- **WebUI 界面**: 提供可视化界面，支持粘贴 SVG 代码、实时渲染预览
- **API 接口**: 提供 REST API，支持程序化调用
- **环境检测**: 自动检测 rsvg-convert 工具是否已安装
- **安全防护**: 输入大小限制、执行超时、命令注入防护

## 项目结构

```
napcat-plugin-svg-render/
├── src/
│   ├── index.ts              # 插件入口
│   ├── config.ts             # 配置定义
│   ├── types.ts              # TypeScript 类型定义
│   ├── core/
│   │   └── state.ts          # 全局状态管理
│   ├── services/
│   │   ├── api-service.ts    # API 路由
│   │   ├── svg-service.ts    # SVG 渲染服务
│   │   └── image-cache-service.ts  # 图片缓存服务
│   └── webui/                # React 前端
│       └── src/
│           ├── pages/
│           │   ├── SvgRenderPage.tsx    # SVG 渲染页面
│           │   ├── ApiDocsPage.tsx      # API 文档页面
│           │   └── CacheManagePage.tsx  # 缓存管理页面
│           └── ...
├── docs/
│   └── API.md                # 详细 API 文档
├── dist/                     # 构建产物
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

##  快速开始

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

### 6. 使用

> 如果渲染出来的SVG图片为方框乱码, 请检查你的 Linux 系统中是否安装中文字体: 
>
> ```bash
> # 安装文泉驿正黑
> sudo apt install fonts-wqy-zenhei
> # 安装思源字体
> sudo apt install fonts-noto-cjk
> ```

**在其他插件调用SVG渲染示例**

```ts
/**
* 调用 SVG 渲染插件接口
* @param baseUrl NapCat 基础 URL，如 http://127.0.0.1:6099
* @param svgCode SVG 代码字符串
* @param saveWebImage 是否缓存网络图片（可选，默认 false）
*/
async function renderSvg(
   baseUrl: string,
   svgCode: string,
   saveWebImage: boolean = false
): Promise<{ success: boolean; imageBase64?: string; message?: string }> {

   const url = `${baseUrl}/plugin/napcat-plugin-svg-render/api/svg/render`;

   try {
       const response = await fetch(url, {
           method: 'POST',
           headers: {
               'Content-Type': 'application/json',
           },
           body: JSON.stringify({
               svg: svgCode,
               saveWebImage: saveWebImage,
           }),
       });

       const result = await response.json() as {
           code: number;
           data?: { imageBase64: string; format: string };
           message?: string;
       };

       if (result.code === 0 && result.data) {
           return {
               success: true,
               imageBase64: result.data.imageBase64,
           };
       } else {
           return {
               success: false,
               message: result.message || '渲染失败',
           };
       }
   } catch (error) {
       return {
           success: false,
           message: error instanceof Error ? error.message : String(error),
       };
   }
}
```

---

**使用示例**

```ts
// 示例 1：基本使用
const svgCode = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
   <rect width="100" height="100" fill="red"/>
</svg>`;

const result = await renderSvg('http://127.0.0.1:6099', svgCode);
if (result.success) {
   // result.imageBase64 就是 PNG 图片的 base64 字符串
   console.log('渲染成功:', result.imageBase64.substring(0, 50) + '...');
}

// 示例 2：包含网络图片的 SVG（启用缓存）
const svgWithImage = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
   <image href="https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_medium.jpg" width="200" height="200"/>
   <text x="50%" y="50%" text-anchor="middle" fill="white">Hello</text>
</svg>`;

const result2 = await renderSvg('http://127.0.0.1:6099', svgWithImage, true);
// 设置 saveWebImage 为 true 会将网络图片缓存，下次渲染更快
```

---

**发送图片消息**

> ```ts
> /**
>  * 发送消息（通用）
>  * 根据消息类型自动发送到群或私聊
>  *
>  * @param ctx 插件上下文
>  * @param event 原始消息事件（用于推断回复目标）
>  * @param message 消息内容（支持字符串或消息段数组）
>  */
> export async function sendReply(
>     ctx: NapCatPluginContext,
>     event: OB11Message,
>     message: OB11MessageMixType,
> ): Promise<boolean> {
>     try {
>         const params: OB11PostSendMsg = {
>             message: message as unknown as any,
>             message_type: event.message_type,
>             ...(event.message_type === 'group' && event.group_id
>                 ? { group_id: String(event.group_id) }
>                 : {}),
>             ...(event.message_type === 'private' && event.user_id
>                 ? { user_id: String(event.user_id) }
>                 : {}),
>         };
>         await ctx.actions.call('send_msg', params, ctx.adapterName, ctx.pluginManager.config);
>         return true;
>     } catch (error) {
>         pluginState.logger.error('发送消息失败:', error);
>         return false;
>     }
> }
> ```

```ts
/**
 * 创建图片消息段
 */
export function createImageMessage(file: string): { type: 'image'; data: { file: string } } {
    return {
        type: 'image',
        data: { file }
    };
}

// 创建图片
const svgCode = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
   <rect width="100" height="100" fill="red"/>
</svg>`;
const result = await renderSvg('http://127.0.0.1:6099', svgCode);

// 发送图片 (base64编码格式图片)
if (result.success) {
	const imageMessage = createImageMessage(`base64://${result.imageBase64}`);
	await sendReply(ctx, event, imageMessage);
}
```



## API 接口

### 基础信息

- **Base URL**: `/plugin/napcat-plugin-svg-render/api`
- **认证**: 无需认证（NoAuth）
- **数据格式**: JSON

### SVG 渲染

```http
POST /plugin/napcat-plugin-svg-render/api/svg/render
Content-Type: application/json

{
  "svg": "<svg>...</svg>",
  "saveWebImage": false
}
```

**参数说明**:
- `svg` (string, 必填): SVG 代码字符串
- `saveWebImage` (boolean, 可选): 是否保存网络图片到缓存（默认 false）

**响应**:
```json
{
  "code": 0,
  "data": {
    "imageBase64": "iVBORw0KG...",
    "format": "image/png"
  }
}
```




### 服务状态

```http
GET /plugin/napcat-plugin-svg-render/api/svg/status
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

### 缓存管理 API

#### 获取缓存列表

```http
GET /plugin/napcat-plugin-svg-render/api/cache/list
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "url": "https://example.com/image.png",
        "localPath": "/path/to/cache/image.png",
        "size": 10240,
        "mtime": "2024-01-01T00:00:00.000Z"
      }
    ],
    "stats": {
      "count": 1,
      "size": 10240
    },
    "maxSize": 50
  }
}
```

#### 设置最大缓存

```http
POST /plugin/napcat-plugin-svg-render/api/cache/settings
Content-Type: application/json

{
  "maxSize": 100
}
```

#### 删除缓存

```http
POST /plugin/napcat-plugin-svg-render/api/cache/delete
Content-Type: application/json

{
  "url": "https://example.com/image.png"
}
```

#### 清空缓存

```http
POST /plugin/napcat-plugin-svg-render/api/cache/clear
```

#### 查看缓存图片

```http
GET /plugin/napcat-plugin-svg-render/api/cache/image?url=https://example.com/image.png
```

详细 API 文档请查看 [docs/API.md](docs/API.md)。

## WebUI 使用

### SVG 渲染

1. 打开 NapCat WebUI
2. 进入插件管理页面
3. 点击 "SVG渲染" 标签
4. 粘贴 SVG 代码或点击 "加载示例"
5. 点击 "渲染为 PNG" 按钮
6. 查看渲染结果并下载

### 缓存管理

1. 点击 "缓存管理" 标签
2. 查看当前缓存统计（数量、大小、限制）
3. 调整最大缓存大小（10-500MB）
4. 查看缓存列表
5. 点击 👁️ 预览缓存图片
6. 点击 🗑️ 删除单个缓存
7. 点击 "清空所有缓存" 清空全部

### API 文档

点击 "API文档" 标签查看完整的 API 接口文档。

## 配置说明

### 缓存目录

插件会在数据目录下创建以下子目录：

- `temp/`: 临时文件（渲染时自动清理）
- `cache-image/`: 缓存的网络图片（持久化）

### 安全限制

| 限制项 | 默认值 | 说明 |
|--------|--------|------|
| SVG 最大大小 | 1MB | 防止过大的 SVG 文件 |
| PNG 最大大小 | 10MB | 防止生成过大的图片 |
| 图片最大大小 | 5MB | 单个网络图片限制 |
| 渲染超时 | 30秒 | 防止复杂 SVG 阻塞 |
| 最大缓存 | 50MB | 可配置 (10-500MB) |

## 开发

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

## 许可证

GPL-3
