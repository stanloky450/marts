import { PrismaClient } from '../generated/prisma-client/index.js';

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing Prisma connection...');
    // We don't have a DB yet, but let's see if the client can be instantiated
    console.log('Prisma Client instantiated successfully');
  } catch (error) {
    console.error('Error instantiating Prisma Client:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
