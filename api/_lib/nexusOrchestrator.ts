import { nexusAI, type NexusBody, type NexusClientMeta, type NexusMessage, type NexusResult } from './nexusAI.js';

/** Nexus remains one assistant while several internal free models collaborate. */
export type NexusCollaborationMode = 'auto' | 'single' | 'team';

export type NexusOrchestratedResult = NexusResult & {
  orchestrated: boolean;
  agentsUsed: number;
};

const TEAM_THRESHOLD = 900;
const MAX_TEAM_AGENTS = 3;

function lastUserText(messages: NexusMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return messages[i]?.content ?? '';
  }
  return '';
}

function shouldUseTeam(body: NexusBody, messages: NexusMessage[]): boolean {
  const mode = (body as NexusBody & { collaboration?: unknown }).collaboration;
  if (mode === 'single') return false;
  if (mode === 'team') return true;
  const text = lastUserText(messages);
  if (text.length >= TEAM_THRESHOLD) return true;
  return /\b(compare|comparação|arquitetura|projeto|implemente|implementação|debug|depure|analise|análise|pesquisa|planeje|planejamento|estratégia|código|refatore|refatoração|documentação|revisão|review|prós|contras|alternativas|passo a passo)\b/i.test(text);
}

function messagesOf(body: NexusBody): NexusMessage[] {
  if (!Array.isArray(body.messages)) throw new Error('Nexus AI recebeu uma conversa inválida.');
  return body.messages as NexusMessage[];
}

function specialistPrompt(role: string): string {
  return [
    'Você é um especialista interno do Nexus AI.',
    `Sua função nesta rodada é: ${role}`,
    'Analise a solicitação de forma independente.',
    'Entregue fatos, decisões, riscos e recomendações úteis para outro agente sintetizar.',
  ].join(' ');
}

const SPECIALISTS = [
  { role: 'analista crítico: encontre requisitos, ambiguidades, riscos e fatos que precisam ser preservados.', hint: 'análise profunda e comparação' },
  { role: 'especialista técnico: pense em implementação, arquitetura, código, consistência e possíveis falhas.', hint: 'arquitetura e código' },
  { role: 'revisor: procure alternativas, contradições e uma solução final simples, prática e verificável.', hint: 'revisão e estratégia' },
] as const;

function synthesisPrompt(reports: string[]): string {
  return [
    'Você é o sintetizador final do Nexus AI.',
    'Vários especialistas analisaram a mesma solicitação. Use os relatórios abaixo como material interno.',
    'Concilie divergências, descarte sugestões frágeis e produza uma única resposta coerente.',
    'Não mencione agentes, modelos, relatórios internos ou orquestração ao usuário.',
    'Não invente informações ausentes. Se houver incerteza real, declare-a de forma objetiva.',
    '',
    'RELATÓRIOS INTERNOS:',
    reports.map((report, index) => `--- Especialista ${index + 1} ---\n${report}`).join('\n\n'),
  ].join('\n');
}

function withSystem(body: NexusBody, systemPrompt: string): NexusBody {
  return { ...body, systemPrompt, collaboration: 'single' } as NexusBody & { collaboration: 'single' };
}

export class NexusOrchestrator {
  async complete(body: NexusBody, signal?: AbortSignal): Promise<NexusOrchestratedResult> {
    const messages = messagesOf(body);
    if (!shouldUseTeam(body, messages)) {
      const result = await nexusAI.complete(body, signal);
      return { ...result, orchestrated: false, agentsUsed: 1 };
    }

    const reports = await Promise.all(
      SPECIALISTS.map(async ({ role, hint }) => {
        const result = await nexusAI.complete(withSystem({ ...body, taskHint: hint }, specialistPrompt(role)), signal);
        return result.answer;
      }),
    );

    const finalBody = withSystem(
      {
        ...body,
        messages: [...messages, { role: 'user', content: 'Produza a resposta final usando os relatórios internos fornecidos pelo sistema.' }],
        maxOutputTokens: body.maxOutputTokens ?? 4096,
      },
      synthesisPrompt(reports),
    );
    const result = await nexusAI.complete(finalBody, signal);
    return { ...result, orchestrated: true, agentsUsed: MAX_TEAM_AGENTS + 1 };
  }

  async stream(
    body: NexusBody,
    onChunk: (chunk: string) => void,
    onMeta: (meta: NexusClientMeta) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const messages = messagesOf(body);
    if (!shouldUseTeam(body, messages)) {
      await nexusAI.stream(body, onChunk, onMeta, signal);
      return;
    }

    const reports = await Promise.all(
      SPECIALISTS.map(async ({ role, hint }) => {
        const result = await nexusAI.complete(withSystem({ ...body, taskHint: hint }, specialistPrompt(role)), signal);
        return result.answer;
      }),
    );

    const finalBody = withSystem(
      {
        ...body,
        messages: [...messages, { role: 'user', content: 'Produza a resposta final usando os relatórios internos fornecidos pelo sistema.' }],
        maxOutputTokens: body.maxOutputTokens ?? 4096,
      },
      synthesisPrompt(reports),
    );
    await nexusAI.stream(finalBody, onChunk, onMeta, signal);
  }
}

export const nexusOrchestrator = new NexusOrchestrator();
