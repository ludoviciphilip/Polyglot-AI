import { describe, it, expect } from 'vitest';
import {
  audioBytesToWavBlob,
  createWavBlob,
  isWavAudio,
  parseSampleRateFromMimeType,
  TTS_SAMPLE_RATE,
} from './audio';

describe('audio utilities', () => {
  it('detects WAV files via RIFF/WAVE header or mimeType', async () => {
    const pcm = new Int16Array([0, 1000, -1000, 500]);
    const wavBlob = createWavBlob(pcm, 24000);
    const wavBytes = new Uint8Array(await wavBlob.arrayBuffer());

    expect(isWavAudio(wavBytes)).toBe(true);
    expect(isWavAudio(new Uint8Array([0, 1, 2, 3]), 'audio/wav')).toBe(true);
    expect(isWavAudio(new Uint8Array([0, 1, 2, 3]), 'audio/L16;codec=pcm;rate=24000')).toBe(false);
  });

  it('writes a valid 44-byte WAV header with exact RIFF chunk size (36 + dataBytes)', async () => {
    const pcm = new Int16Array([10, 20, 30, 40]); // 8 bytes of PCM
    const blob = createWavBlob(pcm, 24000);
    const buf = await blob.arrayBuffer();
    const view = new DataView(buf);

    expect(buf.byteLength).toBe(44 + 8);
    expect(view.getUint32(4, true)).toBe(36 + 8);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint32(40, true)).toBe(8);
  });

  it('does not double-wrap an already valid WAV buffer in audioBytesToWavBlob', async () => {
    const pcm = new Int16Array([100, -100, 200, -200]);
    const originalWav = createWavBlob(pcm, 24000);
    const originalBytes = new Uint8Array(await originalWav.arrayBuffer());

    const resultBlob = audioBytesToWavBlob(originalBytes, 'audio/wav');
    expect(resultBlob.size).toBe(originalBytes.byteLength);
  });

  it('wraps raw PCM bytes with a WAV header using sample rate parsed from mimeType', async () => {
    const rawPcm = new Uint8Array(16); // 8 samples
    const resultBlob = audioBytesToWavBlob(rawPcm, 'audio/L16;codec=pcm;rate=16000');
    const buf = await resultBlob.arrayBuffer();
    const view = new DataView(buf);

    expect(buf.byteLength).toBe(44 + 16);
    expect(view.getUint32(24, true)).toBe(16000);
  });

  it('parses sample rates safely and falls back to default', () => {
    expect(parseSampleRateFromMimeType('audio/L16;codec=pcm;rate=24000')).toBe(24000);
    expect(parseSampleRateFromMimeType('audio/pcm;rate=16000')).toBe(16000);
    expect(parseSampleRateFromMimeType('audio/wav')).toBe(TTS_SAMPLE_RATE);
    expect(parseSampleRateFromMimeType(undefined)).toBe(TTS_SAMPLE_RATE);
  });
});
