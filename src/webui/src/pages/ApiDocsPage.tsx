import { useState } from 'react';

interface ApiEndpoint {
    method: 'GET' | 'POST';
    path: string;
    description: string;
    params?: { name: string; type: string; required: boolean; description: string }[];
    response: object;
    example?: { request?: object; response?: object };
}

const apiEndpoints: ApiEndpoint[] = [
    {
        method: 'GET',
        path: '/svg/status',
        description: '获取 rsvg-convert 工具的安装状态',
        response: {
            code: 0,
            data: {
                installed: true,
                version: 'rsvg-convert version 2.50.0'
            }
        },
        example: {
            response: {
                code: 0,
                data: {
                    installed: true,
                    version: 'rsvg-convert version 2.50.0'
                }
            }
        }
    },
    {
        method: 'POST',
        path: '/svg/render',
        description: '将 SVG 代码渲染为 PNG 图片，支持网络图片缓存',
        params: [
            { name: 'svg', type: 'string', required: true, description: 'SVG 代码字符串' },
            {
                name: 'saveWebImage',
                type: 'boolean',
                required: false,
                description: '是否缓存网络图片到本地（默认 false）。启用后，SVG 中的网络图片会被下载并缓存，下次渲染相同图片时直接使用缓存'
            }
        ],
        response: {
            code: 0,
            data: {
                imageBase64: 'iVBORw0KG...',
                format: 'image/png'
            }
        },
        example: {
            request: {
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><image href="https://example.com/img.png" width="100" height="100"/></svg>',
                saveWebImage: true
            },
            response: {
                code: 0,
                data: {
                    imageBase64: 'iVBORw0KG...',
                    format: 'image/png'
                }
            }
        }
    },
    {
        method: 'POST',
        path: '/char/width',
        description: '预估输入字符串的宽度, 用于动态渲染 svg 时计算 svg 容器的宽度',
        params: [
            { name: 'text', type: 'string', required: true, description: '要进行计算的字符串' },
            {
                name: 'fontSize',
                type: 'number',
                required: false,
                description: '字体大小, 默认为 16px'
            }
        ],
        response: {
            code: 0,
            data: {
                totalWidth: 1206,
            }
        },
        example: {
            request: {
                text: '你好, Svg!',
                fontSize: 16
            },
            response: {
                code: 0,
                data: {
                    totalWidth: 74.72,
                }
            }
        }
    }
];

function MethodBadge({ method }: { method: string }) {
    const colors = {
        GET: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    };
    return (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[method as keyof typeof colors]}`}>
            {method}
        </span>
    );
}

function CodeBlock({ title, code }: { title?: string; code: string }) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
            {title && (
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <span className="text-xs text-gray-400">{title}</span>
                    <button
                        onClick={copyToClipboard}
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                        {copied ? '已复制!' : '复制'}
                    </button>
                </div>
            )}
            <pre className="p-4 text-sm text-gray-100 overflow-x-auto">
                <code>{code}</code>
            </pre>
        </div>
    );
}

export function ApiDocsPage() {
    const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);

    const toggleEndpoint = (path: string) => {
        setExpandedEndpoint(expandedEndpoint === path ? null : path);
    };

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    API 文档
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    SVG 渲染插件提供的 REST API 接口
                </p>
            </div>

            {/* 基础信息 */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                    基础信息
                </h3>
                <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                    <li>• Host: http://127.0.0.1:6099</li>
                    <li>• Base URL: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/plugin/napcat-plugin-svg-render/api</code></li>
                    <li>• 认证: 无需认证（NoAuth）</li>
                    <li>• 数据格式: JSON</li>
                </ul>
            </div>

            {/* API 列表 */}
            <div className="space-y-4">
                {apiEndpoints.map((endpoint) => (
                    <div
                        key={endpoint.path}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                    >
                        {/* 请求概览 */}
                        <button
                            onClick={() => toggleEndpoint(endpoint.path)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <MethodBadge method={endpoint.method} />
                                <code className="text-sm font-mono text-gray-700 dark:text-gray-300">
                                    {endpoint.path}
                                </code>
                                <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                                    {endpoint.description}
                                </span>
                            </div>
                            <svg
                                className={`w-5 h-5 text-gray-400 transition-transform ${
                                    expandedEndpoint === endpoint.path ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {/* 详细信息 */}
                        {expandedEndpoint === endpoint.path && (
                            <div className="px-4 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 space-y-4">
                                {/* 描述 */}
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {endpoint.description}
                                </p>

                                {/* 请求参数 */}
                                {endpoint.params && endpoint.params.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                            请求参数
                                        </h4>
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                                    <th className="text-left py-2 text-gray-600 dark:text-gray-400">参数名</th>
                                                    <th className="text-left py-2 text-gray-600 dark:text-gray-400">类型</th>
                                                    <th className="text-left py-2 text-gray-600 dark:text-gray-400">必填</th>
                                                    <th className="text-left py-2 text-gray-600 dark:text-gray-400">说明</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {endpoint.params.map((param) => (
                                                    <tr key={param.name} className="border-b border-gray-100 dark:border-gray-800">
                                                        <td className="py-2 font-mono text-gray-900 dark:text-white">{param.name}</td>
                                                        <td className="py-2 text-gray-600 dark:text-gray-400">{param.type}</td>
                                                        <td className="py-2">
                                                            <span className={`text-xs ${param.required ? 'text-red-500' : 'text-gray-500'}`}>
                                                                {param.required ? '是' : '否'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 text-gray-600 dark:text-gray-400">{param.description}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* 响应格式 */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                        响应格式
                                    </h4>
                                    <CodeBlock code={JSON.stringify(endpoint.response, null, 2)} />
                                </div>

                                {/* 示例 */}
                                {endpoint.example && (
                                    <div className="space-y-3">
                                        {endpoint.example.request && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                                    请求示例
                                                </h4>
                                                <CodeBlock title="Request Body" code={JSON.stringify(endpoint.example.request, null, 2)} />
                                            </div>
                                        )}
                                        {endpoint.example.response && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                                    响应示例
                                                </h4>
                                                <CodeBlock title="Response Body" code={JSON.stringify(endpoint.example.response, null, 2)} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 缓存功能说明 */}
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">
                    网络图片缓存
                </h3>
                <ul className="text-sm text-purple-800 dark:text-purple-300 space-y-1">
                    <li>• 设置 <code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">saveWebImage: true</code> 启用缓存</li>
                    <li>• 缓存位置: <code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">cache-image/</code> 目录</li>
                    <li>• 缓存限制: 单个文件最大 5MB，总缓存最大 50MB</li>
                    <li>• 自动清理: 超过限制时自动删除最旧的缓存文件</li>
                    <li>• 映射表: <code className="bg-purple-100 dark:bg-purple-800 px-1 rounded">image-cache-map.json</code> 保存 URL 到本地路径的映射</li>
                </ul>
            </div>

            {/* 错误码说明 */}
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
                    错误码
                </h3>
                <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                    <li>• <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">code: 0</code> - 成功</li>
                    <li>• <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">code: -1</code> - 失败（message 字段包含错误信息）</li>
                </ul>
            </div>
        </div>
    );
}
