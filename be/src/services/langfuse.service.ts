import { Langfuse } from 'langfuse';
import { config } from '../config/index.js';
import { log } from './logger.service.js';

let langfuseClient: Langfuse | null = null;

/**
 * Get or create Langfuse client
 */
export function getLangfuseClient(): Langfuse {
  if (!langfuseClient) {
    log.debug('Initializing Langfuse client', { baseUrl: config.langfuse.baseUrl });
    langfuseClient = new Langfuse({
      secretKey: config.langfuse.secretKey,
      publicKey: config.langfuse.publicKey,
      baseUrl: config.langfuse.baseUrl,
    });
  }
  return langfuseClient;
}

/**
 * Shutdown Langfuse client gracefully
 */
export async function shutdownLangfuse(): Promise<void> {
  if (langfuseClient) {
    log.info('Shutting down Langfuse client');
    await langfuseClient.shutdownAsync();
    langfuseClient = null;
  }
}
