/**
 * SVG 渲染服务模块
 * 使用 rsvg-convert 工具将 SVG 转换为 PNG
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { SvgServiceStatus } from '../types';

const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB
const RSVG_TIMEOUT = 30000; // 30秒

export class SvgService {
    private ctx: NapCatPluginContext;
    private tempDir: string;

    constructor(ctx: NapCatPluginContext) {
        this.ctx = ctx;
        this.tempDir = path.join(ctx.dataPath, 'temp');
        this.ensureTempDir();
    }

    private ensureTempDir(): void {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
            this.ctx.logger.info('临时目录已创建');
        }
    }

    async checkStatus(): Promise<SvgServiceStatus> {
        try {
            const stdout = await this.runCommand('rsvg-convert', ['--version']);
            const version = stdout.trim().split('\n')[0];
            return { installed: true, version: version || 'unknown' };
        } catch {
            return { installed: false };
        }
    }

    async renderSvgToPng(svgContent: string): Promise<string> {
        const status = await this.checkStatus();
        if (!status.installed) {
            throw new Error('rsvg-convert 未安装，请先安装 librsvg 工具');
        }

        const MAX_SIZE = 1024 * 1024;
        if (Buffer.byteLength(svgContent, 'utf8') > MAX_SIZE) {
            throw new Error('SVG 内容过大，最大支持 1MB');
        }

        const id = crypto.randomUUID();
        const inputPath = path.join(this.tempDir, `${id}.svg`);
        const outputPath = path.join(this.tempDir, `${id}.png`);
        const downloadedImages: string[] = [];

        try {
            // 处理外部图片（下载并替换路径）
            const { processedSvg, downloadedFiles } = await this.processExternalImages(svgContent);
            downloadedImages.push(...downloadedFiles);

            fs.writeFileSync(inputPath, processedSvg, 'utf8');
            this.ctx.logger.debug('写入临时 SVG 文件');

            // 使用 spawn 替代 exec，避免命令注入
            await this.runRsvgConvert(inputPath, outputPath);

            // 检查输出文件大小
            const stats = fs.statSync(outputPath);
            if (stats.size > MAX_OUTPUT_SIZE) {
                throw new Error('生成的图片过大，最大支持 10MB');
            }

            this.ctx.logger.debug('渲染完成');

            const pngBuffer = fs.readFileSync(outputPath);
            return `data:image/png;base64,${pngBuffer.toString('base64')}`;
        } finally {
            // 清理临时文件（包括下载的图片）
            this.cleanup(inputPath, outputPath, ...downloadedImages);
        }
    }

    /**
     * 解析 SVG 并下载外部图片
     * @param svgContent SVG 内容
     * @returns 处理后的 SVG 内容和下载的文件列表
     */
    private async processExternalImages(svgContent: string): Promise<{ processedSvg: string; downloadedFiles: string[] }> {
        // 匹配 xlink:href 和 href 属性中的网络图片链接
        const imageRegex = /<image[^>]*?(?:xlink:href|href)=["'](https?:\/\/[^"']+)["'][^>]*?>/gi;
        const downloadedFiles: string[] = [];
        let processedSvg = svgContent;

        const matches: { fullTag: string; imageUrl: string }[] = [];
        let match: RegExpExecArray | null;

        // 收集所有需要下载的图片
        while ((match = imageRegex.exec(svgContent)) !== null) {
            matches.push({
                fullTag: match[0],
                imageUrl: match[1],
            });
        }

        if (matches.length === 0) {
            return { processedSvg, downloadedFiles };
        }

        this.ctx.logger.info(`发现 ${matches.length} 个外部图片，开始下载...`);

        // 下载所有图片
        const downloadPromises = matches.map(async ({ imageUrl }) => {
            const localPath = await this.downloadImage(imageUrl);
            if (localPath) {
                downloadedFiles.push(localPath);
                // 替换 SVG 中的所有该 URL 引用
                processedSvg = processedSvg.split(imageUrl).join(localPath);
            }
        });

        await Promise.all(downloadPromises);

        return { processedSvg, downloadedFiles };
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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

            const response = await fetch(imageUrl, {
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

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

    private cleanup(...files: string[]): void {
        for (const file of files) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    this.ctx.logger.debug('删除临时文件');
                }
            } catch (err) {
                this.ctx.logger.warn('删除临时文件失败', err);
            }
        }
    }

    /**
     * 使用 spawn 执行 rsvg-convert 命令（更安全，避免命令注入）
     */
    private runRsvgConvert(inputPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const proc = spawn('rsvg-convert', [inputPath], {
                timeout: RSVG_TIMEOUT,
            });

            const output = fs.createWriteStream(outputPath);
            proc.stdout.pipe(output);

            proc.on('error', () => reject(new Error('rsvg-convert 执行失败')));
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`rsvg-convert 退出码: ${code}`));
            });
        });
    }

    /**
     * 使用 spawn 执行命令并返回 stdout
     */
    private runCommand(command: string, args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, {
                timeout: RSVG_TIMEOUT,
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('error', () => reject(new Error('命令执行失败')));
            proc.on('close', (code) => {
                if (code === 0) resolve(stdout);
                else reject(new Error(`命令退出码: ${code}`));
            });
        });
    }
}
