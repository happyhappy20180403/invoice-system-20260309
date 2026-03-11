import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export type Role = 'admin' | 'accountant' | 'staff';

/**
 * ロール階層: admin > accountant > staff
 * 各ロールが持つ権限を定義する
 */
const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  admin: new Set([
    'create_invoice',
    'submit_to_xero',
    'manage_users',
    'view_dashboard',
    'batch_upload',
  ]),
  accountant: new Set([
    'create_invoice',
    'submit_to_xero',
    'view_dashboard',
    'batch_upload',
  ]),
  staff: new Set([
    'create_invoice',
  ]),
};

function hasPermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/**
 * DBからユーザーのロールを取得する。
 * 存在しない場合は 'staff' を返す。
 */
export async function getUserRole(email: string): Promise<Role> {
  const result = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (result.length === 0) {
    return 'staff';
  }

  const role = result[0].role as Role;
  if (!['admin', 'accountant', 'staff'].includes(role)) {
    return 'staff';
  }

  return role;
}

/** インボイスを作成できるか (全ロール可) */
export function canCreateInvoice(role: Role): boolean {
  return hasPermission(role, 'create_invoice');
}

/** Xeroへ送信できるか (staff 不可) */
export function canSubmitToXero(role: Role): boolean {
  return hasPermission(role, 'submit_to_xero');
}

/** ユーザー管理ができるか (admin のみ) */
export function canManageUsers(role: Role): boolean {
  return hasPermission(role, 'manage_users');
}

/** ダッシュボードを閲覧できるか (admin, accountant) */
export function canViewDashboard(role: Role): boolean {
  return hasPermission(role, 'view_dashboard');
}

/** バッチアップロードができるか (admin, accountant) */
export function canBatchUpload(role: Role): boolean {
  return hasPermission(role, 'batch_upload');
}
