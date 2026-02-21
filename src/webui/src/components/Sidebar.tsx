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