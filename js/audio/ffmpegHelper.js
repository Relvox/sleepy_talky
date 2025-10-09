// FFmpeg loaded globally via UMD script tags
const { FFmpeg } = window.FFmpegWASM;
const { toBlobURL, fetchFile } = window.FFmpegUtil;

let ffmpeg = null;
let isLoading = false;
let loadPromise = null;

/**
 * Initialize FFmpeg instance (singleton pattern)
 * Downloads ~30MB of WASM files on first call
 */
export async function initFFmpeg() {
  if (ffmpeg) return ffmpeg;

  // If already loading, wait for existing load to complete
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = (async () => {
    try {
      ffmpeg = new FFmpeg();

      // Load core files from CDN (saves ~33MB from local hosting)
      // toBlobURL bypasses CORS restrictions by converting to blob URLs
      const baseURL =
        "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";

      // onProgress?.("Loading FFmpeg WASM (~30MB, first time only)...");

      const coreURL = await toBlobURL(
        `${baseURL}/ffmpeg-core.js`,
        "text/javascript",
      );
      const wasmURL = await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      );

      // Load with timeout to detect hanging
      const loadPromise = ffmpeg.load({ coreURL, wasmURL });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("FFmpeg load timeout after 30s")),
          30000,
        );
      });

      await Promise.race([loadPromise, timeoutPromise]);
      console.log("[FFmpeg] Loaded successfully");
      return ffmpeg;
    } catch (error) {
      console.error("[FFmpeg] Load failed:", error);
      ffmpeg = null;
      throw error;
    } finally {
      isLoading = false;
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * Extract a specific time range from an audio file
 *
 * @param {Blob} audioBlob - Source audio file (any format)
 * @param {number} startSeconds - Start time in seconds
 * @param {number} durationSeconds - Duration to extract in seconds
 * @returns {Promise<Blob>} WAV audio blob of the extracted chunk
 */
export async function extractAudioChunk(
  audioBlob,
  startSeconds,
  durationSeconds,
) {
  const ffmpeg = await initFFmpeg();

  // Determine input format from blob type
  const mimeType = audioBlob.type || "audio/mp4";
  const extension = mimeType.includes("webm")
    ? "webm"
    : mimeType.includes("mpeg")
      ? "mp3"
      : mimeType.includes("wav")
        ? "wav"
        : "m4a";

  const inputFileName = `input.${extension}`;
  const outputFileName = "output.wav";

  try {
    // Write input file to FFmpeg's virtual filesystem
    await ffmpeg.writeFile(inputFileName, await fetchFile(audioBlob));

    // Extract chunk and convert to WAV
    // -ss: seek to start position, -t: duration, -acodec: 32-bit float PCM
    await ffmpeg.exec([
      "-ss",
      startSeconds.toString(),
      "-i",
      inputFileName,
      "-t",
      durationSeconds.toString(),
      "-acodec",
      "pcm_f32le",
      "-ar",
      "48000",
      "-f",
      "wav",
      outputFileName,
    ]);

    // Read output file
    const data = await ffmpeg.readFile(outputFileName);

    // Cleanup virtual filesystem
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    return new Blob([data.buffer], { type: "audio/wav" });
  } catch (error) {
    // Cleanup on error
    try {
      await ffmpeg.deleteFile(inputFileName).catch(() => {});
      await ffmpeg.deleteFile(outputFileName).catch(() => {});
    } catch {}

    throw new Error(`FFmpeg extraction failed: ${error.message}`);
  }
}

/**
 * Get audio file duration without full decode
 * Useful for determining total chunks needed
 *
 * @param {Blob} audioBlob - Source audio file
 * @returns {Promise<number>} Duration in seconds
 */
export async function getAudioDuration(audioBlob) {
  const ffmpeg = await initFFmpeg();

  const mimeType = audioBlob.type || "audio/mp4";
  const extension = mimeType.includes("webm")
    ? "webm"
    : mimeType.includes("mpeg")
      ? "mp3"
      : mimeType.includes("wav")
        ? "wav"
        : "m4a";

  const inputFileName = `probe.${extension}`;

  try {
    await ffmpeg.writeFile(inputFileName, await fetchFile(audioBlob));

    // Use ffprobe-like command to get duration
    let duration = null;

    // Capture log output to extract duration
    const logHandler = ({ message }) => {
      const match = message.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = parseFloat(match[3]);
        duration = hours * 3600 + minutes * 60 + seconds;
      }
    };

    ffmpeg.on("log", logHandler);

    await ffmpeg.exec(["-i", inputFileName]);

    ffmpeg.off("log", logHandler);

    await ffmpeg.deleteFile(inputFileName);

    return duration;
  } catch (error) {
    // FFmpeg returns error when just probing, but logs contain duration
    try {
      await ffmpeg.deleteFile(inputFileName).catch(() => {});
    } catch {}

    // If we captured duration from logs, return it despite "error"
    if (duration !== null) {
      return duration;
    }

    throw new Error(`Failed to get audio duration: ${error.message}`);
  }
}
