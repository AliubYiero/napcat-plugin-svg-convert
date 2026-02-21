/** WebUI 前端类型定义 */

export interface ApiResponse<T = unknown> {
    code: number
    data?: T
    message?: string
}

// 图片缓存映射表
export interface ImageCacheMap {
    [imageUrl: string]: string
}

// SVG 渲染请求
export interface SvgRenderRequest {
    svg: string
    saveWebImage?: boolean
}

// SVG 渲染响应
export interface SvgRenderResponse {
    imageBase64: string
    format: 'png'
}

// SVG 服务状态
export interface SvgServiceStatus {
    installed: boolean
    version?: string
}