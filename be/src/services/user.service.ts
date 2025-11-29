import { query, queryOne } from '../db/index.js';
import { config } from '../config/index.js';
import { log } from './logger.service.js';
import { AzureAdUser } from './auth.service.js';

export interface User {
    id: string;
    email: string;
    display_name: string;
    role: 'admin' | 'manager' | 'user';
    permissions: string[]; // JSON string in DB
    department?: string | null;
    job_title?: string | null;
    mobile_phone?: string | null;
    created_at: string;
    updated_at: string;
}

export class UserService {
    /**
     * Initialize root user if database is empty
     */
    async initializeRootUser(): Promise<void> {
        try {
            // Check if any users exist
            const existingUsers = await queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');

            if (existingUsers && Number(existingUsers.count) > 0) {
                log.info('Users exist, skipping root user initialization');
                return;
            }

            const rootUserEmail = process.env['KB_ROOT_USER'] || 'admin@localhost';
            const rootUserPassword = process.env['KB_ROOT_PASSWORD'] || 'admin'; // Note: Password auth not fully implemented yet, this is for reference/future use

            log.info('Initializing root user', { email: rootUserEmail });

            // Create root user
            await query(
                `INSERT INTO users (id, email, display_name, role, permissions)
         VALUES ($1, $2, $3, $4, $5)`,
                [
                    'root-user',
                    rootUserEmail,
                    'System Administrator',
                    'admin',
                    JSON.stringify(['*']),
                ]
            );

            log.info('Root user initialized successfully');
        } catch (error) {
            log.error('Failed to initialize root user', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Find or create user from Azure AD profile
     */
    async findOrCreateUser(adUser: AzureAdUser): Promise<User> {
        try {
            // Check if user exists by ID or Email
            // This handles cases where we want to link by ID (like root-user) even if email changed
            const existingUser = await queryOne<User>(
                'SELECT * FROM users WHERE id = $1 OR email = $2',
                [adUser.id, adUser.email]
            );

            if (existingUser) {
                let needsUpdate = false;
                const updates: any[] = [];
                const values: any[] = [];
                let paramIndex = 1;

                // Helper to add update
                const addUpdate = (field: string, value: any) => {
                    updates.push(`${field} = $${paramIndex++}`);
                    values.push(value);
                    needsUpdate = true;
                };

                // Update display name if changed
                if (existingUser.display_name !== adUser.displayName) {
                    addUpdate('display_name', adUser.displayName);
                    existingUser.display_name = adUser.displayName;
                }

                // Update email if changed
                if (existingUser.email !== adUser.email) {
                    addUpdate('email', adUser.email);
                    existingUser.email = adUser.email;
                }

                // Update department if changed
                if (existingUser.department !== (adUser.department || null)) {
                    const newVal = adUser.department || null;
                    addUpdate('department', newVal);
                    existingUser.department = newVal;
                }

                // Update job_title if changed
                if (existingUser.job_title !== (adUser.jobTitle || null)) {
                    const newVal = adUser.jobTitle || null;
                    addUpdate('job_title', newVal);
                    existingUser.job_title = newVal;
                }

                // Update mobile_phone if changed
                if (existingUser.mobile_phone !== (adUser.mobilePhone || null)) {
                    const newVal = adUser.mobilePhone || null;
                    addUpdate('mobile_phone', newVal);
                    existingUser.mobile_phone = newVal;
                }

                if (needsUpdate) {
                    addUpdate('updated_at', new Date().toISOString());
                    values.push(existingUser.id); // Add ID for WHERE clause

                    await query(
                        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
                        values
                    );
                }

                // Parse permissions if string
                if (typeof existingUser.permissions === 'string') {
                    existingUser.permissions = JSON.parse(existingUser.permissions);
                }

                return existingUser;
            }

            // Create new user
            log.info('Creating new user from Azure AD', { email: adUser.email });

            const newUser: User = {
                id: adUser.id,
                email: adUser.email,
                display_name: adUser.displayName,
                role: 'user', // Default role
                permissions: [],
                department: adUser.department || null,
                job_title: adUser.jobTitle || null,
                mobile_phone: adUser.mobilePhone || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            await query(
                `INSERT INTO users (id, email, display_name, role, permissions, department, job_title, mobile_phone, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    newUser.id,
                    newUser.email,
                    newUser.display_name,
                    newUser.role,
                    JSON.stringify(newUser.permissions),
                    newUser.department,
                    newUser.job_title,
                    newUser.mobile_phone,
                    newUser.created_at,
                    newUser.updated_at,
                ]
            );

            return newUser;
        } catch (error) {
            log.error('Failed to find or create user', {
                error: error instanceof Error ? error.message : String(error),
                email: adUser.email
            });
            throw error;
        }
    }

    /**
     * Get all users (for admin management)
     */
    async getAllUsers(): Promise<User[]> {
        const users = await query<User>('SELECT * FROM users ORDER BY created_at DESC');

        // Parse permissions
        return users.map(user => ({
            ...user,
            permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions,
        }));
    }

    /**
     * Update user role
     */
    async updateUserRole(userId: string, role: 'admin' | 'manager' | 'user'): Promise<User | undefined> {
        await query(
            'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2',
            [role, userId]
        );

        const updatedUser = await queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);

        if (updatedUser && typeof updatedUser.permissions === 'string') {
            updatedUser.permissions = JSON.parse(updatedUser.permissions);
        }

        return updatedUser;
    }
}

export const userService = new UserService();
