/**
 * SVG 渲染服务模块
 * 使用 rsvg-convert 工具将 SVG 转换为 PNG
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { SvgServiceStatus } from '../types';

const execAsync = promisify(exec);

export class SvgService {
    private ctx: NapCatPluginContext;
    private tempDir: string;

    constructor(ctx: NapCatPluginContext) {
        this.ctx = ctx;
        this.tempDir = path.join(ctx.dataPath, 'temp');
        this.ensureTempDir();
    }

    private ensureTempDir(): void {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
            this.ctx.logger.info(`创建临时目录: ${this.tempDir}`);
        }
    }

    async checkStatus(): Promise<SvgServiceStatus> {
        try {
            const { stdout } = await execAsync('rsvg-convert --version');
            const version = stdout.trim().split('\n')[0];
            return { installed: true, version: version || 'unknown' };
        } catch {
            return { installed: false };
        }
    }

    async renderSvgToPng(svgContent: string): Promise<string> {
        const status = await this.checkStatus();
        if (!status.installed) {
            throw new Error('rsvg-convert 未安装，请先安装 librsvg 工具');
        }

        const MAX_SIZE = 1024 * 1024;
        if (Buffer.byteLength(svgContent, 'utf8') > MAX_SIZE) {
            throw new Error('SVG 内容过大，最大支持 1MB');
        }

        const id = crypto.randomUUID();
        const inputPath = path.join(this.tempDir, `${id}.svg`);
        const outputPath = path.join(this.tempDir, `${id}.png`);

        try {
            fs.writeFileSync(inputPath, svgContent, 'utf8');
            this.ctx.logger.debug(`写入临时 SVG 文件: ${inputPath}`);

            await execAsync(`rsvg-convert "${inputPath}" > "${outputPath}"`);
            this.ctx.logger.debug(`渲染完成: ${outputPath}`);

            const pngBuffer = fs.readFileSync(outputPath);
            return `data:image/png;base64,${pngBuffer.toString('base64')}`;
        } finally {
            this.cleanup(inputPath, outputPath);
        }
    }

    private cleanup(...files: string[]): void {
        for (const file of files) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    this.ctx.logger.debug(`删除临时文件: ${file}`);
                }
            } catch (err) {
                this.ctx.logger.warn(`删除临时文件失败: ${file}`, err);
            }
        }
    }
}
