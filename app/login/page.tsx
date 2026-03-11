import { signIn } from '@/lib/auth';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">Invoice Auto-Input</h1>
          <p className="mt-2 text-gray-500">
            Connect your Xero account to get started
          </p>
        </div>

        <form
          action={async () => {
            'use server';
            await signIn('xero', { redirectTo: '/' });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg bg-[#13B5EA] px-6 py-3 text-lg font-semibold text-white transition hover:bg-[#0d9bc5] focus:outline-none focus:ring-4 focus:ring-blue-200"
          >
            Connect to Xero
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Johor Bahru Property Management System
        </p>
      </div>
    </div>
  );
}
