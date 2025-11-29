/**
 * @fileoverview System monitoring tools service.
 * 
 * This module manages the configuration for system monitoring tools
 * that are displayed to administrators. Tools are configured via a
 * JSON file and can be enabled/disabled without code changes.
 * 
 * Configuration file: be/src/config/system-tools.config.json
 * 
 * Each tool has:
 * - Unique ID for referencing
 * - Display name and description
 * - Icon for UI display
 * - External URL to open when clicked
 * - Order for sorting in UI
 * - Enabled flag for show/hide control
 * 
 * @module services/system-tools
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from './logger.service.js';

/** ESM-compatible __dirname resolution */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents a system monitoring tool configuration.
 */
export interface SystemTool {
    /** Unique tool identifier */
    id: string;
    /** Display name in UI */
    name: string;
    /** Tool description/purpose */
    description: string;
    /** Icon name or path for UI display */
    icon: string;
    /** External URL to the tool */
    url: string;
    /** Sort order (lower = first) */
    order: number;
    /** Whether tool is shown in UI */
    enabled: boolean;
}

/**
 * Configuration file structure.
 */
interface SystemToolsConfig {
    /** Array of tool configurations */
    tools: SystemTool[];
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

/**
 * Service for managing system monitoring tools.
 * Loads tool configurations from a JSON file and provides
 * methods to query enabled tools.
 */
class SystemToolsService {
    /** Loaded tool configurations */
    private tools: SystemTool[] = [];
    /** Path to the configuration file */
    private configPath: string;

    /**
     * Creates a new SystemToolsService and loads configuration.
     */
    constructor() {
        this.configPath = path.join(__dirname, '../config/system-tools.config.json');
        this.loadConfig();
    }

    /**
     * Load system tools configuration from JSON file.
     * Called on startup and when reload() is invoked.
     */
    private loadConfig(): void {
        try {
            // Check if config file exists
            if (!fs.existsSync(this.configPath)) {
                log.warn('System tools config file not found', { path: this.configPath });
                this.tools = [];
                return;
            }

            // Read and parse JSON configuration
            const configData = fs.readFileSync(this.configPath, 'utf-8');
            const config: SystemToolsConfig = JSON.parse(configData);

            // Validate config structure
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
     * Get all enabled system tools, sorted by order.
     * Used by the frontend to display available tools.
     * 
     * @returns Array of enabled tools sorted by order property
     */
    getEnabledTools(): SystemTool[] {
        return this.tools
            .filter(tool => tool.enabled)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get all system tools including disabled ones.
     * Useful for admin configuration interfaces.
     * 
     * @returns Array of all tools sorted by order
     */
    getAllTools(): SystemTool[] {
        return [...this.tools].sort((a, b) => a.order - b.order);
    }

    /**
     * Reload configuration from file.
     * Call this after modifying the config file to apply changes
     * without restarting the server.
     */
    reload(): void {
        log.info('Reloading system tools configuration');
        this.loadConfig();
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

/** Singleton service instance */
export const systemToolsService = new SystemToolsService();
