/**
 * 图片缓存服务
 * 管理网络图片的缓存，避免重复下载
 */

import * as fs from 'fs';
import * as path from 'path';
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
