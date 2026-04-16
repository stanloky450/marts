// standalone-test.js
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- STANDALONE PRISMA TEST ---');

try {
    const prismaPath = path.resolve(__dirname, '../generated/prisma-client/index.js');
    console.log('Targeting Prisma client at:', prismaPath);
    
    const { PrismaClient } = require(prismaPath);
    const prisma = new PrismaClient();
    
    console.log('PrismaClient instance created successfully.');
    
    // Test if model keys are present (doesn't connect to DB)
    const models = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
    console.log('Models found in client:', models);
    
    process.exit(0);
} catch (error) {
    console.error('FAILED Standalone Test:', error);
    process.exit(1);
}
