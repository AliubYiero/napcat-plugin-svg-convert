import { useState, useEffect, useCallback } from 'react';
import { getCacheList, deleteCache, clearAllCache, updateCacheSettings, viewCacheImage } from '../utils/api';
import { showToast } from '../hooks/useToast';

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
    }, []);

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
                showToast(`已清空 ${res.data?.deleted ?? 0} 个缓存`, 'success');
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
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
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
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                    <circle cx="12" cy="12" r="3" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.url)}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="删除缓存"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
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
