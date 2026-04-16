import crypto from "crypto"

export const generateRandomString = (length = 32) => {
  return crypto.randomBytes(length).toString("hex")
}

export const generateReferralCode = () => {
  return `REF${crypto.randomBytes(4).toString("hex").toUpperCase()}`
}

export const generateSKU = (prefix = "SKU") => {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = crypto.randomBytes(3).toString("hex").toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export const verifyPaystackSignature = (payload, signature, secret) => {
  const hash = crypto.createHmac("sha512", secret).update(JSON.stringify(payload)).digest("hex")
  return hash === signature
}
