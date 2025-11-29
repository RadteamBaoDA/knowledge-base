import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from './logger.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SystemTool {
    id: string;
    name: string;
    description: string;
    icon: string;
    url: string;
    order: number;
    enabled: boolean;
}

interface SystemToolsConfig {
    tools: SystemTool[];
}

class SystemToolsService {
    private tools: SystemTool[] = [];
    private configPath: string;

    constructor() {
        this.configPath = path.join(__dirname, '../config/system-tools.config.json');
        this.loadConfig();
    }

    /**
     * Load system tools configuration from JSON file
     */
    private loadConfig(): void {
        try {
            if (!fs.existsSync(this.configPath)) {
                log.warn('System tools config file not found', { path: this.configPath });
                this.tools = [];
                return;
            }

            const configData = fs.readFileSync(this.configPath, 'utf-8');
            const config: SystemToolsConfig = JSON.parse(configData);

            if (!config.tools || !Array.isArray(config.tools)) {
                log.error('Invalid system tools config format');
                this.tools = [];
                return;
            }

            this.tools = config.tools;
            log.info('System tools configuration loaded', { count: this.tools.length });
        } catch (error) {
            log.error('Failed to load system tools config', {
                error: error instanceof Error ? error.message : String(error),
            });
            this.tools = [];
        }
    }

    /**
     * Get all enabled system tools, sorted by order
     */
    getEnabledTools(): SystemTool[] {
        return this.tools
            .filter(tool => tool.enabled)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get all system tools (including disabled)
     */
    getAllTools(): SystemTool[] {
        return [...this.tools].sort((a, b) => a.order - b.order);
    }

    /**
     * Reload configuration from file
     */
    reload(): void {
        log.info('Reloading system tools configuration');
        this.loadConfig();
    }
}

// Export singleton instance
export const systemToolsService = new SystemToolsService();
