import prisma from './lib/prisma.js';

async function test() {
  try {
    console.log('Testing Prisma connection...');
    // Just checking if the client instance is correctly created and has models
    const models = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
    console.log('Initialized Prisma Client with models:', models);
    
    if (models.length > 0) {
      console.log('SUCCESS: Prisma Client is correctly initialized.');
    } else {
      console.warn('WARNING: Prisma Client initialized but no models found.');
    }
    process.exit(0);
  } catch (error) {
    console.error('Prisma Import/Init Failed:', error);
    process.exit(1);
  }
}

test();
