import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  
  ragflow: {
    aiChat: process.env['RAGFLOW_AI_CHAT'] ?? 'http://localhost:9380/chat',
    aiSearch: process.env['RAGFLOW_AI_SEARCH'] ?? 'http://localhost:9380/search',
    apiKey: process.env['RAGFLOW_API_KEY'] ?? '',
  },
  
  langfuse: {
    secretKey: process.env['LANGFUSE_SECRET_KEY'] ?? '',
    publicKey: process.env['LANGFUSE_PUBLIC_KEY'] ?? '',
    baseUrl: process.env['LANGFUSE_BASE_URL'] ?? 'https://cloud.langfuse.com',
  },
  
  azureAd: {
    clientId: process.env['AZURE_AD_CLIENT_ID'] ?? '',
    clientSecret: process.env['AZURE_AD_CLIENT_SECRET'] ?? '',
    tenantId: process.env['AZURE_AD_TENANT_ID'] ?? '',
    redirectUri: process.env['AZURE_AD_REDIRECT_URI'] ?? 'http://localhost:3001/auth/callback',
  },
  
  session: {
    secret: process.env['SESSION_SECRET'] ?? 'change-me-in-production',
  },
  
  frontendUrl: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
} as const;

export type Config = typeof config;
