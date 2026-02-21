/**
 * 全局状态管理单例
 * 管理插件配置和上下文
 */

import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';

export interface PluginConfig {
    enabled: boolean;
    debug: boolean;
}

const DEFAULT_CONFIG: PluginConfig = {
    enabled: true,
    debug: false,
};

export class PluginState {
    private _ctx: NapCatPluginContext | null = null;
    private _config: PluginConfig = DEFAULT_CONFIG;

    init(ctx: NapCatPluginContext): void {
        this._ctx = ctx;
        this._config = { ...DEFAULT_CONFIG };
    }

    get ctx(): NapCatPluginContext {
        if (!this._ctx) throw new Error('PluginState not initialized');
        return this._ctx;
    }

    get config(): PluginConfig {
        return this._config;
    }

    updateConfig(partial: Partial<PluginConfig>): void {
        this._config = { ...this._config, ...partial };
    }

    replaceConfig(config: PluginConfig): void {
        this._config = config;
    }

    cleanup(): void {
        this._ctx = null;
    }
}

export const pluginState = new PluginState();