const prismaRepo = require("./product.repository.prisma");
const appwriteRepo = require("./product.repository.appwrite");

function getRepository() {
  return (process.env.DATA_PROVIDER || "prisma") === "appwrite" ? appwriteRepo : prismaRepo;
}

module.exports = {
  getProductRepository: getRepository,
};
