import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { canManageUsers } from '@/lib/rbac';
import type { Role } from '@/lib/rbac';
import { listUsersAction } from '@/app/actions/admin';
import AdminUserTable from './AdminUserTable';

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = (session as any).role as Role ?? 'staff';
  if (!canManageUsers(role)) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-xl font-semibold text-red-700">Access Denied</h1>
          <p className="mt-2 text-sm text-red-600">
            This page requires admin privileges.
          </p>
          <a
            href="/"
            className="mt-4 inline-block rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            Return to Home
          </a>
        </div>
      </main>
    );
  }

  const { users } = await listUsersAction();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-gray-500">
            Manage roles and access for all users
          </p>
        </div>
        <a
          href="/"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm transition hover:bg-gray-100"
        >
          Back to Home
        </a>
      </header>

      <AdminUserTable users={users ?? []} />
    </main>
  );
}
