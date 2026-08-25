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
    format: string  // MIME 类型，如 "image/png"
}

// SVG 服务状态
export interface SvgServiceStatus {
    installed: boolean
    version?: string
}

// 临时目录统计
export interface TempStats {
    count: number
    size: number
}

// 计算字符宽度请求
export interface CharWidthRequest {
    text: string,
    fontSize: number,
}

// 计算字符宽度响应
export interface CharWidthResponse {
    totalWidth: number,
}
