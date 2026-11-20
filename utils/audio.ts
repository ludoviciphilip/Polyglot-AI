import { GoogleGenAI, Modality } from "@google/genai";
import { StoryResponse } from "../types";

export const TTS_MODEL = "gemini-3.8-flash-lite-tts";
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
  const buffer = new ArrayBuffer(44 + pcmData.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 32 + pcmData.length * 2, true);
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
  view.setUint32(40, pcmData.length * 2, true);

  let offset = 44;
  for (let i = 0; i < pcmData.length; i++, offset += 2) {
    view.setInt16(offset, pcmData[i], true);
  }

  return new Blob([buffer], { type: "audio/wav" });
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

export async function fetchGeminiTtsBase64(text: string, customApiKey?: string): Promise<string> {
  const apiKey = customApiKey?.trim() || "";
  if (!apiKey) {
    throw new Error("API key not configured");
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("No text provided for audio generation");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ parts: [{ text: trimmed }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
      },
    },
  });

  const base64Data = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!base64Data) {
    throw new Error("No audio data returned");
  }
  return base64Data;
}

export async function playPcmBase64(base64Data: string): Promise<void> {
  stopAllAudio();
  const audioBytes = decodeBase64(base64Data);
  const audioCtx = getSharedAudioContext();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
  const buffer = await decodeAudioData(audioBytes, audioCtx, TTS_SAMPLE_RATE);
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
  const base64Data = await fetchGeminiTtsBase64(text, customApiKey);
  await playPcmBase64(base64Data);
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
  const base64Data = await fetchGeminiTtsBase64(fullText, customApiKey);
  await playPcmBase64(base64Data);
}

export async function downloadFullStoryAudio(
  story: StoryResponse,
  _targetLanguage: string,
  customApiKey?: string
): Promise<void> {
  const fullText = getStoryFullText(story);
  const base64Data = await fetchGeminiTtsBase64(fullText, customApiKey);
  const audioBytes = decodeBase64(base64Data);
  const pcmData = new Int16Array(audioBytes.buffer, audioBytes.byteOffset, Math.floor(audioBytes.byteLength / 2));
  const blob = createWavBlob(pcmData, TTS_SAMPLE_RATE);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(story.story_title || "story").replace(/\s+/g, "_")}_full_audio.wav`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
