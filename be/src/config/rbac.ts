export type Role = 'admin' | 'manager' | 'user';

export type Permission =
    | 'view_chat'
    | 'view_search'
    | 'view_history'
    | 'manage_users'
    | 'manage_system'
    | 'view_analytics'
    | 'storage:write';

export const DEFAULT_ROLE: Role = 'user';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    admin: [
        'view_chat',
        'view_search',
        'view_history',
        'manage_users',
        'manage_system',
        'view_analytics',
        'storage:write',
    ],
    manager: [
        'view_chat',
        'view_search',
        'view_history',
        'manage_users', // Managers can view/edit users but maybe restricted (logic in service)
        'view_analytics',
        'storage:write',
    ],
    user: [
        'view_chat',
        'view_search',
        'view_history',
    ],
};

export const hasPermission = (userRole: string, permission: Permission): boolean => {
    const role = userRole as Role;
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
};
