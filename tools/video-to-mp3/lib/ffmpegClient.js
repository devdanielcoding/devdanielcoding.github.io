import { FFmpeg } from "../vendor/ffmpeg/index.js";
import { fetchFile, toBlobURL } from "../vendor/ffmpeg-util/index.js";

let ffmpeg;
let ffmpegReady = false;
let loadingPromise;
let progressHandler = () => {};

export function setProgressHandler(handler) {
  progressHandler = typeof handler === "function" ? handler : () => {};
}

export async function initFFmpeg(onLoadProgress) {
  if (ffmpegReady && ffmpeg) return ffmpeg;
  if (loadingPromise) return loadingPromise;

  if (typeof onLoadProgress === "function") {
    setProgressHandler(onLoadProgress);
  }

  const coreBase = new URL("../vendor/ffmpeg-core/", import.meta.url);
  const coreURL = new URL("ffmpeg-core.js", coreBase).toString();
  const wasmURL = new URL("ffmpeg-core.wasm", coreBase).toString();
  const workerURL = new URL("ffmpeg-core.worker.js", coreBase).toString();

  loadingPromise = (async () => {
    const coreBlob = await toBlobURL(coreURL, "text/javascript");
    const wasmBlob = await toBlobURL(wasmURL, "application/wasm");
    const workerBlob = await toBlobURL(workerURL, "text/javascript");

    ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => progressHandler(progress));

    await ffmpeg.load({
      coreURL: coreBlob,
      wasmURL: wasmBlob,
      workerURL: workerBlob
    });

    ffmpegReady = true;
    return ffmpeg;
  })();

  return loadingPromise;
}

export async function convertVideoToMp3({ file, bitrate, channels }) {
  if (!ffmpeg || !ffmpegReady) {
    throw new Error("FFmpeg no está listo");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const inputName = `input.${extension}`;
  const outputName = "output.mp3";

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  const args = [
    "-i",
    inputName,
    "-vn",
    "-ac",
    channels === "mono" ? "1" : "2",
    "-b:a",
    `${bitrate}k`,
    outputName
  ];

  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile(outputName);
  await safeCleanup([inputName, outputName]);

  return new Blob([data.buffer], { type: "audio/mpeg" });
}

async function safeCleanup(files) {
  if (!ffmpeg) return;

  await Promise.all(
    files.map(async (file) => {
      try {
        await ffmpeg.deleteFile(file);
      } catch (error) {
        console.warn("No se pudo limpiar", file, error);
      }
    })
  );
}
