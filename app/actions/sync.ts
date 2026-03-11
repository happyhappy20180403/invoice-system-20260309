'use server';

import { auth } from '@/lib/auth';
import { getXeroContacts, getXeroAccountCodes, getXeroTrackingCategories } from '@/lib/xero/xero-service';
import { db } from '@/lib/db';
import { contactsCache, accountCodeMappings } from '@/lib/db/schema';

export async function syncContactsAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const xeroUserId = (session as any).xeroUserId;
  const contacts = await getXeroContacts(xeroUserId);

  for (const c of contacts) {
    db.insert(contactsCache)
      .values({
        contactId: c.ContactID,
        contactName: c.Name,
        emailAddress: c.EmailAddress ?? '',
        isCustomer: c.IsCustomer ?? false,
      })
      .onConflictDoUpdate({
        target: contactsCache.contactId,
        set: {
          contactName: c.Name,
          emailAddress: c.EmailAddress ?? '',
          isCustomer: c.IsCustomer ?? false,
        },
      })
      .run();
  }

  return { success: true, count: contacts.length };
}

export async function syncAccountCodesAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const xeroUserId = (session as any).xeroUserId;
  const accounts = await getXeroAccountCodes(xeroUserId);

  for (const a of accounts) {
    db.insert(accountCodeMappings)
      .values({
        code: a.Code,
        name: a.Name,
        description: a.Description ?? '',
        taxType: a.TaxType ?? '',
        accountType: a.Type ?? '',
      })
      .onConflictDoUpdate({
        target: accountCodeMappings.code,
        set: {
          name: a.Name,
          description: a.Description ?? '',
          taxType: a.TaxType ?? '',
          accountType: a.Type ?? '',
        },
      })
      .run();
  }

  return { success: true, count: accounts.length };
}

export async function getTrackingCategoriesAction() {
  const session = await auth();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const xeroUserId = (session as any).xeroUserId;
  const categories = await getXeroTrackingCategories(xeroUserId);
  return { success: true, categories };
}
