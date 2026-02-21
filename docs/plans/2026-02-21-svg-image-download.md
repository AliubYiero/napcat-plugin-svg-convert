# SVG 外部图片下载处理计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在渲染 SVG 图片之前，检查 SVG 代码中是否存在使用网络链接的 `<image>` 标签，如果存在，将图片通过 fetch 下载到 tempDir，替换成本地图片路径。

**Architecture:** 在 `svg-service.ts` 的 `renderSvgToPng` 方法中，添加预处理步骤：解析 SVG 字符串，查找所有 `<image>` 标签的 `href` 属性，识别网络链接（http/https），下载图片到临时目录，替换 SVG 中的链接为本地路径，然后再执行渲染。

**Tech Stack:** TypeScript, Node.js, fetch API

---

## Task 1: 添加图片下载和 SVG 处理方法

**Files:**
- Modify: `src/services/svg-service.ts`

**Step 1: 添加 XML 解析和图片下载方法**

在 `SvgService` 类中添加以下私有方法：

```typescript
    /**
     * 解析 SVG 并下载外部图片
     * @param svgContent SVG 内容
     * @returns 处理后的 SVG 内容
     */
    private async processExternalImages(svgContent: string): Promise<string> {
        // 简单的正则匹配查找 xlink:href 和 href 属性中的网络图片
        const imageRegex = /<image[^>]*?(?:xlink:href|href)=["'](https?:\/\/[^"']+)["'][^>]*?>/gi;
        let processedSvg = svgContent;
        let match: RegExpExecArray | null;
        
        const downloads: Promise<void>[] = [];
        const replacements: { from: string; to: string }[] = [];

        // 收集所有需要下载的图片
        while ((match = imageRegex.exec(svgContent)) !== null) {
            const fullTag = match[0];
            const imageUrl = match[1];
            
            const downloadPromise = this.downloadImage(imageUrl).then((localPath) => {
                if (localPath) {
                    replacements.push({ from: imageUrl, to: localPath });
                }
            });
            
            downloads.push(downloadPromise);
        }

        // 等待所有下载完成
        await Promise.all(downloads);

        // 替换 SVG 中的链接
        for (const { from, to } of replacements) {
            processedSvg = processedSvg.replace(from, to);
        }

        return processedSvg;
    }

    /**
     * 下载图片到临时目录
     * @param imageUrl 图片 URL
     * @returns 本地文件路径，下载失败返回 null
     */
    private async downloadImage(imageUrl: string): Promise<string | null> {
        try {
            const url = new URL(imageUrl);
            const ext = path.extname(url.pathname) || '.png';
            const filename = `img_${crypto.randomUUID()}${ext}`;
            const localPath = path.join(this.tempDir, filename);

            this.ctx.logger.debug(`下载外部图片: ${imageUrl}`);

            // 使用 fetch 下载图片
            const response = await fetch(imageUrl, {
                timeout: 30000, // 30秒超时
            } as any);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // 检查文件大小（最大 5MB）
            const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
            if (buffer.length > MAX_IMAGE_SIZE) {
                throw new Error('图片过大，最大支持 5MB');
            }

            // 保存到临时目录
            fs.writeFileSync(localPath, buffer);
            this.ctx.logger.debug(`图片已保存: ${localPath}`);

            return localPath;
        } catch (err) {
            this.ctx.logger.warn(`下载图片失败: ${imageUrl}`, err);
            return null;
        }
    }
```

**Step 2: 修改 renderSvgToPng 方法**

在 `renderSvgToPng` 方法中，在写入 SVG 文件之前添加预处理步骤：

```typescript
    async renderSvgToPng(svgContent: string): Promise<string> {
        // ... 前置检查不变 ...

        const id = crypto.randomUUID();
        const inputPath = path.join(this.tempDir, `${id}.svg`);
        const outputPath = path.join(this.tempDir, `${id}.png`);
        const downloadedImages: string[] = [];

        try {
            // 处理外部图片
            const processedSvg = await this.processExternalImages(svgContent);
            
            // 写入 SVG 文件
            fs.writeFileSync(inputPath, processedSvg, 'utf8');
            this.ctx.logger.debug('写入临时 SVG 文件');

            // ... 渲染逻辑不变 ...

        } finally {
            // 清理临时文件（包括下载的图片）
            this.cleanup(inputPath, outputPath, ...downloadedImages);
        }
    }
```

**Step 3: 修改 cleanup 方法支持多个文件**

确保 `cleanup` 方法可以接受额外参数：

```typescript
    private cleanup(...files: string[]): void {
        for (const file of files) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    this.ctx.logger.debug(`删除临时文件: ${file}`);
                }
            } catch (err) {
                this.ctx.logger.warn(`删除临时文件失败`, err);
            }
        }
    }
```

**Step 4: Commit**

```bash
git add src/services/svg-service.ts
git commit -m "feat(svg): download external images before rendering"
```

---

## Task 2: 重新构建并测试

**Step 1: 构建插件**

```bash
pnpm run build
```

**Step 2: 测试**

使用包含外部图片的 SVG 进行测试：

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
  <image href="https://example.com/image.png" width="100" height="100"/>
  <rect x="110" y="0" width="100" height="100" fill="red"/>
</svg>
```

验证：
1. 外部图片是否被下载到 tempDir
2. SVG 中的链接是否被替换为本地路径
3. 渲染是否成功
4. 临时文件是否正确清理

---

## 注意事项

1. **安全性**：限制图片大小（5MB），防止 DoS 攻击
2. **超时**：图片下载设置 30 秒超时
3. **文件类型**：保留原始文件扩展名
4. **错误处理**：单个图片下载失败不影响整体渲染
5. **清理**：确保下载的图片也被清理

---

## 实现细节

- 使用正则表达式匹配 `<image>` 标签的 `href` 和 `xlink:href` 属性
- 只处理 `http://` 和 `https://` 开头的链接
- 使用 `fetch` API 下载图片
- 下载的图片保存在同一 tempDir 中
- 使用 UUID 生成唯一文件名
