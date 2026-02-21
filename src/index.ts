/**
 * NapCat SVG 渲染插件 - 主入口
 *
 * 提供 SVG 转 PNG 渲染功能
 */

import type {
    PluginModule,
    PluginConfigSchema,
    NapCatPluginContext,
} from 'napcat-types/napcat-onebot/network/plugin/types';

import { buildConfigSchema } from './config';
import { PluginConfig, pluginState } from './core/state';
import { registerApiRoutes } from './services/api-service';

// ==================== 配置 UI Schema ====================

/** NapCat WebUI 读取此导出来展示配置面板 */
export let plugin_config_ui: PluginConfigSchema = [];

// ==================== 生命周期函数 ====================

/**
 * 插件初始化
 */
export const plugin_init: PluginModule['plugin_init'] = async (ctx) => {
    try {
        // 1. 初始化全局状态
        pluginState.init(ctx);

        ctx.logger.info('SVG 渲染插件初始化中...');

        // 2. 生成配置 Schema
        plugin_config_ui = await buildConfigSchema(ctx);

        // 3. 注册 WebUI 页面和静态资源
        registerWebUI(ctx);

        // 4. 注册 API 路由
        registerApiRoutes(ctx);

        ctx.logger.info('SVG 渲染插件初始化完成');
    } catch (error) {
        ctx.logger.error('SVG 渲染插件初始化失败:', error);
    }
};

/**
 * 插件卸载
 */
export const plugin_cleanup: PluginModule['plugin_cleanup'] = async (ctx) => {
    try {
        pluginState.cleanup();
        ctx.logger.info('SVG 渲染插件已卸载');
    } catch (e) {
        ctx.logger.warn('SVG 渲染插件卸载时出错:', e);
    }
};

// ==================== 配置管理钩子 ====================

/** 获取当前配置 */
export const plugin_get_config: PluginModule['plugin_get_config'] = async (ctx) => {
    return pluginState.config;
};

/** 设置配置 */
export const plugin_set_config: PluginModule['plugin_set_config'] = async (ctx, config) => {
    pluginState.replaceConfig(<PluginConfig> config);
    ctx.logger.info('配置已通过 WebUI 更新');
};

/**
 * 配置变更回调
 */
export const plugin_on_config_change: PluginModule['plugin_on_config_change'] = async (
    ctx, ui, key, value, currentConfig
) => {
    try {
        pluginState.updateConfig({ [key]: value });
        ctx.logger.debug(`配置项 ${key} 已更新`);
    } catch (err) {
        ctx.logger.error(`更新配置项 ${key} 失败:`, err);
    }
};

// ==================== 内部函数 ====================

/**
 * 注册 WebUI 页面和静态资源
 */
function registerWebUI(ctx: NapCatPluginContext): void {
    const router = ctx.router;

    // 托管前端静态资源
    router.static('/static', 'webui');

    // 注册仪表盘页面
    router.page({
        path: 'dashboard',
        title: 'SVG 渲染器',
        htmlFile: 'webui/index.html',
        description: 'SVG 转 PNG 渲染工具',
    });

    ctx.logger.debug('WebUI 路由注册完成');
}
