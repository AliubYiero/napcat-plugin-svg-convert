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
    private tempDir: string;
    private mapFilePath: string;
    private cacheMap: ImageCacheMap = {};
    private maxCacheSize: number = MAX_CACHE_SIZE;

    constructor(ctx: NapCatPluginContext) {
        this.ctx = ctx;
        this.cacheDir = path.join(ctx.dataPath, CACHE_DIR_NAME);
        this.tempDir = path.join(ctx.dataPath, 'temp');
        this.mapFilePath = path.join(ctx.dataPath, CACHE_MAP_FILE);
        this.ensureCacheDir();
        this.loadCacheMap();
        this.loadSettings();
    }

    /**
     * 加载设置
     */
    private loadSettings(): void {
        try {
            const settingsPath = path.join(this.ctx.dataPath, 'cache-settings.json');
            if (fs.existsSync(settingsPath)) {
                const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                if (data.maxSize) {
                    this.maxCacheSize = data.maxSize * 1024 * 1024;
                }
            }
        } catch (err) {
            this.ctx.logger.warn('加载缓存设置失败:', err);
        }
    }

    /**
     * 保存设置
     */
    private saveSettings(): void {
        try {
            const settingsPath = path.join(this.ctx.dataPath, 'cache-settings.json');
            fs.writeFileSync(settingsPath, JSON.stringify({ maxSize: this.getMaxCacheSize() }, null, 2), 'utf8');
        } catch (err) {
            this.ctx.logger.warn('保存缓存设置失败:', err);
        }
    }

    /**
     * 获取缓存列表
     */
    getCacheList(): Array<{ url: string; localPath: string; size: number; mtime: Date }> {
        try {
            const list: Array<{ url: string; localPath: string; size: number; mtime: Date }> = [];

            // 先加载最新的缓存映射表
            this.loadCacheMap();

            // 扫描缓存目录
            const cacheFiles = fs.readdirSync(this.cacheDir);
            for (const filename of cacheFiles) {
                const localPath = path.join(this.cacheDir, filename);
                const stats = fs.statSync(localPath);

                if (stats.isFile()) {
                    // 查找对应的 URL
                    let url = '';
                    for (const [mappedUrl, mappedPath] of Object.entries(this.cacheMap)) {
                        if (mappedPath === localPath) {
                            url = mappedUrl;
                            break;
                        }
                    }

                    // 如果找不到映射，使用文件名作为标识
                    if (!url) {
                        url = `未知来源: ${filename}`;
                    }

                    list.push({
                        url,
                        localPath,
                        size: stats.size,
                        mtime: stats.mtime,
                    });
                }
            }

            // 按修改时间倒序（最新的在前）
            list.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

            return list;
        } catch (err) {
            this.ctx.logger.warn('获取缓存列表失败:', err);
            return [];
        }
    }

    /**
     * 设置最大缓存大小
     */
    setMaxCacheSize(sizeMB: number): void {
        if (sizeMB < 10 || sizeMB > 500) {
            throw new Error('缓存大小必须在 10MB 到 500MB 之间');
        }
        this.maxCacheSize = sizeMB * 1024 * 1024;
        this.saveSettings();
        this.ctx.logger.info(`最大缓存大小已设置为 ${sizeMB}MB`);
    }

    /**
     * 获取最大缓存大小
     */
    getMaxCacheSize(): number {
        return Math.floor(this.maxCacheSize / (1024 * 1024));
    }

    /**
     * 删除单个缓存
     */
    deleteCache(url: string): boolean {
        try {
            const localPath = this.cacheMap[url];
            if (!localPath) {
                return false;
            }

            if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
            }

            delete this.cacheMap[url];
            this.saveCacheMap();

            this.ctx.logger.info(`删除缓存: ${url}`);
            return true;
        } catch (err) {
            this.ctx.logger.warn('删除缓存失败:', err);
            return false;
        }
    }

    /**
     * 清空所有缓存
     */
    clearAllCache(): { deleted: number; errors: number } {
        let deleted = 0;
        let errors = 0;

        for (const [url, localPath] of Object.entries(this.cacheMap)) {
            try {
                if (fs.existsSync(localPath)) {
                    fs.unlinkSync(localPath);
                }
                delete this.cacheMap[url];
                deleted++;
            } catch (err) {
                errors++;
                this.ctx.logger.warn(`删除缓存失败: ${url}`, err);
            }
        }

        this.saveCacheMap();
        this.ctx.logger.info(`清空缓存完成: ${deleted} 成功, ${errors} 失败`);

        return { deleted, errors };
    }

    /**
     * 获取缓存图片 base64
     */
    async getCacheImageBase64(url: string): Promise<string | null> {
        try {
            const localPath = this.cacheMap[url];
            if (!localPath || !fs.existsSync(localPath)) {
                return null;
            }

            const buffer = fs.readFileSync(localPath);
            const ext = path.extname(localPath).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' :
                            ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                            ext === '.gif' ? 'image/gif' : 'image/png';

            return `data:${mimeType};base64,${buffer.toString('base64')}`;
        } catch (err) {
            this.ctx.logger.warn('获取缓存图片失败:', err);
            return null;
        }
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
     * 仅从缓存获取图片路径，如果不存在返回 null（不自动下载）
     * @param imageUrl 网络图片URL
     * @returns 本地缓存路径，不存在返回 null
     */
    getCachedImagePath(imageUrl: string): string | null {
        const cachedPath = this.cacheMap[imageUrl];
        if (cachedPath && fs.existsSync(cachedPath)) {
            this.ctx.logger.debug(`缓存命中(只读): ${imageUrl}`);
            return cachedPath;
        }
        return null;
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
            if (totalSize > this.maxCacheSize) {
                // 按修改时间排序（最旧的在前）
                files.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

                let sizeToFree = totalSize - this.maxCacheSize + 10 * 1024 * 1024; // 多清理 10MB
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
            let count = 0;
            const files = fs.readdirSync(this.cacheDir);
            for (const file of files) {
                const filePath = path.join(this.cacheDir, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    size += stats.size;
                    count++;
                }
            }
            return { count, size };
        } catch {
            return { count: 0, size: 0 };
        }
    }

    /**
     * 获取临时目录统计信息
     */
    getTempStats(): { count: number; size: number } {
        try {
            if (!fs.existsSync(this.tempDir)) {
                return { count: 0, size: 0 };
            }

            let size = 0;
            let count = 0;
            const files = fs.readdirSync(this.tempDir);
            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    size += stats.size;
                    count++;
                }
            }
            return { count, size };
        } catch (err) {
            this.ctx.logger.warn('获取临时目录统计失败:', err);
            return { count: 0, size: 0 };
        }
    }
}
