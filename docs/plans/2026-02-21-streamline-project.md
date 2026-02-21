# 精简项目结构计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 精简项目结构，移除所有消息处理相关代码，保留核心的 SVG 渲染功能和 API 导出功能。

**Architecture:** 删除 handlers/ 目录，简化 index.ts 中的生命周期函数，简化 types.ts 中的类型定义，简化 config.ts 中的配置，保留 services/ 中的核心功能。

---

## Task 1: 删除消息处理器

**Files:**
- Delete: `src/handlers/message-handler.ts`

**Step 1: 删除文件**

```bash
git rm src/handlers/message-handler.ts
git commit -m "chore: remove message handler"
```

---

## Task 2: 简化 types.ts

**Files:**
- Modify: `src/types.ts`

**Step 1: 移除消息相关类型，保留 SVG 相关类型**

```typescript
/**
 * 类型定义文件
 * 定义插件内部使用的接口和类型
 */

// ==================== SVG 渲染 ====================

// SVG 渲染请求
export interface SvgRenderRequest {
    svg: string;
}

// SVG 渲染响应
export interface SvgRenderResponse {
    imageBase64: string;
    format: 'png';
}

// SVG 服务状态
export interface SvgServiceStatus {
    installed: boolean;
    version?: string;
}

// ==================== API 响应 ====================

/**
 * 统一 API 响应格式
 */
export interface ApiResponse<T = unknown> {
    /** 状态码，0 表示成功，-1 表示失败 */
    code: number;
    /** 错误信息（仅错误时返回） */
    message?: string;
    /** 响应数据（仅成功时返回） */
    data?: T;
}
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "refactor(types): simplify types, keep only SVG related"
```

---

## Task 3: 简化 config.ts

**Files:**
- Modify: `src/config.ts`

**Step 1: 简化配置**

```typescript
/**
 * 插件配置模块
 * 定义默认配置值和 WebUI 配置 Schema
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
```

**Step 2: Commit**

```bash
git add src/config.ts
git commit -m "refactor(config): simplify config, remove message-related configs"
```

---

## Task 4: 简化 index.ts

**Files:**
- Modify: `src/index.ts`

**Step 1: 移除消息处理相关代码**

```typescript
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
import { pluginState } from './core/state';
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
    pluginState.replaceConfig(config);
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
```

**Step 2: Commit**

```bash
git add src/index.ts
git commit -m "refactor(index): remove message handling code"
```

---

## Task 5: 简化 state.ts

**Files:**
- Modify: `src/core/state.ts`

**Step 1: 移除消息相关方法**

简化 PluginState 类，只保留基础配置管理功能：

```typescript
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
```

**Step 2: Commit**

```bash
git add src/core/state.ts
git commit -m "refactor(state): simplify state, remove message-related methods"
```

---

## Task 6: 简化 api-service.ts

**Files:**
- Modify: `src/services/api-service.ts`

**Step 1: 移除群管理相关路由，保留 SVG 相关路由**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/services/api-service.ts
git commit -m "refactor(api): remove group management routes, keep only SVG routes"
```

---

## Task 7: 简化 WebUI 前端

**Files:**
- Delete: `src/webui/src/pages/ConfigPage.tsx`
- Delete: `src/webui/src/pages/GroupsPage.tsx`
- Delete: `src/webui/src/pages/StatusPage.tsx`
- Modify: `src/webui/src/App.tsx`
- Modify: `src/webui/src/components/Sidebar.tsx`

**Step 1: 删除不需要的页面**

```bash
git rm src/webui/src/pages/ConfigPage.tsx
git rm src/webui/src/pages/GroupsPage.tsx
git rm src/webui/src/pages/StatusPage.tsx
git commit -m "chore(webui): remove unused pages"
```

**Step 2: 简化 App.tsx**

```typescript
import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ToastContainer from './components/ToastContainer'
import { SvgRenderPage } from './pages/SvgRenderPage'
import { ApiDocsPage } from './pages/ApiDocsPage'
import { useTheme } from './hooks/useTheme'

export type PageId = 'svg-render' | 'api-docs'

const pageConfig: Record<PageId, { title: string; desc: string }> = {
    'svg-render': { title: 'SVG 渲染器', desc: '将 SVG 代码渲染为 PNG 图片' },
    'api-docs': { title: 'API 文档', desc: '插件 API 接口文档' }
}

function App() {
    const [currentPage, setCurrentPage] = useState<PageId>('svg-render')
    const [isScrolled, setIsScrolled] = useState(false)

    useTheme()

    const handleScroll = (e: React.UIEvent<HTMLElement>) => {
        setIsScrolled(e.currentTarget.scrollTop > 10)
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'svg-render': return <SvgRenderPage />
            case 'api-docs': return <ApiDocsPage />
            default: return <SvgRenderPage />
        }
    }

    return (
        <div className="flex h-screen overflow-hidden bg-[#f8f9fa] dark:bg-[#18191C] text-gray-800 dark:text-gray-200 transition-colors duration-300">
            <ToastContainer />
            <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />

            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto" onScroll={handleScroll}>
                    <Header
                        title={pageConfig[currentPage].title}
                        description={pageConfig[currentPage].desc}
                        isScrolled={isScrolled}
                    />
                    <div className="px-4 md:px-8 pb-8">
                        <div key={currentPage} className="page-enter">
                            {renderPage()}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default App
```

**Step 3: 简化 Sidebar.tsx**

```typescript
import type { PageId } from '../App'
import { IconImage, IconDocs } from './icons'

interface SidebarProps {
    currentPage: PageId
    onPageChange: (page: PageId) => void
}

const menuItems: { id: PageId; label: string; icon: React.ReactNode }[] = [
    { id: 'svg-render', label: 'SVG渲染', icon: <IconImage size={18} /> },
    { id: 'api-docs', label: 'API文档', icon: <IconDocs size={18} /> },
]

export default function Sidebar({ currentPage, onPageChange }: SidebarProps) {
    return (
        <aside className="w-60 flex-shrink-0 bg-white dark:bg-[#1a1b1d] border-r border-gray-200 dark:border-gray-800 flex flex-col">
            {/* Logo */}
            <div className="px-5 py-6 flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center bg-[#FB7299] rounded-lg text-white">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                </div>
                <div>
                    <h1 className="font-bold text-sm leading-tight text-gray-900 dark:text-white">SVG Render</h1>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
                {menuItems.map((item) => (
                    <div
                        key={item.id}
                        className={`sidebar-item ${currentPage === item.id ? 'active' : ''}`}
                        onClick={() => onPageChange(item.id)}
                    >
                        <span className="sidebar-icon">{item.icon}</span>
                        <span>{item.label}</span>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-center w-full py-2 rounded-lg text-gray-500 bg-gray-50 dark:bg-gray-800/50 text-xs">
                    SVG 渲染插件 v1.0.0
                </div>
            </div>
        </aside>
    )
}
```

**Step 4: 简化 Header.tsx（移除状态相关）**

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(webui): simplify UI, remove status/config/groups pages"
```

---

## Task 8: 重新构建并验证

**Step 1: 构建 WebUI**

```bash
cd src/webui && pnpm run build
cd ../..
```

**Step 2: 构建插件**

```bash
pnpm run build
```

**Step 3: 验证**

- 确认只有 SVG 渲染和 API 文档两个页面
- 确认没有消息处理相关代码
- 确认功能正常

---

## Task 9: 更新 README

**Files:**
- Modify: `README.md`

**Step 1: 简化 README**

```markdown
# NapCat SVG 渲染插件

一个专注于 SVG 转 PNG 渲染的 NapCat 插件。

## 功能

- **SVG 转 PNG**: 使用 rsvg-convert 高质量渲染
- **外部图片支持**: 自动下载 SVG 中的网络图片
- **WebUI 界面**: 可视化 SVG 渲染工具
- **API 接口**: REST API 支持程序化调用

## 安装

1. 安装 rsvg-convert:
   - Windows: MSYS2 `pacman -S mingw-w64-x86_64-librsvg`
   - Linux: `sudo apt-get install librsvg2-bin`
   - macOS: `brew install librsvg`

2. 构建并部署插件

## API

- `GET /svg/status` - 检查 rsvg-convert 状态
- `POST /svg/render` - 渲染 SVG 为 PNG

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: simplify README"
```

---

## 项目结构（精简后）

```
src/
├── index.ts              # 插件入口（简化）
├── config.ts             # 配置 Schema（简化）
├── types.ts              # 类型定义（简化）
├── core/
│   └── state.ts          # 状态管理（简化）
├── services/
│   ├── api-service.ts    # API 路由（简化）
│   └── svg-service.ts    # SVG 渲染服务（保留）
└── webui/                # WebUI（简化）
    └── src/
        ├── pages/
        │   ├── SvgRenderPage.tsx   # SVG 渲染页面
        │   └── ApiDocsPage.tsx     # API 文档页面
        └── ...
```

删除的文件：
- `src/handlers/message-handler.ts`
- `src/webui/src/pages/ConfigPage.tsx`
- `src/webui/src/pages/GroupsPage.tsx`
- `src/webui/src/pages/StatusPage.tsx`
