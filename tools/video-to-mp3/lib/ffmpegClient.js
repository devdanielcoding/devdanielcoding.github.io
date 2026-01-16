const CDNS = [
  {
    name: "jsdelivr",
    base: "https://cdn.jsdelivr.net/npm"
  },
  {
    name: "jsdelivr-fastly",
    base: "https://fastly.jsdelivr.net/npm"
  }
];

const FFMPEG_VERSION = "0.12.6";

let FFmpegClass;
let fetchFile;
let toBlobURL;
let activeCdn;

let ffmpegInstance;
let ffmpegReady = false;
let loadingPromise;
let progressHandler = () => {};

async function loadFFmpegModules() {
  if (FFmpegClass && fetchFile && toBlobURL && activeCdn) return;

  const errors = [];

  for (const cdn of CDNS) {
    const ffmpegUrl = `${cdn.base}/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/index.js`;
    const utilUrl = `${cdn.base}/@ffmpeg/util@${FFMPEG_VERSION}/dist/esm/index.js`;

    try {
      const [ffmpegModule, utilModule] = await Promise.all([
        import(ffmpegUrl),
        import(utilUrl)
      ]);

      FFmpegClass = ffmpegModule.FFmpeg;
      fetchFile = utilModule.fetchFile;
      toBlobURL = utilModule.toBlobURL;
      activeCdn = cdn;
      return;
    } catch (error) {
      errors.push({ cdn: cdn.name, error });
    }
  }

  const error = new Error("No se pudieron cargar los módulos de FFmpeg.");
  error.details = errors;
  throw error;
}

function getCoreBaseUrl() {
  if (!activeCdn) {
    throw new Error("CDN de FFmpeg no disponible.");
  }
  return `${activeCdn.base}/@ffmpeg/core@${FFMPEG_VERSION}/dist/esm`;
}

export function setProgressHandler(handler) {
  progressHandler = typeof handler === "function" ? handler : () => {};
}

export async function initFFmpeg() {
  if (ffmpegReady && ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  await loadFFmpegModules();

  const ffmpeg = new FFmpegClass();
  ffmpeg.on("progress", ({ progress }) => {
    progressHandler(progress);
  });

  loadingPromise = (async () => {
    const coreBase = getCoreBaseUrl();
    const coreURL = await toBlobURL(
      `${coreBase}/ffmpeg-core.js`,
      "text/javascript"
    );
    const wasmURL = await toBlobURL(
      `${coreBase}/ffmpeg-core.wasm`,
      "application/wasm"
    );
    const workerURL = await toBlobURL(
      `${coreBase}/ffmpeg-core.worker.js`,
      "text/javascript"
    );

    await ffmpeg.load({ coreURL, wasmURL, workerURL });
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

  if (!fetchFile) {
    throw new Error("Dependencias de FFmpeg no disponibles");
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
