import { Langfuse } from 'langfuse';
import { config } from '../config/index.js';

let langfuseClient: Langfuse | null = null;

export function getLangfuseClient(): Langfuse {
  if (!langfuseClient) {
    langfuseClient = new Langfuse({
      secretKey: config.langfuse.secretKey,
      publicKey: config.langfuse.publicKey,
      baseUrl: config.langfuse.baseUrl,
    });
  }
  return langfuseClient;
}

export interface ChatLogInput {
  userId: string;
  sessionId: string;
  traceId: string;
  userPrompt: string;
  aiResponse: string;
  metadata?: Record<string, unknown>;
}

export interface SearchLogInput {
  userId: string;
  sessionId: string;
  traceId: string;
  query: string;
  results: unknown[];
  metadata?: Record<string, unknown>;
}

/**
 * Log a chat interaction to Langfuse
 */
export async function logChatInteraction(input: ChatLogInput): Promise<void> {
  const langfuse = getLangfuseClient();
  
  const trace = langfuse.trace({
    id: input.traceId,
    name: 'ai-chat',
    userId: input.userId,
    sessionId: input.sessionId,
    metadata: input.metadata,
  });

  trace.generation({
    name: 'chat-completion',
    input: input.userPrompt,
    output: input.aiResponse,
    model: 'ragflow',
  });

  await langfuse.flushAsync();
}

/**
 * Log a search interaction to Langfuse
 */
export async function logSearchInteraction(input: SearchLogInput): Promise<void> {
  const langfuse = getLangfuseClient();
  
  const trace = langfuse.trace({
    id: input.traceId,
    name: 'ai-search',
    userId: input.userId,
    sessionId: input.sessionId,
    metadata: input.metadata,
  });

  trace.span({
    name: 'search-query',
    input: input.query,
    output: input.results,
  });

  await langfuse.flushAsync();
}

/**
 * Shutdown Langfuse client gracefully
 */
export async function shutdownLangfuse(): Promise<void> {
  if (langfuseClient) {
    await langfuseClient.shutdownAsync();
    langfuseClient = null;
  }
}
