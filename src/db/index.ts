import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({
    path: './.env',
    debug: true,
})

const DB_URL = process.env.DATABASE_URL

const sql = neon(DB_URL!);

export async function getPgVersion() {
    const result = await sql`SELECT version()`;
    console.log("postgres connected", result[0]);
}
