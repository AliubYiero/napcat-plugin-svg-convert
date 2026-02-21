# 缓存管理页面计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建一个新的 WebUI 页面，用于管理图片缓存。功能包括：设置最大缓存大小、查看当前缓存列表、查看图片、删除缓存。

**Architecture:** 
1. 扩展 ImageCacheService 添加管理功能（获取列表、设置最大缓存、删除缓存、查看图片）
2. 添加新的 API 路由用于缓存管理
3. 创建 CacheManagePage 组件
4. 更新路由和导航

---

## Task 1: 扩展 ImageCacheService

**Files:**
- Modify: `src/services/image-cache-service.ts`

**Step 1: 添加缓存管理方法**

```typescript
// 添加获取缓存列表方法
getCacheList(): Array<{ url: string; localPath: string; size: number; mtime: Date }> {
    try {
        const list: Array<{ url: string; localPath: string; size: number; mtime: Date }> = [];
        
        for (const [url, localPath] of Object.entries(this.cacheMap)) {
            if (fs.existsSync(localPath)) {
                const stats = fs.statSync(localPath);
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

// 添加设置最大缓存大小方法
setMaxCacheSize(sizeMB: number): void {
    if (sizeMB < 10 || sizeMB > 500) {
        throw new Error('缓存大小必须在 10MB 到 500MB 之间');
    }
    this.maxCacheSize = sizeMB * 1024 * 1024;
    this.ctx.logger.info(`最大缓存大小已设置为 ${sizeMB}MB`);
}

// 添加获取最大缓存大小方法
getMaxCacheSize(): number {
    return Math.floor(this.maxCacheSize / (1024 * 1024));
}

// 添加删除单个缓存方法
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

// 添加清空所有缓存方法
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

// 添加获取缓存图片 base64 方法
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
```

**Step 2: Commit**

```bash
git add src/services/image-cache-service.ts
git commit -m "feat(cache): add cache management methods"
```

---

## Task 2: 添加缓存管理 API 路由

**Files:**
- Modify: `src/services/api-service.ts`

**Step 1: 导入 ImageCacheService 并添加路由**

```typescript
import { ImageCacheService } from './image-cache-service';

export function registerApiRoutes(ctx: NapCatPluginContext): void {
    const router = ctx.router;
    const svgService = new SvgService(ctx);
    const imageCacheService = new ImageCacheService(ctx);

    // ... 现有路由 ...

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
            const url = req.query?.url as string;
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
```

**Step 2: Commit**

```bash
git add src/services/api-service.ts
git commit -m "feat(api): add cache management routes"
```

---

## Task 3: 创建缓存管理页面

**Files:**
- Create: `src/webui/src/pages/CacheManagePage.tsx`

**Step 1: 实现页面组件**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { getCacheList, deleteCache, clearAllCache, updateCacheSettings, viewCacheImage } from '../utils/api';
import { useToast } from '../hooks/useToast';
import { IconTrash, IconEye, IconSettings } from '../components/icons';

interface CacheItem {
    url: string;
    localPath: string;
    size: number;
    mtime: string;
}

interface CacheStats {
    count: number;
    size: number;
}

export function CacheManagePage() {
    const [cacheList, setCacheList] = useState<CacheItem[]>([]);
    const [stats, setStats] = useState<CacheStats>({ count: 0, size: 0 });
    const [maxSize, setMaxSize] = useState(50);
    const [isLoading, setIsLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const { showToast } = useToast();

    const loadCacheList = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getCacheList();
            if (res.code === 0 && res.data) {
                setCacheList(res.data.list);
                setStats(res.data.stats);
                setMaxSize(res.data.maxSize);
            } else {
                showToast(res.message || '获取缓存列表失败', 'error');
            }
        } catch {
            showToast('获取缓存列表失败', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        loadCacheList();
    }, [loadCacheList]);

    const handleDelete = async (url: string) => {
        try {
            const res = await deleteCache(url);
            if (res.code === 0) {
                showToast('缓存已删除', 'success');
                loadCacheList();
            } else {
                showToast(res.message || '删除失败', 'error');
            }
        } catch {
            showToast('删除失败', 'error');
        }
    };

    const handleClearAll = async () => {
        if (!confirm('确定要清空所有缓存吗？此操作不可恢复。')) {
            return;
        }
        
        try {
            const res = await clearAllCache();
            if (res.code === 0) {
                showToast(`已清空 ${res.data.deleted} 个缓存`, 'success');
                loadCacheList();
            } else {
                showToast(res.message || '清空失败', 'error');
            }
        } catch {
            showToast('清空失败', 'error');
        }
    };

    const handleUpdateMaxSize = async () => {
        try {
            const res = await updateCacheSettings(maxSize);
            if (res.code === 0) {
                showToast(res.message || '设置已更新', 'success');
            } else {
                showToast(res.message || '设置失败', 'error');
            }
        } catch {
            showToast('设置失败', 'error');
        }
    };

    const handleViewImage = async (url: string) => {
        try {
            const res = await viewCacheImage(url);
            if (res.code === 0 && res.data) {
                setPreviewImage(res.data.imageBase64);
                setPreviewUrl(url);
            } else {
                showToast('图片预览失败', 'error');
            }
        } catch {
            showToast('图片预览失败', 'error');
        }
    };

    const formatSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const formatDate = (dateStr: string): string => {
        return new Date(dateStr).toLocaleString('zh-CN');
    };

    return (
        <div className="space-y-6">
            {/* 标题 */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    缓存管理
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    管理 SVG 渲染中的网络图片缓存
                </p>
            </div>

            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h3 className="text-sm text-blue-600 dark:text-blue-300">缓存数量</h3>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.count}</p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h3 className="text-sm text-green-600 dark:text-green-300">缓存大小</h3>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">{formatSize(stats.size)}</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <h3 className="text-sm text-purple-600 dark:text-purple-300">最大限制</h3>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{maxSize} MB</p>
                </div>
            </div>

            {/* 设置区域 */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">缓存设置</h3>
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                            最大缓存大小 (MB)
                        </label>
                        <input
                            type="number"
                            min="10"
                            max="500"
                            value={maxSize}
                            onChange={(e) => setMaxSize(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>
                    <button
                        onClick={handleUpdateMaxSize}
                        className="px-4 py-2 bg-[#FB7299] hover:bg-[#fc8bab] text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                        <IconSettings size={18} />
                        更新设置
                    </button>
                </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex justify-between items-center">
                <button
                    onClick={loadCacheList}
                    disabled={isLoading}
                    className="px-4 py-2 text-[#FB7299] hover:bg-[#FB7299]/10 rounded-lg transition-colors"
                >
                    {isLoading ? '刷新中...' : '刷新列表'}
                </button>
                <button
                    onClick={handleClearAll}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                    清空所有缓存
                </button>
            </div>

            {/* 缓存列表 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">图片 URL</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">大小</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">缓存时间</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cacheList.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                    暂无缓存数据
                                </td>
                            </tr>
                        ) : (
                            cacheList.map((item) => (
                                <tr key={item.url} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750">
                                    <td className="px-4 py-3">
                                        <p className="text-sm text-gray-900 dark:text-white truncate max-w-xs" title={item.url}>
                                            {item.url}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                        {formatSize(item.size)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                        {formatDate(item.mtime)}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleViewImage(item.url)}
                                                className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                                title="查看图片"
                                            >
                                                <IconEye size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.url)}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="删除缓存"
                                            >
                                                <IconTrash size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 图片预览弹窗 */}
            {previewImage && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPreviewImage(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-2xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate max-w-md" title={previewUrl}>
                                {previewUrl}
                            </h3>
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                ✕
                            </button>
                        </div>
                        <img src={previewImage} alt="缓存图片" className="max-w-full h-auto" />
                    </div>
                </div>
            )}
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add src/webui/src/pages/CacheManagePage.tsx
git commit -m "feat(webui): add cache management page"
```

---

## Task 4: 添加 API 客户端函数

**Files:**
- Modify: `src/webui/src/utils/api.ts`

**Step 1: 添加缓存管理 API 函数**

```typescript
import type { ApiResponse, SvgRenderRequest, SvgRenderResponse, SvgServiceStatus } from '../types'

// ... 现有函数 ...

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
```

**Step 2: Commit**

```bash
git add src/webui/src/utils/api.ts
git commit -m "feat(api-client): add cache management API functions"
```

---

## Task 5: 更新路由和导航

**Files:**
- Modify: `src/webui/src/App.tsx`
- Modify: `src/webui/src/components/Sidebar.tsx`
- Modify: `src/webui/src/components/icons.tsx`

**Step 1: 更新 App.tsx**

```typescript
import { CacheManagePage } from './pages/CacheManagePage'

export type PageId = 'svg-render' | 'api-docs' | 'cache-manage'

const pageConfig: Record<PageId, { title: string; desc: string }> = {
    'svg-render': { title: 'SVG 渲染器', desc: '将 SVG 代码渲染为 PNG 图片' },
    'api-docs': { title: 'API 文档', desc: '插件 API 接口文档' },
    'cache-manage': { title: '缓存管理', desc: '管理网络图片缓存' }
}

// 在 renderPage 中添加
case 'cache-manage': return <CacheManagePage />
```

**Step 2: 更新 Sidebar.tsx**

```typescript
import { IconFolder } from './icons'

const menuItems = [
    { id: 'svg-render', label: 'SVG渲染', icon: <IconImage size={18} /> },
    { id: 'api-docs', label: 'API文档', icon: <IconDocs size={18} /> },
    { id: 'cache-manage', label: '缓存管理', icon: <IconFolder size={18} /> },
]
```

**Step 3: 添加图标到 icons.tsx**

```typescript
export function IconFolder({ size, className }: IconProps = defaultProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
    )
}

export function IconEye({ size, className }: IconProps = defaultProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}
```

**Step 4: Commit**

```bash
git add src/webui/src/App.tsx src/webui/src/components/Sidebar.tsx src/webui/src/components/icons.tsx
git commit -m "feat(routing): add cache manage page route and navigation"
```

---

## Task 6: 构建并测试

```bash
pnpm run build
```

测试功能：
1. 查看缓存列表
2. 设置最大缓存大小
3. 查看缓存图片预览
4. 删除单个缓存
5. 清空所有缓存
