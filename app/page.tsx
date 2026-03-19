import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import InvoiceDashboard from './components/InvoiceDashboard';

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <main className="mx-auto max-w-full px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoice Auto-Input</h1>
          <p className="text-sm text-gray-500">
            Logged in as {session.user.name ?? session.user.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/help"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm transition hover:bg-gray-100"
          >
            Help
          </Link>
          <form
            action={async () => {
              'use server';
              const { signOut } = await import('@/lib/auth');
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm transition hover:bg-gray-100"
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>
      <InvoiceDashboard />
    </main>
  );
}
