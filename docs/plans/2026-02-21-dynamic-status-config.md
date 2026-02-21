# 动态 rsvg-convert 状态配置计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修改配置 Schema，通过 `svgService.checkStatus()` 动态获取 rsvg-convert 安装状态，并在 WebUI 配置页面显示不同的提示信息。

**Architecture:** 将 `buildConfigSchema` 改为异步函数，在函数内部调用 `svgService.checkStatus()` 获取状态，根据状态生成不同的 HTML 提示。同时修改 `src/index.ts` 中的调用方式以支持异步。

**Tech Stack:** TypeScript, NapCat Plugin API

---

## Task 1: 修改 buildConfigSchema 为异步函数

**Files:**
- Modify: `src/config.ts`

**Step 1: 添加导入并修改函数签名**

```typescript
import { SvgService } from './services/svg-service';

export async function buildConfigSchema(ctx: NapCatPluginContext): Promise<PluginConfigSchema> {
```

**Step 2: 获取 rsvg-convert 状态并生成动态 HTML**

```typescript
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

**Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat(config): make buildConfigSchema async with dynamic status"
```

---

## Task 2: 修改 index.ts 支持异步 buildConfigSchema

**Files:**
- Modify: `src/index.ts`

**Step 1: 查找 plugin_init 函数中的调用**

找到类似以下的代码：
```typescript
export const plugin_init: PluginModule['plugin_init'] = (ctx) => {
    // ...
    plugin_config_ui = buildConfigSchema(ctx);
    // ...
};
```

**Step 2: 修改为 await 调用**

```typescript
export const plugin_init: PluginModule['plugin_init'] = async (ctx) => {
    // ...
    plugin_config_ui = await buildConfigSchema(ctx);
    // ...
};
```

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat(init): support async buildConfigSchema"
```

---

## Task 3: 重新构建并测试

**Step 1: 构建插件**

```bash
pnpm run build
```

**Step 2: 部署测试**

```bash
pnpm run deploy
```

**Step 3: 验证**

1. 打开 NapCat WebUI
2. 进入插件配置页面
3. 检查 rsvg-convert 状态显示是否正确
4. 如果未安装，显示红色警告和安装命令
5. 如果已安装，显示绿色成功状态和版本号

---

## 总结

修改后，配置页面将：
- 已安装 rsvg-convert: 显示绿色成功框，包含版本号
- 未安装 rsvg-convert: 显示红色警告框，包含安装命令
