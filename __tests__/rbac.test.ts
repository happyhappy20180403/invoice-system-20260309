import { describe, it, expect } from 'vitest';
import {
  canCreateInvoice,
  canSubmitToXero,
  canManageUsers,
  canViewDashboard,
  canBatchUpload,
} from '../lib/rbac';
import type { Role } from '../lib/rbac';

describe('RBAC Permission Matrix', () => {
  const roles: Role[] = ['admin', 'accountant', 'staff'];

  describe('canCreateInvoice', () => {
    it('should allow all roles to create invoices', () => {
      for (const role of roles) {
        expect(canCreateInvoice(role)).toBe(true);
      }
    });
  });

  describe('canSubmitToXero', () => {
    it('should allow admin and accountant', () => {
      expect(canSubmitToXero('admin')).toBe(true);
      expect(canSubmitToXero('accountant')).toBe(true);
    });
    it('should deny staff', () => {
      expect(canSubmitToXero('staff')).toBe(false);
    });
  });

  describe('canManageUsers', () => {
    it('should allow only admin', () => {
      expect(canManageUsers('admin')).toBe(true);
    });
    it('should deny accountant and staff', () => {
      expect(canManageUsers('accountant')).toBe(false);
      expect(canManageUsers('staff')).toBe(false);
    });
  });

  describe('canViewDashboard', () => {
    it('should allow admin and accountant', () => {
      expect(canViewDashboard('admin')).toBe(true);
      expect(canViewDashboard('accountant')).toBe(true);
    });
    it('should deny staff', () => {
      expect(canViewDashboard('staff')).toBe(false);
    });
  });

  describe('canBatchUpload', () => {
    it('should allow admin and accountant', () => {
      expect(canBatchUpload('admin')).toBe(true);
      expect(canBatchUpload('accountant')).toBe(true);
    });
    it('should deny staff', () => {
      expect(canBatchUpload('staff')).toBe(false);
    });
  });
});
