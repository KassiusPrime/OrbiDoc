import { orbitApiUrl } from '../lib/orbitApiOrigin';

export type VoicePlaybackFormat = 'mp3' | 'wav' | 'opus' | 'flac';

export interface VoiceSpeechOptions {
  voice?: string;
  model?: string;
  speed?: number;
  responseFormat?: VoicePlaybackFormat;
  instructions?: string;
}

const MAX_TTS_CHARS = 9000;

export function splitTextForSpeech(text: string, maxChars = MAX_TTS_CHARS): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    const boundary = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('? '),
      window.lastIndexOf('! '),
      window.lastIndexOf('; '),
      window.lastIndexOf(', '),
      window.lastIndexOf(' '),
    );
    const cut = boundary >= Math.floor(maxChars * 0.6) ? boundary + 1 : maxChars;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks.filter(Boolean);
}

export async function synthesizeSpeech(text: string, options: VoiceSpeechOptions = {}, signal?: AbortSignal): Promise<Blob> {
  if (!text.trim()) throw new Error('Não há texto para leitura.');
  const response = await fetch(orbitApiUrl('/api/voice/speech'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: options.voice,
      model: options.model,
      speed: options.speed,
      instructions: options.instructions,
      response_format: options.responseFormat || 'mp3',
      stream_format: 'audio',
    }),
    signal,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = 'Não foi possível gerar a leitura.';
    try {
      const parsed = JSON.parse(body) as { error?: unknown };
      if (typeof parsed.error === 'string') message = parsed.error;
    } catch { /* non-JSON error */ }
    throw new Error(message);
  }
  return response.blob();
}

export async function voiceStatus(signal?: AbortSignal): Promise<{ available: boolean; capabilities?: Record<string, boolean> }> {
  const response = await fetch(orbitApiUrl('/api/voice/status'), { signal, cache: 'no-store' });
  if (!response.ok) return { available: false };
  const data = await response.json() as { available?: unknown; capabilities?: Record<string, boolean> };
  return { available: data.available === true, capabilities: data.capabilities };
}
