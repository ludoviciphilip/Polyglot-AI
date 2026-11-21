import { GoogleGenAI, Modality } from "@google/genai";
import { StoryResponse } from "../types";

export const TTS_MODEL_CHAIN: readonly string[] = [
  "gemini-3.8-flash-lite-tts",
  "gemini-3.8-flash-tts",
  "gemini-2.5-flash-preview-tts",
];
export const TTS_MODEL = TTS_MODEL_CHAIN[0];
export const TTS_SAMPLE_RATE = 24000;

export const TTS_LANG_MAP: Record<string, string> = {
  English: "en-US",
  "Shakespearean English": "en-GB",
  Spanish: "es-ES",
  Portuguese: "pt-BR",
  French: "fr-FR",
  German: "de-DE",
  Italian: "it-IT",
  Japanese: "ja-JP",
  Chinese: "zh-CN",
  Russian: "ru-RU",
  Latin: "la",
  "Modern Greek": "el-GR",
  "Ancient Greek": "el-GR",
};

export interface GeminiTtsAudioResult {
  data: string;
  mimeType: string;
  modelUsed: string;
}

let sharedAudioContext: AudioContext | null = null;
let activeAudioSource: AudioBufferSourceNode | null = null;

function getSharedAudioContext(): AudioContext {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextClass({ sampleRate: TTS_SAMPLE_RATE });
  }
  return sharedAudioContext;
}

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function isWavAudio(bytes: Uint8Array, mimeType?: string): boolean {
  if (bytes.byteLength >= 12) {
    const isRiff =
      bytes[0] === 0x52 && // R
      bytes[1] === 0x49 && // I
      bytes[2] === 0x46 && // F
      bytes[3] === 0x46;   // F
    const isWave =
      bytes[8] === 0x57 && // W
      bytes[9] === 0x41 && // A
      bytes[10] === 0x56 && // V
      bytes[11] === 0x45;   // E
    if (isRiff && isWave) return true;
  }
  return typeof mimeType === "string" && /audio\/(x-)?wav/i.test(mimeType);
}

export function parseSampleRateFromMimeType(mimeType?: string): number {
  if (!mimeType) return TTS_SAMPLE_RATE;
  const match = mimeType.match(/rate=(\d+)/i);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed >= 8000 && parsed <= 96000) {
      return parsed;
    }
  }
  return TTS_SAMPLE_RATE;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = TTS_SAMPLE_RATE
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2));
  const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

export function createWavBlob(pcmData: Int16Array, sampleRate: number = TTS_SAMPLE_RATE): Blob {
  const dataByteLength = pcmData.length * 2;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataByteLength, true);

  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function audioBytesToWavBlob(audioBytes: Uint8Array, mimeType?: string): Blob {
  if (isWavAudio(audioBytes, mimeType)) {
    // Unary Gemini 3.8 TTS already returns a complete RIFF/WAVE file
    const copy = new Uint8Array(audioBytes.byteLength);
    copy.set(audioBytes);
    return new Blob([copy], { type: "audio/wav" });
  }
  const pcmData = new Int16Array(
    audioBytes.buffer,
    audioBytes.byteOffset,
    Math.floor(audioBytes.byteLength / 2)
  );
  return createWavBlob(pcmData, parseSampleRateFromMimeType(mimeType));
}

export function stopAllAudio(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (activeAudioSource) {
    try {
      activeAudioSource.stop();
    } catch {
      // Ignore if playback has already ended
    }
    try {
      activeAudioSource.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    activeAudioSource = null;
  }
}

export function speakWithBrowser(text: string, lang: string, rate: number = 0.9): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const trimmed = text.trim();
  if (!trimmed) return;
  stopAllAudio();
  const utterance = new SpeechSynthesisUtterance(trimmed);
  utterance.lang = TTS_LANG_MAP[lang] || "en-US";
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

function isAuthError(err: any): boolean {
  const code = Number(err?.status ?? err?.code);
  const msg = String(err?.message || "");
  return (
    code === 401 ||
    code === 403 ||
    /API_KEY_INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg)
  );
}

export async function fetchGeminiTtsAudio(
  text: string,
  customApiKey?: string
): Promise<GeminiTtsAudioResult> {
  const apiKey = customApiKey?.trim() || "";
  if (!apiKey) {
    throw new Error("API key not configured");
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("No text provided for audio generation");
  }

  // speechConfig and TTS models require v1beta on the Gemini Developer API
  // (@google/genai v3+ defaults to v1 where generation_config.speechConfig is rejected)
  const ai = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

  let lastError: unknown = null;
  for (const model of TTS_MODEL_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: trimmed }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
        },
      });

      const inlineData = response.candidates?.[0]?.content?.parts?.find(
        (p) => p.inlineData?.data
      )?.inlineData;
      if (!inlineData?.data) {
        throw new Error(`No audio data returned by ${model}`);
      }

      return {
        data: inlineData.data,
        mimeType: inlineData.mimeType || "audio/L16;codec=pcm;rate=24000",
        modelUsed: model,
      };
    } catch (err: any) {
      lastError = err;
      if (isAuthError(err)) {
        throw err;
      }
      console.warn(`[TTS] Model ${model} failed, trying fallback if available:`, err?.message || err);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to generate audio");
}

export async function fetchGeminiTtsBase64(text: string, customApiKey?: string): Promise<string> {
  const result = await fetchGeminiTtsAudio(text, customApiKey);
  return result.data;
}

export async function playPcmBase64(base64Data: string, mimeType?: string): Promise<void> {
  stopAllAudio();
  const audioBytes = decodeBase64(base64Data);
  const audioCtx = getSharedAudioContext();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  let buffer: AudioBuffer;
  const isEncodedContainer =
    isWavAudio(audioBytes, mimeType) ||
    (typeof mimeType === "string" && /audio\/(mpeg|mp3|ogg|webm|mp4|aac|flac)/i.test(mimeType));

  if (isEncodedContainer) {
    // Copy into a standalone ArrayBuffer because Web Audio decodeAudioData detaches its buffer
    const copy = new Uint8Array(audioBytes.byteLength);
    copy.set(audioBytes);
    buffer = await audioCtx.decodeAudioData(copy.buffer);
  } else {
    buffer = await decodeAudioData(audioBytes, audioCtx, parseSampleRateFromMimeType(mimeType));
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  activeAudioSource = source;
  source.onended = () => {
    if (activeAudioSource === source) {
      activeAudioSource = null;
    }
  };
  source.start();
}

export async function playNaturalAudio(text: string, customApiKey?: string): Promise<void> {
  const { data, mimeType } = await fetchGeminiTtsAudio(text, customApiKey);
  await playPcmBase64(data, mimeType);
}

const getStoryFullText = (story: StoryResponse): string => {
  const sentences = Array.isArray(story?.sentences) ? story.sentences : [];
  if (sentences.length === 0) {
    throw new Error("Story contains no sentences.");
  }
  return sentences
    .map((s) => s.original)
    .filter(Boolean)
    .join(" ")
    .trim();
};

export async function playFullStoryAudio(
  story: StoryResponse,
  _targetLanguage: string,
  customApiKey?: string
): Promise<void> {
  const fullText = getStoryFullText(story);
  const { data, mimeType } = await fetchGeminiTtsAudio(fullText, customApiKey);
  await playPcmBase64(data, mimeType);
}

export async function downloadFullStoryAudio(
  story: StoryResponse,
  _targetLanguage: string,
  customApiKey?: string
): Promise<void> {
  const fullText = getStoryFullText(story);
  const { data, mimeType } = await fetchGeminiTtsAudio(fullText, customApiKey);
  const audioBytes = decodeBase64(data);
  const blob = audioBytesToWavBlob(audioBytes, mimeType);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(story.story_title || "story").replace(/\s+/g, "_")}_full_audio.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
