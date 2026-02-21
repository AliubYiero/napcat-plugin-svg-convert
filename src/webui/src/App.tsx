import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import ToastContainer from './components/ToastContainer'
import { SvgRenderPage } from './pages/SvgRenderPage'
import { ApiDocsPage } from './pages/ApiDocsPage'
import { CacheManagePage } from './pages/CacheManagePage'
import { useTheme } from './hooks/useTheme'

export type PageId = 'svg-render' | 'api-docs' | 'cache-manage'

const pageConfig: Record<PageId, { title: string; desc: string }> = {
    'svg-render': { title: 'SVG 渲染器', desc: '将 SVG 代码渲染为 PNG 图片' },
    'api-docs': { title: 'API 文档', desc: '插件 API 接口文档' },
    'cache-manage': { title: '缓存管理', desc: '管理网络图片缓存' }
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
            case 'cache-manage': return <CacheManagePage />
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