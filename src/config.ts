/**
 * 插件配置模块
 * 定义默认配置值和 WebUI 配置 Schema
 */

import type { NapCatPluginContext, PluginConfigSchema } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { PluginConfig } from './types';

/** 默认配置 */
export const DEFAULT_CONFIG: PluginConfig = {
    enabled: true,
    debug: false,
    commandPrefix: '#cmd',
    cooldownSeconds: 60,
    groupConfigs: {},
    // TODO: 在这里添加你的默认配置值
};

/**
 * 构建 WebUI 配置 Schema
 *
 * 使用 ctx.NapCatConfig 提供的构建器方法生成配置界面：
 *   - boolean(key, label, defaultValue?, description?, reactive?)  → 开关
 *   - text(key, label, defaultValue?, description?, reactive?)     → 文本输入
 *   - number(key, label, defaultValue?, description?, reactive?)   → 数字输入
 *   - select(key, label, options, defaultValue?, description?)     → 下拉单选
 *   - multiSelect(key, label, options, defaultValue?, description?) → 下拉多选
 *   - html(content)     → 自定义 HTML 展示（不保存值）
 *   - plainText(content) → 纯文本说明
 *   - combine(...items)  → 组合多个配置项为 Schema
 */
export function buildConfigSchema(ctx: NapCatPluginContext): PluginConfigSchema {
    const pluginId = ctx.pluginId;
    const webuiUrl = `/plugin/${pluginId}/page/dashboard`;

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
                <a href="${webuiUrl}" 
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
        // rsvg-convert 状态提示
        ctx.NapCatConfig.html(`
            <div style="padding: 12px 16px; background: #fff3e0; border-left: 4px solid #ff9800; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#ff9800">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <span style="font-weight: 600; color: #e65100;">依赖检查</span>
                </div>
                <p style="margin: 0; font-size: 12px; color: #bf360c;">
                    本插件需要 rsvg-convert 工具。请确保已安装 librsvg：
                    <br/>• Windows: MSYS2 或预编译二进制
                    <br/>• Linux: sudo apt-get install librsvg2-bin
                    <br/>• macOS: brew install librsvg
                </p>
            </div>
        `)
    );
}
