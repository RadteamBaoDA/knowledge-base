/**
 * Application configuration
 * Handles environment variables and feature flags
 */

// Helper to parse boolean env vars
const getBoolEnv = (key: string, defaultValue: boolean): boolean => {
    const value = import.meta.env[key];
    if (value === 'true') return true;
    if (value === 'false') return false;
    return defaultValue;
};

export const config = {
    features: {
        enableAiChat: getBoolEnv('VITE_ENABLE_AI_CHAT', true),
        enableAiSearch: getBoolEnv('VITE_ENABLE_AI_SEARCH', true),
        enableHistory: getBoolEnv('VITE_ENABLE_HISTORY', true),
    },
};
