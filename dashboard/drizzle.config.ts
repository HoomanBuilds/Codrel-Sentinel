import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './src/lib/db',
  schema: './src/lib/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});