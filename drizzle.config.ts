import { defineConfig } from 'drizzle-kit';

const isLocal = !process.env.TURSO_DATABASE_URL;

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: isLocal
    ? { url: 'file:data/invoice.db' }
    : {
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN!,
      },
});
