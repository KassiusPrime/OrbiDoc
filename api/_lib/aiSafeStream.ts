import { streamChat as streamChatWithFallback } from './ai.js';

/**
 * Preserves live streaming while preventing a partial response from one provider
 * from being concatenated with a fallback provider response.
 *
 * The underlying router may switch providers if the first one fails. That is safe
 * before content starts. Once content has reached the client, a provider switch is
 * suppressed and the partial answer is closed with an explicit warning instead.
 */
export async function streamChatSafely(body: any, write: (payload: object) => void) {
  let activeProvider = '';
  let contentStarted = false;
  let suppressFallback = false;
  let warned = false;

  return streamChatWithFallback(body, (payload: any) => {
    const nextProvider = typeof payload?.meta?.provider === 'string' ? payload.meta.provider : '';

    if (nextProvider && activeProvider && nextProvider !== activeProvider && contentStarted) {
      suppressFallback = true;
      if (!warned) {
        warned = true;
        write({
          chunk: '\n\n> ⚠️ A conexão com o modelo foi interrompida depois que a resposta começou. O OrbiDoc não misturou a saída de outro provedor. Tente regenerar a resposta para obter um resultado completo.',
        });
        write({
          meta: {
            ...payload.meta,
            provider: activeProvider,
            fallbackUsed: false,
            fallbackReason: 'Fallback bloqueado porque a resposta do provedor original já havia começado.',
          },
        });
      }
      return;
    }

    if (suppressFallback) return;
    if (nextProvider) activeProvider = nextProvider;
    if (typeof payload?.chunk === 'string' && payload.chunk.length) contentStarted = true;
    write(payload);
  });
}
