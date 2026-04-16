const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  VENDOR: "vendor",
};

const PRODUCT_STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const PAYMENT_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
};

module.exports = {
  USER_ROLES,
  PRODUCT_STATUS,
  PAYMENT_STATUS,
};
