/**
 * 插件配置模块
 * 定义 WebUI 配置 Schema
 */

import type { NapCatPluginContext, PluginConfigSchema } from 'napcat-types/napcat-onebot/network/plugin/types';
import { SvgService } from './services/svg-service';

/**
 * 构建 WebUI 配置 Schema
 */
export async function buildConfigSchema(ctx: NapCatPluginContext): Promise<PluginConfigSchema> {
    const pluginName = ctx.pluginName;
    const webuiUrl = `/plugin/${pluginName}/page/dashboard`;

    // 获取 rsvg-convert 状态
    const svgService = new SvgService(ctx);
    const status = await svgService.checkStatus();

    // 根据状态生成不同的提示 HTML
    const statusHtml = status.installed
        ? `
            <div style="padding: 12px 16px; background: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#4caf50">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <span style="font-weight: 600; color: #2e7d32;">依赖已就绪</span>
                </div>
                <p style="margin: 0; font-size: 12px; color: #1b5e20;">
                    rsvg-convert 已安装 ${status.version ? `(${status.version})` : ''}
                </p>
            </div>
        `
        : `
            <div style="padding: 12px 16px; background: #ffebee; border-left: 4px solid #f44336; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f44336">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <span style="font-weight: 600; color: #c62828;">依赖未安装</span>
                </div>
                <p style="margin: 0; font-size: 12px; color: #b71c1c;">
                    rsvg-convert 未安装，请先安装 librsvg：
                    <br/>• Windows: MSYS2 或预编译二进制
                    <br/>• Linux: sudo apt-get install librsvg2-bin
                    <br/>• macOS: brew install librsvg
                </p>
            </div>
        `;

    return ctx.NapCatConfig.combine(
        // 插件信息头部
        ctx.NapCatConfig.html(`
            <div style="padding: 16px; background: linear-gradient(135deg, #FB7299 0%, #fc8bab 100%); border-radius: 12px; margin-bottom: 20px; color: white;">
                <h3 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 600;">🎨 SVG 渲染器</h3>
                <p style="margin: 0; font-size: 13px; opacity: 0.9;">将 SVG 代码渲染为 PNG 图片，支持 WebUI 可视化操作</p>
            </div>
        `),
        // 跳转到 WebUI
        ctx.NapCatConfig.html(`
            <div style="margin-bottom: 20px;">
                <a href="${webuiUrl}" target="_blank"
                   style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px;
                          background: #FB7299; color: white; text-decoration: none; border-radius: 8px;
                          font-size: 14px; font-weight: 500; transition: all 0.2s;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    打开 SVG 渲染器 →
                </a>
            </div>
        `),
        // 动态状态提示
        ctx.NapCatConfig.html(statusHtml)
    );
}