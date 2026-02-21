# 网络图片缓存功能计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 `/svg/render` API 中添加 `saveWebImage` 配置选项，实现网络图片的缓存机制。当启用时，将下载的图片保存在 `cache-image` 目录，并维护一个映射表来避免重复下载。

**Architecture:** 
1. 修改 API 接口接收 `saveWebImage` 参数
2. 创建图片缓存服务，管理 `cache-image` 目录和映射表 JSON
3. 修改 SVG 服务，支持从缓存读取和保存到缓存
4. 更新 WebUI API 文档

---

## Task 1: 更新类型定义

**Files:**
- Modify: `src/types.ts`
- Modify: `src/webui/src/types.ts`

**Step 1: 添加缓存相关类型到后端 types.ts**

在文件中添加：

```typescript
// 图片缓存映射表
export interface ImageCacheMap {
    [imageUrl: string]: string; // 网络URL -> 本地路径
}

// 更新 SVG 渲染请求
export interface SvgRenderRequest {
    svg: string;
    saveWebImage?: boolean; // 是否保存网络图片到缓存
}
```

**Step 2: 更新前端 types.ts**

```typescript
export interface SvgRenderRequest {
    svg: string
    saveWebImage?: boolean
}

export interface ImageCacheMap {
    [imageUrl: string]: string
}
```

**Step 3: Commit**

```bash
git add src/types.ts src/webui/src/types.ts
git commit -m "feat(types): add saveWebImage option and ImageCacheMap types"
```

---

## Task 2: 创建图片缓存服务

**Files:**
- Create: `src/services/image-cache-service.ts`

**Step 1: 实现 ImageCacheService 类**

```typescript
/**
 * 图片缓存服务
 * 管理网络图片的缓存，避免重复下载
 */

import * as fs from 'fs';
import * as path from 'path';
import { fetch } from 'undici'; // 或使用 node-fetch
import * as crypto from 'crypto';
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { ImageCacheMap } from '../types';

const CACHE_DIR_NAME = 'cache-image';
const CACHE_MAP_FILE = 'image-cache-map.json';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB 总缓存限制

export class ImageCacheService {
    private ctx: NapCatPluginContext;
    private cacheDir: string;
    private mapFilePath: string;
    private cacheMap: ImageCacheMap = {};

    constructor(ctx: NapCatPluginContext) {
        this.ctx = ctx;
        this.cacheDir = path.join(ctx.dataPath, CACHE_DIR_NAME);
        this.mapFilePath = path.join(ctx.dataPath, CACHE_MAP_FILE);
        this.ensureCacheDir();
        this.loadCacheMap();
    }

    /**
     * 确保缓存目录存在
     */
    private ensureCacheDir(): void {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
            this.ctx.logger.info('图片缓存目录已创建');
        }
    }

    /**
     * 加载缓存映射表
     */
    private loadCacheMap(): void {
        try {
            if (fs.existsSync(this.mapFilePath)) {
                const data = fs.readFileSync(this.mapFilePath, 'utf8');
                this.cacheMap = JSON.parse(data);
                this.ctx.logger.debug(`已加载图片缓存映射表，共 ${Object.keys(this.cacheMap).length} 条记录`);
            }
        } catch (err) {
            this.ctx.logger.warn('加载图片缓存映射表失败:', err);
            this.cacheMap = {};
        }
    }

    /**
     * 保存缓存映射表
     */
    private saveCacheMap(): void {
        try {
            fs.writeFileSync(this.mapFilePath, JSON.stringify(this.cacheMap, null, 2), 'utf8');
            this.ctx.logger.debug('图片缓存映射表已保存');
        } catch (err) {
            this.ctx.logger.warn('保存图片缓存映射表失败:', err);
        }
    }

    /**
     * 从缓存获取图片，如果不存在则下载
     * @param imageUrl 网络图片URL
     * @returns 本地图片路径
     */
    async getOrDownloadImage(imageUrl: string): Promise<string | null> {
        // 1. 检查缓存映射表
        if (this.cacheMap[imageUrl] && fs.existsSync(this.cacheMap[imageUrl])) {
            this.ctx.logger.debug(`缓存命中: ${imageUrl}`);
            return this.cacheMap[imageUrl];
        }

        // 2. 下载图片
        const localPath = await this.downloadImage(imageUrl);
        if (localPath) {
            // 3. 更新映射表
            this.cacheMap[imageUrl] = localPath;
            this.saveCacheMap();
        }

        return localPath;
    }

    /**
     * 下载图片到缓存目录
     */
    private async downloadImage(imageUrl: string): Promise<string | null> {
        try {
            const url = new URL(imageUrl);
            const ext = path.extname(url.pathname) || '.png';
            const filename = `${crypto.randomUUID()}${ext}`;
            const localPath = path.join(this.cacheDir, filename);

            this.ctx.logger.info(`下载网络图片到缓存: ${imageUrl}`);

            // 检查总缓存大小，如果超过限制则清理旧缓存
            await this.cleanupIfNeeded();

            // 下载图片
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(imageUrl, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // 检查单个文件大小（最大 5MB）
            const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
            if (buffer.length > MAX_IMAGE_SIZE) {
                throw new Error('图片过大，最大支持 5MB');
            }

            // 保存到缓存目录
            fs.writeFileSync(localPath, buffer);
            this.ctx.logger.info(`图片已缓存: ${localPath}`);

            return localPath;
        } catch (err) {
            this.ctx.logger.warn(`下载图片失败: ${imageUrl}`, err);
            return null;
        }
    }

    /**
     * 检查并清理缓存（如果超过总大小限制）
     */
    private async cleanupIfNeeded(): Promise<void> {
        try {
            let totalSize = 0;
            const files: { path: string; mtime: Date; size: number }[] = [];

            // 计算缓存目录总大小
            const cacheFiles = fs.readdirSync(this.cacheDir);
            for (const file of cacheFiles) {
                const filePath = path.join(this.cacheDir, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    totalSize += stats.size;
                    files.push({ path: filePath, mtime: stats.mtime, size: stats.size });
                }
            }

            // 如果超过限制，删除最旧的文件
            if (totalSize > MAX_CACHE_SIZE) {
                // 按修改时间排序（最旧的在前）
                files.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

                let sizeToFree = totalSize - MAX_CACHE_SIZE + 10 * 1024 * 1024; // 多清理 10MB
                for (const file of files) {
                    if (sizeToFree <= 0) break;

                    fs.unlinkSync(file.path);
                    sizeToFree -= file.size;

                    // 从映射表中删除
                    for (const [url, cachedPath] of Object.entries(this.cacheMap)) {
                        if (cachedPath === file.path) {
                            delete this.cacheMap[url];
                            break;
                        }
                    }

                    this.ctx.logger.info(`清理旧缓存: ${file.path}`);
                }

                this.saveCacheMap();
            }
        } catch (err) {
            this.ctx.logger.warn('清理缓存失败:', err);
        }
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats(): { count: number; size: number } {
        try {
            let size = 0;
            const files = fs.readdirSync(this.cacheDir);
            for (const file of files) {
                const stats = fs.statSync(path.join(this.cacheDir, file));
                if (stats.isFile()) {
                    size += stats.size;
                }
            }
            return { count: files.length, size };
        } catch {
            return { count: 0, size: 0 };
        }
    }
}
```

**Step 2: Commit**

```bash
git add src/services/image-cache-service.ts
git commit -m "feat(cache): add ImageCacheService for web image caching"
```

---

## Task 3: 修改 SVG 服务支持缓存

**Files:**
- Modify: `src/services/svg-service.ts`

**Step 1: 导入 ImageCacheService 并修改 renderSvgToPng**

```typescript
import { ImageCacheService } from './image-cache-service';

// 在 constructor 中添加
private imageCacheService: ImageCacheService;

constructor(ctx: NapCatPluginContext) {
    this.ctx = ctx;
    this.tempDir = path.join(ctx.dataPath, 'temp');
    this.imageCacheService = new ImageCacheService(ctx);
    this.ensureTempDir();
}

// 修改 renderSvgToPng 方法签名
async renderSvgToPng(svgContent: string, saveWebImage: boolean = false): Promise<string> {
    // ... 前置检查不变 ...

    try {
        // 处理外部图片（传入 saveWebImage 参数）
        const { processedSvg, downloadedFiles } = await this.processExternalImages(
            svgContent, 
            saveWebImage
        );
        // ... 后续逻辑不变 ...
    } finally {
        // 如果不保存缓存，清理临时下载的文件
        if (!saveWebImage) {
            this.cleanup(...downloadedImages);
        }
        this.cleanup(inputPath, outputPath);
    }
}

// 修改 processExternalImages 方法
private async processExternalImages(
    svgContent: string, 
    saveWebImage: boolean
): Promise<{ processedSvg: string; downloadedFiles: string[] }> {
    // ... 正则匹配逻辑不变 ...

    const downloads: Promise<void>[] = [];
    
    for (const { imageUrl } of matches) {
        const downloadPromise = (async () => {
            let localPath: string | null = null;
            
            if (saveWebImage) {
                // 使用缓存服务获取或下载
                localPath = await this.imageCacheService.getOrDownloadImage(imageUrl);
            } else {
                // 直接下载到临时目录（原有逻辑）
                localPath = await this.downloadImageToTemp(imageUrl);
            }
            
            if (localPath) {
                downloadedFiles.push(localPath);
                processedSvg = processedSvg.split(imageUrl).join(localPath);
            }
        })();
        
        downloads.push(downloadPromise);
    }

    await Promise.all(downloads);

    return { processedSvg, downloadedFiles };
}

// 重命名原来的 downloadImage 为 downloadImageToTemp
private async downloadImageToTemp(imageUrl: string): Promise<string | null> {
    // 原有下载逻辑，下载到 tempDir
}
```

**Step 2: Commit**

```bash
git add src/services/svg-service.ts
git commit -m "feat(svg): integrate ImageCacheService with saveWebImage option"
```

---

## Task 4: 更新 API 路由

**Files:**
- Modify: `src/services/api-service.ts`

**Step 1: 修改 /svg/render 接口接收 saveWebImage 参数**

```typescript
/** SVG 渲染接口 */
router.postNoAuth('/svg/render', async (req, res) => {
    try {
        const body = req.body as { svg?: string; saveWebImage?: boolean } | undefined;

        if (!body || !body.svg) {
            return res.status(400).json({ code: -1, message: '缺少 svg 参数' });
        }

        const saveWebImage = body.saveWebImage ?? false;
        const imageBase64 = await svgService.renderSvgToPng(body.svg, saveWebImage);

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

**Step 2: Commit**

```bash
git add src/services/api-service.ts
git commit -m "feat(api): add saveWebImage parameter to /svg/render"
```

---

## Task 5: 更新 WebUI API 文档

**Files:**
- Modify: `src/webui/src/pages/ApiDocsPage.tsx`

**Step 1: 更新 /svg/render 接口文档**

```typescript
const apiEndpoints: ApiEndpoint[] = [
    // ... status 接口不变 ...
    {
        method: 'POST',
        path: '/svg/render',
        description: '将 SVG 代码渲染为 PNG 图片，支持网络图片缓存',
        params: [
            { name: 'svg', type: 'string', required: true, description: 'SVG 代码字符串' },
            { 
                name: 'saveWebImage', 
                type: 'boolean', 
                required: false, 
                description: '是否缓存网络图片到本地（默认 false）。启用后，SVG 中的网络图片会被下载并缓存，下次渲染相同图片时直接使用缓存' 
            }
        ],
        response: {
            code: 0,
            data: {
                imageBase64: 'data:image/png;base64,iVBORw0KG...',
                format: 'png'
            }
        },
        example: {
            request: {
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><image href="https://example.com/img.png" width="100" height="100"/></svg>',
                saveWebImage: true
            },
            response: {
                code: 0,
                data: {
                    imageBase64: 'data:image/png;base64,iVBORw0KG...',
                    format: 'png'
                }
            }
        }
    }
];
```

**Step 2: 添加缓存功能说明**

在页面中添加缓存说明部分：

```typescript
{/* 缓存功能说明 */}
<div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
    <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">
        网络图片缓存
    </h3>
    <ul className="text-sm text-purple-800 dark:text-purple-300 space-y-1">
        <li>• 设置 <code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">saveWebImage: true</code> 启用缓存</li>
        <li>• 缓存位置: <code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">cache-image/</code> 目录</li>
        <li>• 缓存限制: 单个文件最大 5MB，总缓存最大 50MB</li>
        <li>• 自动清理: 超过限制时自动删除最旧的缓存文件</li>
    </ul>
</div>
```

**Step 3: Commit**

```bash
git add src/webui/src/pages/ApiDocsPage.tsx
git commit -m "feat(webui): update API docs with saveWebImage option"
```

---

## Task 6: 更新 API 客户端

**Files:**
- Modify: `src/webui/src/utils/api.ts`

**Step 1: 更新 renderSvg 函数**

```typescript
/**
 * 渲染 SVG 为 PNG
 */
export async function renderSvg(
    svg: string, 
    saveWebImage?: boolean
): Promise<ApiResponse<SvgRenderResponse>> {
    const body: SvgRenderRequest = { svg };
    if (saveWebImage !== undefined) {
        body.saveWebImage = saveWebImage;
    }
    
    return noAuthFetch<SvgRenderResponse>('/svg/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}
```

**Step 2: Commit**

```bash
git add src/webui/src/utils/api.ts
git commit -m "feat(api-client): update renderSvg with saveWebImage option"
```

---

## Task 7: 构建并测试

**Step 1: 构建 WebUI**

```bash
cd src/webui && pnpm run build
cd ../..
```

**Step 2: 构建插件**

```bash
pnpm run build
```

**Step 3: 测试**

1. 测试不带 saveWebImage（默认行为）
2. 测试 saveWebImage: true（缓存图片）
3. 测试重复渲染（使用缓存）
4. 验证映射表文件是否正确生成
5. 验证缓存目录是否正确创建

---

## 功能说明

新功能工作流程：

```
1. 用户调用 /svg/render
   └─> saveWebImage: true

2. 检查 SVG 中的网络图片
   └─> 检查映射表是否存在该图片
       ├─> 存在: 直接使用缓存路径
       └─> 不存在: 
           ├─> 下载图片到 cache-image/
           ├─> 更新映射表 (image-cache-map.json)
           └─> 使用新下载的图片路径

3. 渲染 SVG
   └─> 使用本地缓存的图片

4. 清理
   └─> 保留缓存文件供下次使用
```

缓存管理：
- 自动清理：总缓存超过 50MB 时删除最旧文件
- 映射表持久化：保存为 JSON 文件
- 缓存命中：直接复用已下载图片
