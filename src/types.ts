/**
 * 类型定义文件
 * 定义插件内部使用的接口和类型
 */

// ==================== SVG 渲染 ====================

// SVG 渲染请求
export interface SvgRenderRequest {
    svg: string;
}

// SVG 渲染响应
export interface SvgRenderResponse {
    imageBase64: string;
    format: 'png';
}

// SVG 服务状态
export interface SvgServiceStatus {
    installed: boolean;
    version?: string;
}

// ==================== API 响应 ====================

/**
 * 统一 API 响应格式
 */
export interface ApiResponse<T = unknown> {
    /** 状态码，0 表示成功，-1 表示失败 */
    code: number;
    /** 错误信息（仅错误时返回） */
    message?: string;
    /** 响应数据（仅成功时返回） */
    data?: T;
}