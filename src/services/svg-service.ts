/**
 * SVG 渲染服务模块
 * 使用 rsvg-convert 工具将 SVG 转换为 PNG
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { SvgServiceStatus } from '../types';

const MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB
const RSVG_TIMEOUT = 30000; // 30秒

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
            const stdout = await this.runCommand('rsvg-convert', ['--version']);
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
            this.ctx.logger.debug('写入临时 SVG 文件');

            // 使用 spawn 替代 exec，避免命令注入
            await this.runRsvgConvert(inputPath, outputPath);

            // 检查输出文件大小
            const stats = fs.statSync(outputPath);
            if (stats.size > MAX_OUTPUT_SIZE) {
                throw new Error('生成的图片过大，最大支持 10MB');
            }

            this.ctx.logger.debug('渲染完成');

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
                    this.ctx.logger.debug('删除临时文件');
                }
            } catch (err) {
                this.ctx.logger.warn('删除临时文件失败', err);
            }
        }
    }

    /**
     * 使用 spawn 执行 rsvg-convert 命令（更安全，避免命令注入）
     */
    private runRsvgConvert(inputPath: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const proc = spawn('rsvg-convert', [inputPath], {
                timeout: RSVG_TIMEOUT,
            });

            const output = fs.createWriteStream(outputPath);
            proc.stdout.pipe(output);

            proc.on('error', () => reject(new Error('rsvg-convert 执行失败')));
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`rsvg-convert 退出码: ${code}`));
            });
        });
    }

    /**
     * 使用 spawn 执行命令并返回 stdout
     */
    private runCommand(command: string, args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            const proc = spawn(command, args, {
                timeout: RSVG_TIMEOUT,
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('error', () => reject(new Error('命令执行失败')));
            proc.on('close', (code) => {
                if (code === 0) resolve(stdout);
                else reject(new Error(`命令退出码: ${code}`));
            });
        });
    }
}
