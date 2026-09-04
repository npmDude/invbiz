import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL!,
    ssl: process.env.DATABASE_SSL === 'true',
  },
});

export type Database = typeof db;
