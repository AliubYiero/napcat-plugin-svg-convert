import { useState, useEffect } from 'react';
import { getSvgServiceStatus, renderSvg } from '../utils/api';
import { showToast } from '../hooks/useToast';
import type { SvgServiceStatus } from '../types';

export function SvgRenderPage() {
    const [svgInput, setSvgInput] = useState('');
    const [renderedImage, setRenderedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<SvgServiceStatus | null>(null);
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);
    const [cacheWebImages, setCacheWebImages] = useState(false);

    useEffect(() => {
        checkStatus();
    }, []);

    async function checkStatus() {
        setIsCheckingStatus(true);
        try {
            const res = await getSvgServiceStatus();
            if (res.code === 0 && res.data) {
                setStatus(res.data);
            } else {
                showToast(res.message || '获取状态失败', 'error');
            }
        } catch {
            showToast('检查服务状态失败', 'error');
        } finally {
            setIsCheckingStatus(false);
        }
    }

    async function handleRender() {
        if (!svgInput.trim()) {
            showToast('请输入 SVG 代码', 'warning');
            return;
        }

        setIsLoading(true);
        try {
            const res = await renderSvg(svgInput, cacheWebImages);
            if (res.code === 0 && res.data) {
                setRenderedImage(res.data.imageBase64);
                showToast('渲染成功', 'success');
            } else {
                showToast(res.message || '渲染失败', 'error');
            }
        } catch {
            showToast('渲染请求失败', 'error');
        } finally {
            setIsLoading(false);
        }
    }

    const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
  <rect width="200" height="100" fill="#FB7299"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-size="20" fill="white" font-family="Arial">
    Hello SVG!
  </text>
</svg>`;

    function loadSample() {
        setSvgInput(sampleSvg);
        setRenderedImage(null);
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    SVG 渲染器
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    使用 rsvg-convert 将 SVG 转换为 PNG 图片
                </p>
            </div>

            <div className={`p-4 rounded-lg border ${
                status?.installed
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                            rsvg-convert 状态
                        </h3>
                        {isCheckingStatus ? (
                            <p className="text-sm text-gray-600 dark:text-gray-400">检查中...</p>
                        ) : status?.installed ? (
                            <p className="text-sm text-green-700 dark:text-green-400">
                                已安装 {status.version ? `(${status.version})` : ''}
                            </p>
                        ) : (
                            <p className="text-sm text-red-700 dark:text-red-400">
                                未安装，请先安装 librsvg 工具
                            </p>
                        )}
                    </div>
                    <div className={`w-3 h-3 rounded-full ${
                        status?.installed ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        SVG 代码
                    </label>
                    <button
                        onClick={loadSample}
                        className="text-sm text-[#FB7299] hover:text-[#fc8bab] transition-colors"
                    >
                        加载示例
                    </button>
                </div>
                <textarea
                    value={svgInput}
                    onChange={(e) => setSvgInput(e.target.value)}
                    placeholder="在此粘贴 SVG 代码..."
                    className="w-full h-48 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                             focus:ring-2 focus:ring-[#FB7299] focus:border-transparent
                             font-mono text-sm resize-y"
                    spellCheck={false}
                />
            </div>

            <button
                onClick={handleRender}
                disabled={isLoading || !status?.installed}
                className="w-full py-3 px-4 bg-[#FB7299] hover:bg-[#fc8bab] text-white font-medium rounded-lg
                         transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        渲染中...
                    </>
                ) : (
                    '渲染为 PNG'
                )}
            </button>

            {renderedImage && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        渲染结果
                    </label>
                    <div className="p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                        <img src={renderedImage} alt="Rendered SVG" className="max-w-full h-auto mx-auto"/>
                    </div>
                    <a href={renderedImage} download="rendered.png"
                       className="block text-center text-sm text-[#FB7299] hover:text-[#fc8bab] transition-colors">
                        下载图片
                    </a>
                </div>
            )}
        </div>
    );
}
