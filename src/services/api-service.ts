/**
 * API 服务模块
 * 注册 WebUI API 路由
 */

import type {
    NapCatPluginContext,
    PluginHttpRequest,
    PluginHttpResponse
} from 'napcat-types/napcat-onebot/network/plugin/types';
import { SvgService } from './svg-service';
import { ImageCacheService } from './image-cache-service';

/**
 * 注册 API 路由
 */
export function registerApiRoutes(ctx: NapCatPluginContext): void {
    const router = ctx.router;
    const svgService = new SvgService(ctx);
    const imageCacheService = new ImageCacheService(ctx);

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

    // ==================== 缓存管理 API ====================

    /** 获取缓存列表 */
    router.getNoAuth('/cache/list', async (_req, res) => {
        try {
            const list = imageCacheService.getCacheList();
            const stats = imageCacheService.getCacheStats();
            const maxSize = imageCacheService.getMaxCacheSize();

            res.json({
                code: 0,
                data: {
                    list,
                    stats,
                    maxSize,
                },
            });
        } catch (err) {
            ctx.logger.error('获取缓存列表失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 获取缓存图片 */
    router.getNoAuth('/cache/image', async (req, res) => {
        try {
            const url = (req.query as Record<string, string>)?.url;
            if (!url) {
                return res.status(400).json({ code: -1, message: '缺少 url 参数' });
            }

            const base64 = await imageCacheService.getCacheImageBase64(url);
            if (!base64) {
                return res.status(404).json({ code: -1, message: '缓存图片不存在' });
            }

            res.json({
                code: 0,
                data: { imageBase64: base64 },
            });
        } catch (err) {
            ctx.logger.error('获取缓存图片失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 设置最大缓存大小 */
    router.postNoAuth('/cache/settings', async (req, res) => {
        try {
            const body = req.body as { maxSize?: number } | undefined;

            if (!body || typeof body.maxSize !== 'number') {
                return res.status(400).json({ code: -1, message: '缺少 maxSize 参数' });
            }

            imageCacheService.setMaxCacheSize(body.maxSize);

            res.json({
                code: 0,
                message: `最大缓存大小已设置为 ${body.maxSize}MB`,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            ctx.logger.error('设置缓存大小失败:', err);
            res.status(500).json({ code: -1, message });
        }
    });

    /** 删除单个缓存 */
    router.postNoAuth('/cache/delete', async (req, res) => {
        try {
            const body = req.body as { url?: string } | undefined;

            if (!body || !body.url) {
                return res.status(400).json({ code: -1, message: '缺少 url 参数' });
            }

            const success = imageCacheService.deleteCache(body.url);

            if (success) {
                res.json({ code: 0, message: '缓存已删除' });
            } else {
                res.status(404).json({ code: -1, message: '缓存不存在' });
            }
        } catch (err) {
            ctx.logger.error('删除缓存失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 清空所有缓存 */
    router.postNoAuth('/cache/clear', async (_req, res) => {
        try {
            const result = imageCacheService.clearAllCache();

            res.json({
                code: 0,
                data: result,
                message: `已清空 ${result.deleted} 个缓存，失败 ${result.errors} 个`,
            });
        } catch (err) {
            ctx.logger.error('清空缓存失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    ctx.logger.debug('API 路由注册完成');
}