# SVG 渲染插件开发计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 开发一个 NapCat 插件，提供 SVG 转 PNG 渲染功能，通过 `/svg/render` API 接口调用，使用 rsvg-convert 工具处理，并包含 WebUI 渲染器示例页面。

**Architecture:** 遵循现有插件架构，在 `src/services/` 添加 svg-service.ts 核心服务模块，在 `src/services/api-service.ts` 注册 `/svg/render` 和 `/svg/status` API 路由，在 WebUI 添加 SVG 渲染器页面。使用临时文件存储 SVG，调用 rsvg-convert 命令行工具渲染，返回 base64 PNG 数据。

**Tech Stack:** TypeScript, Node.js, React, TailwindCSS, rsvg-convert

---

## 前置检查

**Step 0: 确认项目结构**

Run: `ls src/`
Expected: 存在 `config.ts`, `index.ts`, `types.ts`, `core/`, `handlers/`, `services/`, `webui/` 等目录和文件

---

## Task 1: 添加类型定义

**Files:**
- Modify: `src/types.ts`

**Step 1: 添加 SVG 渲染相关类型**

```typescript
// SVG 渲染请求
export interface SvgRenderRequest {
    svg: string;
}

// SVG 渲染响应
export interface SvgRenderResponse {
    imageBase64: string;
    format: 'png';
}

// SVG 服务状态
export interface SvgServiceStatus {
    installed: boolean;
    version?: string;
}
```

添加到 `src/types.ts` 文件中，放在 `PluginConfig` 接口之后。

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add SVG render types"
```

---

## Task 2: 创建 SVG 渲染服务

**Files:**
- Create: `src/services/svg-service.ts`

**Step 1: 实现 SVG 服务类**

```typescript
/**
 * SVG 渲染服务模块
 * 使用 rsvg-convert 工具将 SVG 转换为 PNG
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { SvgServiceStatus } from '../types';

const execAsync = promisify(exec);

export class SvgService {
    private ctx: NapCatPluginContext;
    private tempDir: string;

    constructor(ctx: NapCatPluginContext) {
        this.ctx = ctx;
        this.tempDir = path.join(ctx.dataPath, 'temp');
        this.ensureTempDir();
    }

    /**
     * 确保临时目录存在
     */
    private ensureTempDir(): void {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
            this.ctx.logger.info(`创建临时目录: ${this.tempDir}`);
        }
    }

    /**
     * 检查 rsvg-convert 是否已安装
     */
    async checkStatus(): Promise<SvgServiceStatus> {
        try {
            const { stdout } = await execAsync('rsvg-convert --version');
            const version = stdout.trim().split('\n')[0];
            return {
                installed: true,
                version: version || 'unknown',
            };
        } catch {
            return {
                installed: false,
            };
        }
    }

    /**
     * 将 SVG 字符串渲染为 PNG 的 base64
     * @param svgContent SVG 内容字符串
     * @returns base64 编码的 PNG 图片
     */
    async renderSvgToPng(svgContent: string): Promise<string> {
        // 检查 rsvg-convert 是否可用
        const status = await this.checkStatus();
        if (!status.installed) {
            throw new Error('rsvg-convert 未安装，请先安装 librsvg 工具');
        }

        // 限制 SVG 大小（最大 1MB）
        const MAX_SIZE = 1024 * 1024;
        if (Buffer.byteLength(svgContent, 'utf8') > MAX_SIZE) {
            throw new Error('SVG 内容过大，最大支持 1MB');
        }

        const id = crypto.randomUUID();
        const inputPath = path.join(this.tempDir, `${id}.svg`);
        const outputPath = path.join(this.tempDir, `${id}.png`);

        try {
            // 写入 SVG 文件
            fs.writeFileSync(inputPath, svgContent, 'utf8');
            this.ctx.logger.debug(`写入临时 SVG 文件: ${inputPath}`);

            // 执行 rsvg-convert
            await execAsync(`rsvg-convert "${inputPath}" > "${outputPath}"`);
            this.ctx.logger.debug(`渲染完成: ${outputPath}`);

            // 读取 PNG 并转换为 base64
            const pngBuffer = fs.readFileSync(outputPath);
            const base64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;

            return base64;
        } finally {
            // 清理临时文件
            this.cleanup(inputPath, outputPath);
        }
    }

    /**
     * 清理临时文件
     */
    private cleanup(...files: string[]): void {
        for (const file of files) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    this.ctx.logger.debug(`删除临时文件: ${file}`);
                }
            } catch (err) {
                this.ctx.logger.warn(`删除临时文件失败: ${file}`, err);
            }
        }
    }
}
```

**Step 2: Commit**

```bash
git add src/services/svg-service.ts
git commit -m "feat(svg): add SVG render service with rsvg-convert"
```

---

## Task 3: 注册 API 路由

**Files:**
- Modify: `src/services/api-service.ts`

**Step 1: 导入 SVG 服务并创建实例**

在文件顶部添加导入：

```typescript
import { SvgService } from './svg-service';
```

在 `registerApiRoutes` 函数开头创建实例：

```typescript
export function registerApiRoutes(ctx: NapCatPluginContext): void {
    const router = ctx.router;
    const svgService = new SvgService(ctx);

    // ... 现有代码 ...
```

**Step 2: 添加 SVG 状态检查接口**

在文件末尾（`TODO: 在这里添加你的自定义 API 路由` 注释处）添加：

```typescript
    // ==================== SVG 渲染服务（无鉴权）====================

    /** 获取 SVG 服务状态 */
    router.getNoAuth('/svg/status', async (_req, res) => {
        try {
            const status = await svgService.checkStatus();
            res.json({ code: 0, data: status });
        } catch (err) {
            ctx.logger.error('获取 SVG 服务状态失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** SVG 渲染接口 */
    router.postNoAuth('/svg/render', async (req, res) => {
        try {
            const body = req.body as { svg?: string } | undefined;
            
            if (!body || !body.svg) {
                return res.status(400).json({ code: -1, message: '缺少 svg 参数' });
            }

            const imageBase64 = await svgService.renderSvgToPng(body.svg);
            
            res.json({
                code: 0,
                data: {
                    imageBase64,
                    format: 'png',
                },
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            ctx.logger.error('SVG 渲染失败:', err);
            res.status(500).json({ code: -1, message });
        }
    });
```

**Step 3: Commit**

```bash
git add src/services/api-service.ts
git commit -m "feat(api): add /svg/render and /svg/status endpoints"
```

---

## Task 4: 同步 WebUI 类型

**Files:**
- Modify: `src/webui/src/types.ts`

**Step 1: 添加 SVG 相关类型**

```typescript
// SVG 渲染请求
export interface SvgRenderRequest {
    svg: string;
}

// SVG 渲染响应
export interface SvgRenderResponse {
    imageBase64: string;
    format: 'png';
}

// SVG 服务状态
export interface SvgServiceStatus {
    installed: boolean;
    version?: string;
}
```

添加到文件末尾。

**Step 2: Commit**

```bash
git add src/webui/src/types.ts
git commit -m "feat(webui-types): add SVG render types"
```

---

## Task 5: 扩展 WebUI API 客户端

**Files:**
- Modify: `src/webui/src/utils/api.ts`

**Step 1: 添加导入和函数**

在文件顶部添加类型导入：

```typescript
import type { SvgRenderRequest, SvgRenderResponse, SvgServiceStatus } from '../types';
```

在文件末尾添加函数：

```typescript
/**
 * 获取 SVG 服务状态
 */
export async function getSvgServiceStatus(): Promise<ApiResponse<SvgServiceStatus>> {
    return noAuthFetch<SvgServiceStatus>('/svg/status');
}

/**
 * 渲染 SVG 为 PNG
 */
export async function renderSvg(svg: string): Promise<ApiResponse<SvgRenderResponse>> {
    return noAuthFetch<SvgRenderResponse>('/svg/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ svg } as SvgRenderRequest),
    });
}
```

**Step 2: Commit**

```bash
git add src/webui/src/utils/api.ts
git commit -m "feat(api-client): add SVG render API functions"
```

---

## Task 6: 创建 SVG 渲染器页面

**Files:**
- Create: `src/webui/src/pages/SvgRenderPage.tsx`

**Step 1: 实现渲染页面**

```typescript
import { useState, useEffect } from 'react';
import { getSvgServiceStatus, renderSvg } from '../utils/api';
import { useToast } from '../hooks/useToast';
import type { SvgServiceStatus } from '../types';

export function SvgRenderPage() {
    const [svgInput, setSvgInput] = useState('');
    const [renderedImage, setRenderedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<SvgServiceStatus | null>(null);
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);
    const { showToast } = useToast();

    // 检查 rsvg-convert 状态
    useEffect(() => {
        checkStatus();
    }, []);

    async function checkStatus() {
        setIsCheckingStatus(true);
        try {
            const res = await getSvgServiceStatus();
            if (res.code === 0 && res.data) {
                setStatus(res.data);
            } else {
                showToast(res.message || '获取状态失败', 'error');
            }
        } catch (err) {
            showToast('检查服务状态失败', 'error');
        } finally {
            setIsCheckingStatus(false);
        }
    }

    async function handleRender() {
        if (!svgInput.trim()) {
            showToast('请输入 SVG 代码', 'warning');
            return;
        }

        setIsLoading(true);
        try {
            const res = await renderSvg(svgInput);
            if (res.code === 0 && res.data) {
                setRenderedImage(res.data.imageBase64);
                showToast('渲染成功', 'success');
            } else {
                showToast(res.message || '渲染失败', 'error');
            }
        } catch (err) {
            showToast('渲染请求失败', 'error');
        } finally {
            setIsLoading(false);
        }
    }

    // 示例 SVG
    const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <rect width="200" height="100" fill="#FB7299"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-size="20" fill="white" font-family="Arial">
    Hello SVG!
  </text>
</svg>`;

    function loadSample() {
        setSvgInput(sampleSvg);
        setRenderedImage(null);
    }

    return (
        <div className="space-y-6">
            {/* 标题 */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    SVG 渲染器
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    使用 rsvg-convert 将 SVG 转换为 PNG 图片
                </p>
            </div>

            {/* 状态卡片 */}
            <div className={`p-4 rounded-lg border ${
                status?.installed
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            rsvg-convert 状态
                        </h3>
                        {isCheckingStatus ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400">检查中...</p>
                        ) : status?.installed ? (
                            <p className="text-sm text-green-700 dark:text-green-400">
                                已安装 {status.version ? `(${status.version})` : ''}
                            </p>
                        ) : (
                            <p className="text-sm text-red-700 dark:text-red-400">
                                未安装，请先安装 librsvg 工具
                            </p>
                        )}
                    </div>
                    <div className={`w-3 h-3 rounded-full ${
                        status?.installed ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                </div>
            </div>

            {/* 输入区域 */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        SVG 代码
                    </label>
                    <button
                        onClick={loadSample}
                        className="text-sm text-[#FB7299] hover:text-[#fc8bab] transition-colors"
                    >
                        加载示例
                    </button>
                </div>
                <textarea
                    value={svgInput}
                    onChange={(e) => setSvgInput(e.target.value)}
                    placeholder="在此粘贴 SVG 代码..."
                    className="w-full h-48 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-[#FB7299] focus:border-transparent
                             font-mono text-sm resize-y"
                    spellCheck={false}
                />
            </div>

            {/* 渲染按钮 */}
            <button
                onClick={handleRender}
                disabled={isLoading || !status?.installed}
                className="w-full py-3 px-4 bg-[#FB7299] hover:bg-[#fc8bab] text-white font-medium rounded-lg
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle
                                className="opacity-25"
                                cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"
                                fill="none"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        渲染中...
                    </>
                ) : (
                    '渲染为 PNG'
                )}
            </button>

            {/* 结果展示 */}
            {renderedImage && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        渲染结果
                    </label>
                    <div className="p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                        <img
                            src={renderedImage}
                            alt="Rendered SVG"
                            className="max-w-full h-auto mx-auto"
                        />
                    </div>
                    <a
                        href={renderedImage}
                        download="rendered.png"
                        className="block text-center text-sm text-[#FB7299] hover:text-[#fc8bab] transition-colors"
                    >
                        下载图片
                    </a>
                </div>
            )}
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add src/webui/src/pages/SvgRenderPage.tsx
git commit -m "feat(webui): add SVG render page with preview"
```

---

## Task 7: 更新 WebUI 路由

**Files:**
- Modify: `src/webui/src/App.tsx`

**Step 1: 导入新页面并添加路由**

导入新页面：

```typescript
import { SvgRenderPage } from './pages/SvgRenderPage';
```

在路由配置中添加：

```typescript
const routes: Route[] = [
    // ... 现有路由 ...
    {
        id: 'svg-render',
        label: 'SVG 渲染器',
        icon: 'image', // 使用图片图标
        component: SvgRenderPage,
    },
];
```

**Step 2: Commit**

```bash
git add src/webui/src/App.tsx
git commit -m "feat(routing): add SVG render page route"
```

---

## Task 8: 更新侧边栏导航

**Files:**
- Modify: `src/webui/src/components/Sidebar.tsx`

**Step 1: 添加图片图标**

在 `icons.tsx` 中找到图标组件，添加一个图片/SVG 图标，或使用现有图标。

如果需要在 `icons.tsx` 添加新图标：

```typescript
export function ImageIcon({ className }: IconProps) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    );
}
```

然后在 `Sidebar.tsx` 的图标映射中添加：

```typescript
import { ImageIcon } from './icons';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    // ... 现有图标 ...
    image: ImageIcon,
};
```

**Step 2: Commit**

```bash
git add src/webui/src/components/Sidebar.tsx src/webui/src/components/icons.tsx
git commit -m "feat(ui): add image icon for SVG render page"
```

---

## Task 9: 构建并测试

**Step 1: 构建 WebUI**

```bash
cd src/webui
pnpm install
pnpm run build
cd ../..
```

Expected: WebUI 构建成功，生成 `src/webui/dist/index.html`

**Step 2: 构建插件**

```bash
pnpm install
pnpm run build
```

Expected: 构建成功，生成 `dist/` 目录

**Step 3: Commit 构建结果**

```bash
git add dist/ src/webui/dist/
git commit -m "chore(build): build webui and plugin"
```

---

## Task 10: 功能验证

**Step 1: 检查 rsvg-convert 是否安装**

Run: `rsvg-convert --version`
Expected: 显示版本号（如 `rsvg-convert version 2.50.0`）

如果未安装，需要安装：
- Windows: 通过 MSYS2 或下载预编译二进制文件
- Linux: `sudo apt-get install librsvg2-bin`
- macOS: `brew install librsvg`

**Step 2: 测试 API 接口**

启动 NapCat 并加载插件后，测试 API：

```bash
curl -X POST http://localhost:3000/plugin/<plugin-id>/api/svg/render \
  -H "Content-Type: application/json" \
  -d '{"svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\"><rect width=\"100\" height=\"100\" fill=\"red\"/></svg>"}'
```

Expected: 返回 `{"code": 0, "data": {"imageBase64": "data:image/png;base64,...", "format": "png"}}`

**Step 3: 测试 WebUI**

1. 打开 NapCat WebUI
2. 进入插件管理页面
3. 点击 "SVG 渲染器" 标签
4. 粘贴 SVG 代码，点击渲染
5. 验证图片是否正确显示

---

## 总结

完成以上所有任务后，插件将具备以下功能：

1. **后端 API**:
   - `GET /plugin/<id>/api/svg/status` - 检查 rsvg-convert 安装状态
   - `POST /plugin/<id>/api/svg/render` - 将 SVG 渲染为 PNG

2. **WebUI 页面**:
   - 显示 rsvg-convert 安装状态
   - 支持输入 SVG 代码并渲染
   - 预览渲染结果
   - 支持下载 PNG 图片

3. **错误处理**:
   - rsvg-convert 未安装时返回明确错误
   - SVG 内容过大时拒绝处理
   - 临时文件自动清理
