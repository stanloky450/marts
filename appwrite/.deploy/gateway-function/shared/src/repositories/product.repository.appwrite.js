const { Query, Databases, ID } = require("node-appwrite");
const { createAdminClient } = require("../auth/appwrite-client");

function getDatabases() {
  return new Databases(createAdminClient());
}

function productsCollection() {
  return {
    databaseId: process.env.APPWRITE_DATABASE_ID,
    collectionId: process.env.APPWRITE_PRODUCTS_COLLECTION_ID,
  };
}

async function listProducts({ filters, pagination }) {
  const { databaseId, collectionId } = productsCollection();
  const databases = getDatabases();
  const queries = [
    Query.limit(pagination.limit),
    Query.offset(pagination.skip),
    Query.orderDesc("$createdAt"),
  ];

  if (filters.status) queries.push(Query.equal("status", [filters.status]));
  if (filters.category) queries.push(Query.equal("categoryMongoId", [filters.category]));
  if (filters.vendor) queries.push(Query.equal("vendorMongoId", [filters.vendor]));
  if (filters.region) queries.push(Query.equal("region", [filters.region]));
  if (filters.search) queries.push(Query.search("name", filters.search));

  const response = await databases.listDocuments(databaseId, collectionId, queries);
  return {
    products: response.documents,
    total: response.total,
  };
}

async function findDocument(id) {
  const { databaseId, collectionId } = productsCollection();
  const databases = getDatabases();

  try {
    return await databases.getDocument(databaseId, collectionId, id);
  } catch {
    const response = await databases.listDocuments(databaseId, collectionId, [
      Query.equal("mongoId", [id]),
      Query.limit(1),
    ]);
    return response.documents[0] || null;
  }
}

async function getProductById(id) {
  return findDocument(id);
}

async function createProduct(data) {
  const { databaseId, collectionId } = productsCollection();
  return getDatabases().createDocument(databaseId, collectionId, ID.unique(), data);
}

async function updateProductByDbId(id, data) {
  const { databaseId, collectionId } = productsCollection();
  const existing = await findDocument(id);
  if (!existing) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    error.code = "PRODUCT_NOT_FOUND";
    throw error;
  }

  return getDatabases().updateDocument(databaseId, collectionId, existing.$id, data);
}

async function deleteProductByDbId(id) {
  const { databaseId, collectionId } = productsCollection();
  const existing = await findDocument(id);
  if (!existing) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    error.code = "PRODUCT_NOT_FOUND";
    throw error;
  }

  return getDatabases().deleteDocument(databaseId, collectionId, existing.$id);
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProductByDbId,
  deleteProductByDbId,
};
