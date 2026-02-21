# API 文档页面实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 WebUI 中添加一个新的 API 文档页面，展示插件提供的 REST API 接口文档。

**Architecture:** 创建 `ApiDocsPage.tsx` 组件，展示 `/svg/status` 和 `/svg/render` 两个 API 的文档，包括请求方法、路径、参数、响应格式和示例。添加路由和导航。

**Tech Stack:** React, TypeScript, TailwindCSS

---

## Task 1: 创建 API 文档页面

**Files:**
- Create: `src/webui/src/pages/ApiDocsPage.tsx`

**Step 1: 实现 API 文档页面组件**

```typescript
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
        description: '将 SVG 代码渲染为 PNG 图片',
        params: [
            { name: 'svg', type: 'string', required: true, description: 'SVG 代码字符串' }
        ],
        response: {
            code: 0,
            data: {
                imageBase64: 'data:image/png;base64,iVBORw0KG...',
                format: 'png'
            }
        },
        example: {
            request: {
                svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>'
            },
            response: {
                code: 0,
                data: {
                    imageBase64: 'data:image/png;base64,iVBORw0KG...',
                    format: 'png'
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
                    <li>• Base URL: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">/plugin/&lt;plugin-id&gt;/api</code></li>
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
```

**Step 2: Commit**

```bash
git add src/webui/src/pages/ApiDocsPage.tsx
git commit -m "feat(webui): add API docs page"
```

---

## Task 2: 更新 WebUI 路由

**Files:**
- Modify: `src/webui/src/App.tsx`

**Step 1: 导入页面并添加到 routes**

```typescript
import { ApiDocsPage } from './pages/ApiDocsPage'

// 在 pageConfig 中添加
const pageConfig: Record<PageId, { title: string; desc: string }> = {
    // ... 现有页面 ...
    'api-docs': { title: 'API 文档', desc: '插件 API 接口文档' }
}

// 在 renderPage 中添加 case
function renderPage() {
    switch (currentPage) {
        // ... 现有 case ...
        case 'api-docs': return <ApiDocsPage />
    }
}
```

**Step 2: Commit**

```bash
git add src/webui/src/App.tsx
git commit -m "feat(routing): add API docs page route"
```

---

## Task 3: 更新侧边栏导航

**Files:**
- Modify: `src/webui/src/components/Sidebar.tsx`
- Modify: `src/webui/src/components/icons.tsx`

**Step 1: 在 icons.tsx 添加文档图标**

```typescript
export function IconDocs({ size, className }: IconProps = defaultProps) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
        </svg>
    )
}
```

**Step 2: 在 Sidebar.tsx 添加菜单项**

```typescript
import { IconDocs } from './icons'

// 在 menuItems 数组中添加
{ id: 'api-docs', label: 'API 文档', icon: <IconDocs size={18} /> }
```

**Step 3: Commit**

```bash
git add src/webui/src/components/Sidebar.tsx src/webui/src/components/icons.tsx
git commit -m "feat(ui): add API docs menu item and icon"
```

---

## Task 4: 构建并测试

**Step 1: 构建 WebUI**

```bash
cd src/webui && pnpm run build
cd ../..
```

**Step 2: 构建插件**

```bash
pnpm run build
```

**Step 3: Commit 构建结果**

```bash
git add -A
git commit -m "chore(build): rebuild with API docs page"
```

---

## 功能说明

新页面包含：

1. **基础信息**: 展示 Base URL、认证方式、数据格式
2. **API 列表**: 可展开/折叠的接口列表
3. **接口详情**: 
   - 请求方法（GET/POST 彩色标签）
   - 请求路径
   - 参数说明表格（名称、类型、必填、说明）
   - 响应格式（JSON 代码块）
   - 请求/响应示例（可复制）
4. **错误码说明**: 展示错误码含义

交互特性：
- 点击接口可展开/折叠详情
- 代码块支持一键复制
- 支持深色模式
