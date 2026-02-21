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

/**
 * 注册 API 路由
 */
export function registerApiRoutes(ctx: NapCatPluginContext): void {
    const router = ctx.router;
    const svgService = new SvgService(ctx);

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

    ctx.logger.debug('API 路由注册完成');
}