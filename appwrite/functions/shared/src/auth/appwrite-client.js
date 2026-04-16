const sdk = require("node-appwrite");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createAdminClient() {
  return new sdk.Client()
    .setEndpoint(requireEnv("APPWRITE_ENDPOINT"))
    .setProject(requireEnv("APPWRITE_PROJECT_ID"))
    .setKey(requireEnv("APPWRITE_API_KEY"));
}

function createJwtClient(jwt) {
  return new sdk.Client()
    .setEndpoint(requireEnv("APPWRITE_ENDPOINT"))
    .setProject(requireEnv("APPWRITE_PROJECT_ID"))
    .setJWT(jwt);
}

module.exports = {
  sdk,
  createAdminClient,
  createJwtClient,
};
