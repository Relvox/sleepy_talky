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
export async function initFFmpeg(onProgress = null) {
  if (ffmpeg) return ffmpeg;

  // If already loading, wait for existing load to complete
  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = (async () => {
    try {
      ffmpeg = new FFmpeg();

      // Optional progress logging
      if (onProgress) {
        ffmpeg.on("log", ({ message }) => {
          console.log("[FFmpeg]", message);
        });
        ffmpeg.on("progress", ({ progress, time }) => {
          onProgress(`FFmpeg processing: ${(progress * 100).toFixed(1)}%`);
        });
      }

      // Use local files to avoid CORS issues
      const baseURL = "/libs/ffmpeg";

      onProgress?.("Loading FFmpeg WASM (~30MB, first time only)...");

      console.log(
        "[FFmpeg] Fetching core.js from:",
        `${baseURL}/ffmpeg-core.js`,
      );
      const coreURL = await toBlobURL(
        `${baseURL}/ffmpeg-core.js`,
        "text/javascript",
      );
      console.log("[FFmpeg] Core.js blob URL created:", coreURL);

      console.log(
        "[FFmpeg] Fetching wasm from:",
        `${baseURL}/ffmpeg-core.wasm`,
      );
      const wasmURL = await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
      );
      console.log("[FFmpeg] Wasm blob URL created:", wasmURL);

      console.log("[FFmpeg] Calling ffmpeg.load() with timeout...");

      // Add timeout to detect hanging
      const loadPromise = ffmpeg.load({
        coreURL,
        wasmURL,
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error("FFmpeg load timeout after 30s")),
          30000,
        );
      });

      await Promise.race([loadPromise, timeoutPromise]);
      console.log("[FFmpeg] ffmpeg.load() completed");

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
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<Blob>} WAV audio blob of the extracted chunk
 */
export async function extractAudioChunk(
  audioBlob,
  startSeconds,
  durationSeconds,
  onProgress = null,
) {
  const ffmpeg = await initFFmpeg(onProgress);

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
    onProgress?.(
      `Writing ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB to FFmpeg...`,
    );

    // Write input file to FFmpeg's virtual filesystem
    await ffmpeg.writeFile(inputFileName, await fetchFile(audioBlob));

    onProgress?.(`Extracting ${durationSeconds}s from ${startSeconds}s...`);

    // Extract chunk and convert to WAV
    // -ss: seek to start position
    // -t: duration to extract
    // -acodec pcm_f32le: 32-bit float PCM (native Web Audio format)
    // -ar 48000: 48kHz sample rate (standard for web audio)
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

    onProgress?.("Reading extracted chunk...");

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
export async function getAudioDuration(audioBlob, onProgress = null) {
  const ffmpeg = await initFFmpeg(onProgress);

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
