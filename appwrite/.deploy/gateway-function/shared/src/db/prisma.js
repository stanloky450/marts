const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis;
const prisma = globalForPrisma.__appwritePrisma || new PrismaClient();

if (!globalForPrisma.__appwritePrisma) {
  globalForPrisma.__appwritePrisma = prisma;
}

module.exports = {
  prisma,
};
