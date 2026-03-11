'use server';

import { fuzzyMatch, getContacts, getAccountCodes, getTrackingOptions } from '@/lib/match/engine';

export async function fuzzyMatchAction(
  project: string,
  unitNo: string,
  description: string,
) {
  return fuzzyMatch(project, unitNo, description);
}

export async function getContactsAction(search?: string) {
  return getContacts(search);
}

export async function getAccountCodesAction() {
  return getAccountCodes();
}

export async function getTrackingOptionsAction() {
  return getTrackingOptions();
}
