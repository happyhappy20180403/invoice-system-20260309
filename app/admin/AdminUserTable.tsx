'use client';

import { useState, useTransition } from 'react';
import { updateUserRoleAction, toggleUserActiveAction } from '@/app/actions/admin';

type UserRow = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean | null;
  createdAt: number | null;
};

type Props = {
  users: UserRow[];
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  accountant: 'Accountant',
  staff: 'Staff',
};

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  accountant: 'bg-blue-100 text-blue-800',
  staff: 'bg-gray-100 text-gray-700',
};

export default function AdminUserTable({ users: initialUsers }: Props) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  function handleRoleChange(userId: number, newRole: string) {
    startTransition(async () => {
      const result = await updateUserRoleAction(userId, newRole);
      if (result.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        showMessage('success', 'Role updated successfully.');
      } else {
        showMessage('error', result.error ?? 'Failed to update role.');
      }
    });
  }

  function handleToggleActive(userId: number, currentActive: boolean | null) {
    const newActive = !(currentActive ?? true);
    startTransition(async () => {
      const result = await toggleUserActiveAction(userId, newActive);
      if (result.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isActive: newActive } : u))
        );
        showMessage('success', `User ${newActive ? 'enabled' : 'disabled'} successfully.`);
      } else {
        showMessage('error', result.error ?? 'Failed to update status.');
      }
    });
  }

  return (
    <div>
      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {users.map((user) => (
              <tr key={user.id} className={!user.isActive ? 'opacity-50' : ''}>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{user.name ?? '—'}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      ROLE_BADGE_COLORS[user.role] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      user.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <select
                      value={user.role}
                      disabled={isPending}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="admin">Admin</option>
                      <option value="accountant">Accountant</option>
                      <option value="staff">Staff</option>
                    </select>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                      className={`rounded-md px-3 py-1 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        user.isActive
                          ? 'border border-red-200 text-red-600 hover:bg-red-50'
                          : 'border border-green-200 text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {user.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
