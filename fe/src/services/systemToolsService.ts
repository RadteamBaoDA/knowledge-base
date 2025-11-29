const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export interface SystemTool {
    id: string;
    name: string;
    description: string;
    icon: string;
    url: string;
    order: number;
    enabled: boolean;
}

export interface SystemToolsResponse {
    tools: SystemTool[];
    count: number;
}

/**
 * Fetch all enabled system monitoring tools
 */
export const getSystemTools = async (): Promise<SystemTool[]> => {
    const response = await fetch(`${API_BASE_URL}/api/system-tools`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch system tools: ${response.statusText}`);
    }

    const data: SystemToolsResponse = await response.json();
    return data.tools;
};

/**
 * Reload system tools configuration (admin only)
 */
export const reloadSystemTools = async (): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/system-tools/reload`, {
        method: 'POST',
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to reload system tools: ${response.statusText}`);
    }
};
