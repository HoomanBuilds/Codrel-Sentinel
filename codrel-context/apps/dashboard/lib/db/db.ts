import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "./schema"; 

// eslint-disable-next-line turbo/no-undeclared-env-vars
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

export default db