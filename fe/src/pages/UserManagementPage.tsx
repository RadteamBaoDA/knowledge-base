import { useState, useEffect } from 'react';
import { useAuth, User } from '../hooks/useAuth';
import { Dialog } from '../components/Dialog';
import { Shield, Mail, Edit2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function UserManagementPage() {
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [newRole, setNewRole] = useState<'admin' | 'manager' | 'user'>('user');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users`, {
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Failed to fetch users');
            const data = await response.json();
            setUsers(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('userManagement.error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditClick = (user: User) => {
        setSelectedUser(user);
        setNewRole(user.role);
        setIsEditModalOpen(true);
    };

    const handleSaveRole = async () => {
        if (!selectedUser) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${selectedUser.id}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
                credentials: 'include',
            });

            if (!response.ok) throw new Error('Failed to update role');

            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u));
            setIsEditModalOpen(false);
        } catch (err) {
            console.error('Failed to update role:', err);
            // Show error notification (could add toast here)
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-600 p-4">
                {error}
            </div>
        );
    }

    // Only allow admins to see this page content (double check, though route is protected)
    if (currentUser?.role !== 'admin') {
        return (
            <div className="text-center text-slate-600 dark:text-slate-400 p-8">
                {t('userManagement.noPermission')}
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary-600" />
                        {t('userManagement.title')}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('userManagement.description')}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="p-4 text-sm font-medium text-slate-500 dark:text-slate-400">{t('userManagement.user')}</th>
                                <th className="p-4 text-sm font-medium text-slate-500 dark:text-slate-400">{t('userManagement.email')}</th>
                                <th className="p-4 text-sm font-medium text-slate-500 dark:text-slate-400">{t('userManagement.department')}</th>
                                <th className="p-4 text-sm font-medium text-slate-500 dark:text-slate-400">{t('userManagement.role')}</th>
                                <th className="p-4 text-sm font-medium text-slate-500 dark:text-slate-400 text-right">{t('userManagement.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {users.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium text-sm">
                                                {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-slate-900 dark:text-white">{user.displayName || user.email}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-600 dark:text-slate-300">
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-slate-400" />
                                            {user.email}
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-600 dark:text-slate-300">
                                        {user.department || '-'}
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                      ${user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                                user.role === 'manager' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                                    'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleEditClick(user)}
                                            className="p-2 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                                            title={t('userManagement.editRole')}
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title={t('userManagement.editUserRole')}
                footer={
                    <>
                        <button
                            onClick={() => setIsEditModalOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSaveRole}
                            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors"
                        >
                            {t('userManagement.saveChanges')}
                        </button>
                    </>
                }
            >
                <div className="space-y-4 py-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                            {(selectedUser?.displayName || selectedUser?.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-medium text-slate-900 dark:text-white">{selectedUser?.displayName || selectedUser?.email}</div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">{selectedUser?.email}</div>
                            {selectedUser?.job_title && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedUser.job_title}</div>
                            )}
                            {selectedUser?.department && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.department}</div>
                            )}
                            {selectedUser?.mobile_phone && (
                                <div className="text-xs text-slate-500 dark:text-slate-400">{selectedUser.mobile_phone}</div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('userManagement.role')}
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {['admin', 'manager', 'user'].map((role) => (
                                <label
                                    key={role}
                                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all
                    ${newRole === role
                                            ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-600'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                                >
                                    <input
                                        type="radio"
                                        name="role"
                                        value={role}
                                        checked={newRole === role}
                                        onChange={(e) => setNewRole(e.target.value as any)}
                                        className="sr-only"
                                    />
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-900 dark:text-white capitalize">{role}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            {role === 'admin' ? t('userManagement.adminDescription') :
                                                role === 'manager' ? t('userManagement.managerDescription') :
                                                    t('userManagement.userDescription')}
                                        </div>
                                    </div>
                                    {newRole === role && (
                                        <div className="w-2 h-2 rounded-full bg-primary-600 ml-2" />
                                    )}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
