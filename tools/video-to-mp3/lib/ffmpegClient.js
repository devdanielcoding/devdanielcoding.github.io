import { FFmpeg } from "https://unpkg.com/@ffmpeg/ffmpeg@0.12.6/dist/esm/index.js";
import { fetchFile, toBlobURL } from "https://unpkg.com/@ffmpeg/util@0.12.6/dist/esm/index.js";

let ffmpegInstance;
let ffmpegReady = false;
let loadingPromise;
let progressHandler = () => {};

export function setProgressHandler(handler) {
  progressHandler = typeof handler === "function" ? handler : () => {};
}

export async function initFFmpeg() {
  if (ffmpegReady && ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  const ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress }) => {
    progressHandler(progress);
  });

  loadingPromise = (async () => {
    const coreURL = await toBlobURL(
      "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
      "text/javascript"
    );
    const wasmURL = await toBlobURL(
      "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
      "application/wasm"
    );

    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegInstance = ffmpeg;
    ffmpegReady = true;
    return ffmpegInstance;
  })();

  return loadingPromise;
}

export async function convertVideoToMp3({ file, bitrate, channels }) {
  if (!ffmpegInstance || !ffmpegReady) {
    throw new Error("FFmpeg no está listo");
  }

  const inputName = `input-${Date.now()}`;
  const outputName = `output-${Date.now()}.mp3`;

  await ffmpegInstance.writeFile(inputName, await fetchFile(file));
  const args = [
    "-i",
    inputName,
    "-vn",
    "-acodec",
    "libmp3lame",
    "-b:a",
    bitrate,
    "-ac",
    String(channels),
    outputName
  ];

  await ffmpegInstance.exec(args);

  const data = await ffmpegInstance.readFile(outputName);
  await safeCleanup([inputName, outputName]);

  return new Blob([data.buffer], { type: "audio/mpeg" });
}

async function safeCleanup(files) {
  if (!ffmpegInstance) return;
  await Promise.all(
    files.map(async (file) => {
      try {
        await ffmpegInstance.deleteFile(file);
      } catch (error) {
        console.warn("No se pudo limpiar", file, error);
      }
    })
  );
}
