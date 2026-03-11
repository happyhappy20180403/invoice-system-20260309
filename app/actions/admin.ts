'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { canManageUsers } from '@/lib/rbac';
import type { Role } from '@/lib/rbac';
import { z } from 'zod';

const RoleSchema = z.enum(['admin', 'accountant', 'staff']);

/** 呼び出し元が admin かどうかを確認する共通ガード */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error('Unauthorized');
  }
  const role = (session as any).role as Role ?? 'staff';
  if (!canManageUsers(role)) {
    throw new Error('Forbidden: admin role required');
  }
  return session;
}

/** ユーザー一覧を取得する */
export async function listUsersAction() {
  await requireAdmin();

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);

  return { success: true, users: result };
}

/** ユーザーのロールを変更する */
export async function updateUserRoleAction(userId: number, newRole: string) {
  await requireAdmin();

  const parsed = RoleSchema.safeParse(newRole);
  if (!parsed.success) {
    return { success: false, error: 'Invalid role. Must be admin, accountant, or staff.' };
  }

  try {
    await db
      .update(users)
      .set({ role: parsed.data, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error('Failed to update user role:', error);
    return { success: false, error: String(error) };
  }
}

/** ユーザーの有効/無効を切り替える */
export async function toggleUserActiveAction(userId: number, isActive: boolean) {
  await requireAdmin();

  try {
    await db
      .update(users)
      .set({ isActive, updatedAt: Math.floor(Date.now() / 1000) })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    console.error('Failed to toggle user active status:', error);
    return { success: false, error: String(error) };
  }
}
