import type { ApiResponse, SvgRenderRequest, SvgRenderResponse, SvgServiceStatus, TempStats } from '../types'

function resolvePluginName(): string {
    if (window.__PLUGIN_NAME__) return window.__PLUGIN_NAME__
    try {
        if (window.parent && (window.parent as Window & { __PLUGIN_NAME__?: string }).__PLUGIN_NAME__) {
            return (window.parent as Window & { __PLUGIN_NAME__?: string }).__PLUGIN_NAME__!
        }
    } catch { /* ignore */ }
    const extMatch = location.pathname.match(/\/ext\/([^/]+)/)
    if (extMatch) return extMatch[1]
    const pluginMatch = location.pathname.match(/\/plugin\/([^/]+)/)
    if (pluginMatch) return pluginMatch[1]
    return 'napcat-plugin-template'
}

const PLUGIN_NAME = resolvePluginName()

const API_BASE_NO_AUTH = '/plugin/' + PLUGIN_NAME + '/api'
const API_BASE_AUTH = '/api/Plugin/ext/' + PLUGIN_NAME

function getToken(): string {
    return localStorage.getItem('token') || ''
}

function authHeaders(h: Record<string, string> = {}): Record<string, string> {
    const token = getToken()
    if (token) h['Authorization'] = 'Bearer ' + token
    return h
}

function buildUrl(base: string, path: string): string {
    return new URL(base + path, window.location.origin).toString()
}

/**
 * 无认证 API 请求
 * 用于插件自带 WebUI 页面调用后端 router.getNoAuth / router.postNoAuth 注册的路由
 */
export async function noAuthFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const res = await fetch(buildUrl(API_BASE_NO_AUTH, path), {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers }
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
    }
    return res.json()
}

/**
 * 认证 API 请求
 * 用于需要 NapCat WebUI 登录认证的接口
 */
export async function authFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const res = await fetch(buildUrl(API_BASE_AUTH, path), {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers, ...authHeaders() }
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `HTTP ${res.status}`)
    }
    return res.json()
}

/**
 * 获取 SVG 服务状态
 */
export async function getSvgServiceStatus(): Promise<ApiResponse<SvgServiceStatus>> {
    return noAuthFetch<SvgServiceStatus>('/svg/status');
}

/**
 * 渲染 SVG 为 PNG
 */
export async function renderSvg(
    svg: string,
    saveWebImage?: boolean
): Promise<ApiResponse<SvgRenderResponse>> {
    const body: SvgRenderRequest = { svg };
    if (saveWebImage !== undefined) {
        body.saveWebImage = saveWebImage;
    }

    return noAuthFetch<SvgRenderResponse>('/svg/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

/**
 * 获取缓存列表
 */
export async function getCacheList(): Promise<ApiResponse<{
    list: Array<{ url: string; localPath: string; size: number; mtime: string }>;
    stats: { count: number; size: number };
    maxSize: number;
}>> {
    return noAuthFetch('/cache/list');
}

/**
 * 查看缓存图片
 */
export async function viewCacheImage(url: string): Promise<ApiResponse<{ imageBase64: string }>> {
    return noAuthFetch(`/cache/image?url=${encodeURIComponent(url)}`);
}

/**
 * 更新缓存设置
 */
export async function updateCacheSettings(maxSize: number): Promise<ApiResponse<void>> {
    return noAuthFetch('/cache/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSize }),
    });
}

/**
 * 删除单个缓存
 */
export async function deleteCache(url: string): Promise<ApiResponse<void>> {
    return noAuthFetch('/cache/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    });
}

/**
 * 清空所有缓存
 */
export async function clearAllCache(): Promise<ApiResponse<{ deleted: number; errors: number }>> {
    return noAuthFetch('/cache/clear', {
        method: 'POST',
    });
}

/**
 * 获取临时目录统计
 */
export async function getTempStats(): Promise<ApiResponse<TempStats>> {
    return noAuthFetch('/cache/temp-stats');
}

/**
 * 清理临时目录
 */
export async function clearTempDir(): Promise<ApiResponse<{ deleted: number; errors: number }>> {
    return noAuthFetch('/cache/temp-clear', {
        method: 'POST',
    });
}
