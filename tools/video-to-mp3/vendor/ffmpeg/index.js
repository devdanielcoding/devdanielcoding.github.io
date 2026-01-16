export class FFmpeg {
  constructor() {
    this.handlers = new Map();
  }

  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(handler);
  }

  async load() {
    throw new Error(
      "FFmpeg no está disponible. Debes vendorizar @ffmpeg/ffmpeg y @ffmpeg/core en /tools/video-to-mp3/vendor/."
    );
  }

  async writeFile() {
    throw new Error("FFmpeg no está cargado");
  }

  async exec() {
    throw new Error("FFmpeg no está cargado");
  }

  async readFile() {
    throw new Error("FFmpeg no está cargado");
  }

  async deleteFile() {
    return undefined;
  }
}
