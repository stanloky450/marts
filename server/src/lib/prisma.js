import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('../../generated/prisma-client/index.js');

const { Pool } = pg;

const globalForPrisma = globalThis;

console.log("Loading Prisma... DATABASE_URL is:", process.env.DATABASE_URL);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

