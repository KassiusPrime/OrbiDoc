// Canonical Nexus AI compatibility surface.
// The implementation lives in nexusFreeAI.ts. This file intentionally contains
// no provider SDKs, paid model integrations, or model selector.
import { complete, stream, MODELS, type NexusBody, type NexusMeta, type NexusResult } from './nexusFreeAI.js';

export const NEXUS_FREE_MODELS = MODELS;

export function assertFreeModel(model: string): void {
  if (model === 'openrouter/free') return;
  if (model.endsWith(':free') && NEXUS_FREE_MODELS.includes(model as typeof NEXUS_FREE_MODELS[number])) return;
  if (/^(openai|anthropic|google|gemini|groq)\//i.test(model)) throw new Error(`PAID_MODEL_FORBIDDEN: ${model}`);
  throw new Error(`MODEL_NOT_ALLOWLISTED: ${model}`);
}

export class CircuitBreaker {
  private failures = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private openedAt = 0;
  private probeInFlight = false;
  constructor(private readonly model: string, private readonly options: { failureThreshold?: number; openDurationMs?: number } = {}) { assertFreeModel(model); }
  begin() {
    const state = this.getState();
    if (state === 'OPEN') throw new Error('CIRCUIT_OPEN');
    if (state === 'HALF_OPEN') this.probeInFlight = true;
  }
  success() { this.failures = 0; this.state = 'CLOSED'; this.openedAt = 0; this.probeInFlight = false; }
  failure() { this.probeInFlight = false; this.failures += 1; if (this.failures >= (this.options.failureThreshold ?? 3)) { this.state = 'OPEN'; this.openedAt = Date.now(); } }
  getState(now = Date.now()) { if (this.state === 'OPEN' && now - this.openedAt >= (this.options.openDurationMs ?? 30_000)) this.state = 'HALF_OPEN'; return this.state; }
}

export { complete, stream };
export type { NexusBody, NexusMeta, NexusResult };

export class NexusAIClient {
  async complete(body: NexusBody, _signal?: AbortSignal): Promise<NexusResult> { return complete(body); }
  async stream(body: NexusBody, onChunk: (chunk: string) => void, onMeta: (meta: NexusMeta) => void, _signal?: AbortSignal): Promise<void> { return stream(body, onChunk, onMeta); }
}

export const nexusAI = new NexusAIClient();
