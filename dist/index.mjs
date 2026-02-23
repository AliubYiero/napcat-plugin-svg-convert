import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as crypto from 'crypto';

const CACHE_DIR_NAME = "cache-image";
const CACHE_MAP_FILE = "image-cache-map.json";
const MAX_CACHE_SIZE = 50 * 1024 * 1024;
class ImageCacheService {
  ctx;
  cacheDir;
  tempDir;
  mapFilePath;
  cacheMap = {};
  maxCacheSize = MAX_CACHE_SIZE;
  constructor(ctx) {
    this.ctx = ctx;
    this.cacheDir = path.join(ctx.dataPath, CACHE_DIR_NAME);
    this.tempDir = path.join(ctx.dataPath, "temp");
    this.mapFilePath = path.join(ctx.dataPath, CACHE_MAP_FILE);
    this.ensureCacheDir();
    this.loadCacheMap();
    this.loadSettings();
  }
  /**
   * 加载设置
   */
  loadSettings() {
    try {
      const settingsPath = path.join(this.ctx.dataPath, "cache-settings.json");
      if (fs.existsSync(settingsPath)) {
        const data = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        if (data.maxSize) {
          this.maxCacheSize = data.maxSize * 1024 * 1024;
        }
      }
    } catch (err) {
      this.ctx.logger.warn("加载缓存设置失败:", err);
    }
  }
  /**
   * 保存设置
   */
  saveSettings() {
    try {
      const settingsPath = path.join(this.ctx.dataPath, "cache-settings.json");
      fs.writeFileSync(settingsPath, JSON.stringify({ maxSize: this.getMaxCacheSize() }, null, 2), "utf8");
    } catch (err) {
      this.ctx.logger.warn("保存缓存设置失败:", err);
    }
  }
  /**
   * 获取缓存列表
   */
  getCacheList() {
    try {
      const list = [];
      this.loadCacheMap();
      const cacheFiles = fs.readdirSync(this.cacheDir);
      for (const filename of cacheFiles) {
        const localPath = path.join(this.cacheDir, filename);
        const stats = fs.statSync(localPath);
        if (stats.isFile()) {
          let url = "";
          for (const [mappedUrl, mappedPath] of Object.entries(this.cacheMap)) {
            if (mappedPath === localPath) {
              url = mappedUrl;
              break;
            }
          }
          if (!url) {
            url = `未知来源: ${filename}`;
          }
          list.push({
            url,
            localPath,
            size: stats.size,
            mtime: stats.mtime
          });
        }
      }
      list.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      return list;
    } catch (err) {
      this.ctx.logger.warn("获取缓存列表失败:", err);
      return [];
    }
  }
  /**
   * 设置最大缓存大小
   */
  setMaxCacheSize(sizeMB) {
    if (sizeMB < 10 || sizeMB > 500) {
      throw new Error("缓存大小必须在 10MB 到 500MB 之间");
    }
    this.maxCacheSize = sizeMB * 1024 * 1024;
    this.saveSettings();
    this.ctx.logger.info(`最大缓存大小已设置为 ${sizeMB}MB`);
  }
  /**
   * 获取最大缓存大小
   */
  getMaxCacheSize() {
    return Math.floor(this.maxCacheSize / (1024 * 1024));
  }
  /**
   * 删除单个缓存
   */
  deleteCache(url) {
    try {
      const localPath = this.cacheMap[url];
      if (!localPath) {
        return false;
      }
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
      delete this.cacheMap[url];
      this.saveCacheMap();
      this.ctx.logger.info(`删除缓存: ${url}`);
      return true;
    } catch (err) {
      this.ctx.logger.warn("删除缓存失败:", err);
      return false;
    }
  }
  /**
   * 清空所有缓存
   */
  clearAllCache() {
    let deleted = 0;
    let errors = 0;
    for (const [url, localPath] of Object.entries(this.cacheMap)) {
      try {
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
        delete this.cacheMap[url];
        deleted++;
      } catch (err) {
        errors++;
        this.ctx.logger.warn(`删除缓存失败: ${url}`, err);
      }
    }
    this.saveCacheMap();
    this.ctx.logger.info(`清空缓存完成: ${deleted} 成功, ${errors} 失败`);
    return { deleted, errors };
  }
  /**
   * 获取缓存图片 base64
   */
  async getCacheImageBase64(url) {
    try {
      const localPath = this.cacheMap[url];
      if (!localPath || !fs.existsSync(localPath)) {
        return null;
      }
      const buffer = fs.readFileSync(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const mimeType = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".gif" ? "image/gif" : "image/png";
      return `data:${mimeType};base64,${buffer.toString("base64")}`;
    } catch (err) {
      this.ctx.logger.warn("获取缓存图片失败:", err);
      return null;
    }
  }
  /**
   * 确保缓存目录存在
   */
  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      this.ctx.logger.info("图片缓存目录已创建");
    }
  }
  /**
   * 加载缓存映射表
   */
  loadCacheMap() {
    try {
      if (fs.existsSync(this.mapFilePath)) {
        const data = fs.readFileSync(this.mapFilePath, "utf8");
        this.cacheMap = JSON.parse(data);
        this.ctx.logger.debug(`已加载图片缓存映射表，共 ${Object.keys(this.cacheMap).length} 条记录`);
      }
    } catch (err) {
      this.ctx.logger.warn("加载图片缓存映射表失败:", err);
      this.cacheMap = {};
    }
  }
  /**
   * 保存缓存映射表
   */
  saveCacheMap() {
    try {
      fs.writeFileSync(this.mapFilePath, JSON.stringify(this.cacheMap, null, 2), "utf8");
      this.ctx.logger.debug("图片缓存映射表已保存");
    } catch (err) {
      this.ctx.logger.warn("保存图片缓存映射表失败:", err);
    }
  }
  /**
   * 从缓存获取图片，如果不存在则下载
   * @param imageUrl 网络图片URL
   * @returns 本地图片路径
   */
  async getOrDownloadImage(imageUrl) {
    if (this.cacheMap[imageUrl] && fs.existsSync(this.cacheMap[imageUrl])) {
      this.ctx.logger.debug(`缓存命中: ${imageUrl}`);
      return this.cacheMap[imageUrl];
    }
    const localPath = await this.downloadImage(imageUrl);
    if (localPath) {
      this.cacheMap[imageUrl] = localPath;
      this.saveCacheMap();
    }
    return localPath;
  }
  /**
   * 仅从缓存获取图片路径，如果不存在返回 null（不自动下载）
   * @param imageUrl 网络图片URL
   * @returns 本地缓存路径，不存在返回 null
   */
  getCachedImagePath(imageUrl) {
    const cachedPath = this.cacheMap[imageUrl];
    if (cachedPath && fs.existsSync(cachedPath)) {
      this.ctx.logger.debug(`缓存命中(只读): ${imageUrl}`);
      return cachedPath;
    }
    return null;
  }
  /**
   * 下载图片到缓存目录
   */
  async downloadImage(imageUrl) {
    try {
      const url = new URL(imageUrl);
      const ext = path.extname(url.pathname) || ".png";
      const filename = `${crypto.randomUUID()}${ext}`;
      const localPath = path.join(this.cacheDir, filename);
      this.ctx.logger.info(`下载网络图片到缓存: ${imageUrl}`);
      await this.cleanupIfNeeded();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3e4);
      const response = await fetch(imageUrl, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
      if (buffer.length > MAX_IMAGE_SIZE) {
        throw new Error("图片过大，最大支持 5MB");
      }
      fs.writeFileSync(localPath, buffer);
      this.ctx.logger.info(`图片已缓存: ${localPath}`);
      return localPath;
    } catch (err) {
      this.ctx.logger.warn(`下载图片失败: ${imageUrl}`, err);
      return null;
    }
  }
  /**
   * 检查并清理缓存（如果超过总大小限制）
   */
  async cleanupIfNeeded() {
    try {
      let totalSize = 0;
      const files = [];
      const cacheFiles = fs.readdirSync(this.cacheDir);
      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
          files.push({ path: filePath, mtime: stats.mtime, size: stats.size });
        }
      }
      if (totalSize > this.maxCacheSize) {
        files.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
        let sizeToFree = totalSize - this.maxCacheSize + 10 * 1024 * 1024;
        for (const file of files) {
          if (sizeToFree <= 0) break;
          fs.unlinkSync(file.path);
          sizeToFree -= file.size;
          for (const [url, cachedPath] of Object.entries(this.cacheMap)) {
            if (cachedPath === file.path) {
              delete this.cacheMap[url];
              break;
            }
          }
          this.ctx.logger.info(`清理旧缓存: ${file.path}`);
        }
        this.saveCacheMap();
      }
    } catch (err) {
      this.ctx.logger.warn("清理缓存失败:", err);
    }
  }
  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    try {
      let size = 0;
      let count = 0;
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          size += stats.size;
          count++;
        }
      }
      return { count, size };
    } catch {
      return { count: 0, size: 0 };
    }
  }
  /**
   * 获取临时目录统计信息
   */
  getTempStats() {
    try {
      if (!fs.existsSync(this.tempDir)) {
        return { count: 0, size: 0 };
      }
      let size = 0;
      let count = 0;
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          size += stats.size;
          count++;
        }
      }
      return { count, size };
    } catch (err) {
      this.ctx.logger.warn("获取临时目录统计失败:", err);
      return { count: 0, size: 0 };
    }
  }
  /**
   * 清理临时目录中的所有文件
   */
  clearTempDir() {
    let deleted = 0;
    let errors = 0;
    try {
      if (!fs.existsSync(this.tempDir)) {
        return { deleted: 0, errors: 0 };
      }
      const files = fs.readdirSync(this.tempDir);
      for (const file of files) {
        try {
          const filePath = path.join(this.tempDir, file);
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            fs.unlinkSync(filePath);
            deleted++;
          }
        } catch (err) {
          errors++;
          this.ctx.logger.warn(`删除临时文件失败: ${file}`, err);
        }
      }
      this.ctx.logger.info(`清理临时目录完成: ${deleted} 成功, ${errors} 失败`);
      return { deleted, errors };
    } catch (err) {
      this.ctx.logger.warn("清理临时目录失败:", err);
      return { deleted, errors };
    }
  }
}

const MAX_OUTPUT_SIZE = 10 * 1024 * 1024;
const RSVG_TIMEOUT = 3e4;
class SvgService {
  ctx;
  tempDir;
  imageCacheService;
  constructor(ctx) {
    this.ctx = ctx;
    this.tempDir = path.join(ctx.dataPath, "temp");
    this.imageCacheService = new ImageCacheService(ctx);
    this.ensureTempDir();
  }
  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      this.ctx.logger.info("临时目录已创建");
    }
  }
  async checkStatus() {
    try {
      const stdout = await this.runCommand("rsvg-convert", ["--version"]);
      const version = stdout.trim().split("\n")[0];
      return { installed: true, version: version || "unknown" };
    } catch {
      return { installed: false };
    }
  }
  async renderSvgToPng(svgContent, saveWebImage = false) {
    const status = await this.checkStatus();
    if (!status.installed) {
      throw new Error("rsvg-convert 未安装，请先安装 librsvg 工具");
    }
    const MAX_SIZE = 1024 * 1024;
    if (Buffer.byteLength(svgContent, "utf8") > MAX_SIZE) {
      throw new Error("SVG 内容过大，最大支持 1MB");
    }
    const id = crypto.randomUUID();
    const inputPath = path.join(this.tempDir, `${id}.svg`);
    const outputPath = path.join(this.tempDir, `${id}.png`);
    const downloadedImages = [];
    try {
      const { processedSvg, downloadedFiles } = await this.processExternalImages(svgContent, saveWebImage);
      downloadedImages.push(...downloadedFiles);
      fs.writeFileSync(inputPath, processedSvg, "utf8");
      this.ctx.logger.debug("写入临时 SVG 文件");
      await this.runRsvgConvert(inputPath, outputPath);
      const stats = fs.statSync(outputPath);
      if (stats.size > MAX_OUTPUT_SIZE) {
        throw new Error("生成的图片过大，最大支持 10MB");
      }
      this.ctx.logger.debug("渲染完成");
      const pngBuffer = fs.readFileSync(outputPath);
      return pngBuffer.toString("base64");
    } finally {
      this.cleanup(...downloadedImages);
      this.cleanup(inputPath, outputPath);
    }
  }
  /**
   * 从缓存路径创建临时文件
   * @param sourcePath 源文件路径（缓存文件）
   * @returns 临时文件路径和显示名称
   */
  createTempFromCache(sourcePath) {
    const ext = path.extname(sourcePath) || ".png";
    const tempFilename = `cached_${crypto.randomUUID()}${ext}`;
    const tempPath = path.join(this.tempDir, tempFilename);
    fs.copyFileSync(sourcePath, tempPath);
    return { tempPath, displayPath: tempFilename };
  }
  /**
   * 解析 SVG 并下载外部图片
   * @param svgContent SVG 内容
   * @param saveWebImage 是否保存到缓存目录
   * @returns 处理后的 SVG 内容和下载的文件列表
   */
  async processExternalImages(svgContent, saveWebImage) {
    const imageRegex = /<image[^>]*?(?:xlink:href|href)=["'](https?:\/\/[^"']+)["'][^>]*?>/gi;
    const downloadedFiles = [];
    let processedSvg = svgContent;
    const matches = [];
    let match;
    while ((match = imageRegex.exec(svgContent)) !== null) {
      matches.push({
        fullTag: match[0],
        imageUrl: match[1].trim()
      });
    }
    if (matches.length === 0) {
      return { processedSvg, downloadedFiles };
    }
    this.ctx.logger.info(`发现 ${matches.length} 个外部图片，开始处理...`);
    const downloadPromises = matches.map(async ({ imageUrl }) => {
      let localPath = null;
      let displayPath = null;
      let cachedPath = this.imageCacheService.getCachedImagePath(imageUrl);
      if (cachedPath) {
        localPath = cachedPath;
        displayPath = cachedPath;
        this.ctx.logger.debug(`使用缓存图片: ${cachedPath}`);
      } else if (saveWebImage) {
        cachedPath = await this.imageCacheService.getOrDownloadImage(imageUrl);
        if (cachedPath) {
          localPath = cachedPath;
          displayPath = cachedPath;
        }
      } else {
        localPath = await this.downloadImageToTemp(imageUrl);
        if (localPath) {
          displayPath = localPath;
          downloadedFiles.push(localPath);
        }
      }
      if (localPath && displayPath) {
        processedSvg = processedSvg.split(imageUrl).join(displayPath);
      }
    });
    await Promise.all(downloadPromises);
    return { processedSvg, downloadedFiles };
  }
  /**
   * 尝试下载图片
   * @param imageUrl 图片 URL
   * @returns 本地文件路径，下载失败返回 null
   */
  async tryDownload(imageUrl) {
    const url = new URL(imageUrl);
    const ext = path.extname(url.pathname) || ".png";
    const filename = `img_${crypto.randomUUID()}${ext}`;
    const localPath = path.join(this.tempDir, filename);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3e4);
    const response = await fetch(imageUrl, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error("图片过大，最大支持 5MB");
    }
    fs.writeFileSync(localPath, buffer);
    this.ctx.logger.debug(`图片已保存: ${localPath}`);
    return localPath;
  }
  /**
   * 下载图片到临时目录（带1次重试）
   * @param imageUrl 图片 URL
   * @returns 本地文件路径，下载失败返回 null
   */
  async downloadImageToTemp(imageUrl) {
    const MAX_RETRIES = 1;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.ctx.logger.debug(`下载外部图片: ${imageUrl}${attempt > 0 ? ` (第${attempt + 1}次尝试)` : ""}`);
        const result = await this.tryDownload(imageUrl);
        if (result && attempt > 0) {
          this.ctx.logger.info(`图片下载重试成功: ${imageUrl}`);
        }
        return result;
      } catch (err) {
        const isLastAttempt = attempt >= MAX_RETRIES;
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (isLastAttempt) {
          this.ctx.logger.warn(`下载图片失败（已重试${MAX_RETRIES}次）: ${imageUrl}，错误: ${errorMessage}`);
          return null;
        }
        this.ctx.logger.warn(`下载图片失败，1秒后重试: ${imageUrl}，错误: ${errorMessage}`);
        await new Promise((resolve) => setTimeout(resolve, 1e3));
      }
    }
    return null;
  }
  cleanup(...files) {
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          this.ctx.logger.debug("删除临时文件");
        }
      } catch (err) {
        this.ctx.logger.warn("删除临时文件失败", err);
      }
    }
  }
  /**
   * 使用 spawn 执行 rsvg-convert 命令（更安全，避免命令注入）
   */
  runRsvgConvert(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const proc = spawn("rsvg-convert", [inputPath], {
        timeout: RSVG_TIMEOUT
      });
      const output = fs.createWriteStream(outputPath);
      proc.stdout.pipe(output);
      proc.on("error", () => reject(new Error("rsvg-convert 执行失败")));
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`rsvg-convert 退出码: ${code}`));
      });
    });
  }
  /**
   * 使用 spawn 执行命令并返回 stdout
   */
  runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        timeout: RSVG_TIMEOUT
      });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      proc.on("error", () => reject(new Error("命令执行失败")));
      proc.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`命令退出码: ${code}`));
      });
    });
  }
}

async function buildConfigSchema(ctx) {
  const pluginName = ctx.pluginName;
  const webuiUrl = `/plugin/${pluginName}/page/dashboard`;
  const svgService = new SvgService(ctx);
  const status = await svgService.checkStatus();
  const statusHtml = status.installed ? `
            <div style="padding: 12px 16px; background: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#4caf50">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <span style="font-weight: 600; color: #2e7d32;">依赖已就绪</span>
                </div>
                <p style="margin: 0; font-size: 12px; color: #1b5e20;">
                    rsvg-convert 已安装 ${status.version ? `(${status.version})` : ""}
                </p>
            </div>
        ` : `
            <div style="padding: 12px 16px; background: #ffebee; border-left: 4px solid #f44336; border-radius: 8px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#f44336">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <span style="font-weight: 600; color: #c62828;">依赖未安装</span>
                </div>
                <p style="margin: 0; font-size: 12px; color: #b71c1c;">
                    rsvg-convert 未安装，请先安装 librsvg：
                    <br/>• Windows: MSYS2 或预编译二进制
                    <br/>• Linux: sudo apt-get install librsvg2-bin
                    <br/>• macOS: brew install librsvg
                </p>
            </div>
        `;
  return ctx.NapCatConfig.combine(
    // 插件信息头部
    ctx.NapCatConfig.html(`
            <div style="padding: 16px; background: linear-gradient(135deg, #FB7299 0%, #fc8bab 100%); border-radius: 12px; margin-bottom: 20px; color: white;">
                <h3 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 600;">🎨 SVG 渲染器</h3>
                <p style="margin: 0; font-size: 13px; opacity: 0.9;">将 SVG 代码渲染为 PNG 图片，支持 WebUI 可视化操作</p>
            </div>
        `),
    // 跳转到 WebUI
    ctx.NapCatConfig.html(`
            <div style="margin-bottom: 20px;">
                <a href="${webuiUrl}" target="_blank"
                   style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px;
                          background: #FB7299; color: white; text-decoration: none; border-radius: 8px;
                          font-size: 14px; font-weight: 500; transition: all 0.2s;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    打开 SVG 渲染器 →
                </a>
            </div>
        `),
    // 动态状态提示
    ctx.NapCatConfig.html(statusHtml)
  );
}

const DEFAULT_CONFIG = {
  enabled: true,
  debug: false
};
class PluginState {
  _ctx = null;
  _config = DEFAULT_CONFIG;
  init(ctx) {
    this._ctx = ctx;
    this._config = { ...DEFAULT_CONFIG };
  }
  get ctx() {
    if (!this._ctx) throw new Error("PluginState not initialized");
    return this._ctx;
  }
  get config() {
    return this._config;
  }
  updateConfig(partial) {
    this._config = { ...this._config, ...partial };
  }
  replaceConfig(config) {
    this._config = config;
  }
  cleanup() {
    this._ctx = null;
  }
}
const pluginState = new PluginState();

function registerApiRoutes(ctx) {
  const router = ctx.router;
  const svgService = new SvgService(ctx);
  const imageCacheService = new ImageCacheService(ctx);
  router.getNoAuth("/svg/status", async (_req, res) => {
    try {
      const status = await svgService.checkStatus();
      res.json({ code: 0, data: status });
    } catch (err) {
      ctx.logger.error("获取 SVG 服务状态失败:", err);
      res.status(500).json({ code: -1, message: String(err) });
    }
  });
  router.postNoAuth("/svg/render", async (req, res) => {
    try {
      const body = req.body;
      if (!body || !body.svg) {
        return res.status(400).json({ code: -1, message: "缺少 svg 参数" });
      }
      const saveWebImage = body.saveWebImage ?? false;
      const imageBase64 = await svgService.renderSvgToPng(body.svg, saveWebImage);
      res.json({
        code: 0,
        data: {
          imageBase64,
          format: "image/png"
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error("SVG 渲染失败:", err);
      res.status(500).json({ code: -1, message });
    }
  });
  router.getNoAuth("/cache/list", async (_req, res) => {
    try {
      const list = imageCacheService.getCacheList();
      const stats = imageCacheService.getCacheStats();
      const maxSize = imageCacheService.getMaxCacheSize();
      res.json({
        code: 0,
        data: {
          list,
          stats,
          maxSize
        }
      });
    } catch (err) {
      ctx.logger.error("获取缓存列表失败:", err);
      res.status(500).json({ code: -1, message: String(err) });
    }
  });
  router.getNoAuth("/cache/image", async (req, res) => {
    try {
      const url = req.query?.url;
      if (!url) {
        return res.status(400).json({ code: -1, message: "缺少 url 参数" });
      }
      const base64 = await imageCacheService.getCacheImageBase64(url);
      if (!base64) {
        return res.status(404).json({ code: -1, message: "缓存图片不存在" });
      }
      res.json({
        code: 0,
        data: { imageBase64: base64 }
      });
    } catch (err) {
      ctx.logger.error("获取缓存图片失败:", err);
      res.status(500).json({ code: -1, message: String(err) });
    }
  });
  router.postNoAuth("/cache/settings", async (req, res) => {
    try {
      const body = req.body;
      if (!body || typeof body.maxSize !== "number") {
        return res.status(400).json({ code: -1, message: "缺少 maxSize 参数" });
      }
      imageCacheService.setMaxCacheSize(body.maxSize);
      res.json({
        code: 0,
        message: `最大缓存大小已设置为 ${body.maxSize}MB`
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error("设置缓存大小失败:", err);
      res.status(500).json({ code: -1, message });
    }
  });
  router.postNoAuth("/cache/delete", async (req, res) => {
    try {
      const body = req.body;
      if (!body || !body.url) {
        return res.status(400).json({ code: -1, message: "缺少 url 参数" });
      }
      const success = imageCacheService.deleteCache(body.url);
      if (success) {
        res.json({ code: 0, message: "缓存已删除" });
      } else {
        res.status(404).json({ code: -1, message: "缓存不存在" });
      }
    } catch (err) {
      ctx.logger.error("删除缓存失败:", err);
      res.status(500).json({ code: -1, message: String(err) });
    }
  });
  router.postNoAuth("/cache/clear", async (_req, res) => {
    try {
      const result = imageCacheService.clearAllCache();
      res.json({
        code: 0,
        data: result,
        message: `已清空 ${result.deleted} 个缓存，失败 ${result.errors} 个`
      });
    } catch (err) {
      ctx.logger.error("清空缓存失败:", err);
      res.status(500).json({ code: -1, message: String(err) });
    }
  });
  router.getNoAuth("/cache/temp-stats", async (_req, res) => {
    try {
      const stats = imageCacheService.getTempStats();
      res.json({
        code: 0,
        data: stats
      });
    } catch (err) {
      ctx.logger.error("获取临时目录统计失败:", err);
      res.status(500).json({ code: -1, message: String(err) });
    }
  });
  router.postNoAuth("/cache/temp-clear", async (_req, res) => {
    try {
      const result = imageCacheService.clearTempDir();
      res.json({
        code: 0,
        data: result,
        message: `已清理 ${result.deleted} 个临时文件，失败 ${result.errors} 个`
      });
    } catch (err) {
      ctx.logger.error("清理临时目录失败:", err);
      res.status(500).json({ code: -1, message: String(err) });
    }
  });
  ctx.logger.debug("API 路由注册完成");
}

let plugin_config_ui = [];
const plugin_init = async (ctx) => {
  try {
    pluginState.init(ctx);
    ctx.logger.info("SVG 渲染插件初始化中...");
    plugin_config_ui = await buildConfigSchema(ctx);
    registerWebUI(ctx);
    registerApiRoutes(ctx);
    ctx.logger.info("SVG 渲染插件初始化完成");
  } catch (error) {
    ctx.logger.error("SVG 渲染插件初始化失败:", error);
  }
};
const plugin_cleanup = async (ctx) => {
  try {
    pluginState.cleanup();
    ctx.logger.info("SVG 渲染插件已卸载");
  } catch (e) {
    ctx.logger.warn("SVG 渲染插件卸载时出错:", e);
  }
};
const plugin_get_config = async (ctx) => {
  return pluginState.config;
};
const plugin_set_config = async (ctx, config) => {
  pluginState.replaceConfig(config);
  ctx.logger.info("配置已通过 WebUI 更新");
};
const plugin_on_config_change = async (ctx, ui, key, value, currentConfig) => {
  try {
    pluginState.updateConfig({ [key]: value });
    ctx.logger.debug(`配置项 ${key} 已更新`);
  } catch (err) {
    ctx.logger.error(`更新配置项 ${key} 失败:`, err);
  }
};
function registerWebUI(ctx) {
  const router = ctx.router;
  router.static("/static", "webui");
  router.page({
    path: "dashboard",
    title: "SVG 渲染器",
    htmlFile: "webui/index.html",
    description: "SVG 转 PNG 渲染工具"
  });
  ctx.logger.debug("WebUI 路由注册完成");
}

export { plugin_cleanup, plugin_config_ui, plugin_get_config, plugin_init, plugin_on_config_change, plugin_set_config };
