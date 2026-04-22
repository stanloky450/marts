const crypto = require("crypto");
const { prisma } = require("../db/prisma");
const { requireRole } = require("../auth/guard");
const { sendSuccess, sendError } = require("../http/response");
const { USER_ROLES } = require("../constants");

const CHAT_PREFIX = "chat:thread:";
const EDIT_WINDOW_MS = 2 * 60 * 1000;
const CHAT_FEATURE_KEY = "feature_chat_enabled";

const nowIso = () => new Date().toISOString();
const toMs = (value) => new Date(value).getTime();
const normalize = (value) => String(value || "").trim();

function makeMongoId() {
  return crypto.randomBytes(12).toString("hex");
}

const threadKey = (vendorMongoId, marketUserId) => `${CHAT_PREFIX}${vendorMongoId}:${marketUserId}`;

function buildThread({ vendorMongoId, marketUserId, marketUserName, marketUserEmail }) {
  const ts = nowIso();
  return {
    vendorMongoId,
    marketUserId,
    marketUserName: marketUserName || "Market User",
    marketUserEmail: marketUserEmail || "",
    messages: [],
    userLastReadAt: ts,
    vendorLastReadAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
}

async function getFeatureEnabled() {
  const setting = await prisma.setting.findUnique({ where: { key: CHAT_FEATURE_KEY } });
  if (!setting) return true;
  return setting.value !== false;
}

async function ensureChatEnabled(res) {
  const enabled = await getFeatureEnabled();
  if (!enabled) {
    sendError(res, 403, "FEATURE_DISABLED", "Chat is currently disabled");
    return false;
  }
  return true;
}

function getMarketUserFromHeaders(ctx) {
  const marketUserId = normalize(ctx.headers["x-market-user-id"]);
  const marketUserName = normalize(ctx.headers["x-market-user-name"]);
  const marketUserEmail = normalize(ctx.headers["x-market-user-email"]);
  if (!marketUserId) return null;
  return { marketUserId, marketUserName, marketUserEmail };
}

async function getVendorForAuthUser(actorMongoId) {
  return prisma.vendor.findFirst({
    where: { ownerMongoId: actorMongoId },
    select: { mongoId: true, businessName: true, subdomain: true, logoUrl: true },
  });
}

function getThreadFromSetting(setting) {
  const value = setting?.value;
  if (!value || typeof value !== "object") return null;
  return value;
}

async function saveThread(vendorMongoId, marketUserId, thread) {
  await prisma.setting.upsert({
    where: { key: threadKey(vendorMongoId, marketUserId) },
    update: { value: thread },
    create: { mongoId: makeMongoId(), key: threadKey(vendorMongoId, marketUserId), value: thread },
  });
}

async function getAllThreads() {
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: CHAT_PREFIX } },
    orderBy: { updatedAt: "desc" },
  });
  return rows
    .map((row) => ({ key: row.key, thread: getThreadFromSetting(row) }))
    .filter((item) => !!item.thread);
}

function computeUnread(thread, receiver) {
  const lastReadAt = receiver === "vendor" ? thread.vendorLastReadAt : thread.userLastReadAt;
  const lastMs = lastReadAt ? toMs(lastReadAt) : 0;
  return (thread.messages || []).filter((m) => {
    if (m.deletedAt) return false;
    if (receiver === "vendor" && m.senderType !== "user") return false;
    if (receiver === "user" && m.senderType !== "vendor") return false;
    return toMs(m.createdAt) > lastMs;
  }).length;
}

async function mapThreadSummary(thread, receiver) {
  const lastMessage = (thread.messages || [])[thread.messages.length - 1] || null;
  const vendor = await prisma.vendor.findFirst({
    where: { mongoId: thread.vendorMongoId },
    select: { mongoId: true, businessName: true, subdomain: true, logoUrl: true },
  });

  return {
    vendor,
    marketUserId: thread.marketUserId,
    marketUserName: thread.marketUserName,
    marketUserEmail: thread.marketUserEmail,
    updatedAt: thread.updatedAt,
    lastMessage,
    unreadCount: computeUnread(thread, receiver),
  };
}

async function getUserThreads({ ctx, res }) {
  if (!(await ensureChatEnabled(res))) return;
  const marketUser = getMarketUserFromHeaders(ctx);
  if (!marketUser) return sendError(res, 401, "UNAUTHORIZED", "Market user headers are required");

  const all = await getAllThreads();
  const mine = all.filter((item) => item.thread.marketUserId === marketUser.marketUserId);
  const mapped = await Promise.all(mine.map((item) => mapThreadSummary(item.thread, "user")));
  const unreadTotal = mapped.reduce((acc, cur) => acc + (cur.unreadCount || 0), 0);
  return sendSuccess(res, { threads: mapped, unreadTotal });
}

async function getUserThreadByVendor({ ctx, res }) {
  if (!(await ensureChatEnabled(res))) return;
  const marketUser = getMarketUserFromHeaders(ctx);
  if (!marketUser) return sendError(res, 401, "UNAUTHORIZED", "Market user headers are required");

  const vendorMongoId = normalize(ctx.params.vendorMongoId);
  if (!vendorMongoId) return sendError(res, 400, "INVALID_VENDOR", "vendorMongoId is required");

  const setting = await prisma.setting.findUnique({
    where: { key: threadKey(vendorMongoId, marketUser.marketUserId) },
  });

  const thread = getThreadFromSetting(setting) || buildThread({ vendorMongoId, ...marketUser });
  return sendSuccess(res, thread);
}

async function sendUserMessage({ ctx, res }) {
  if (!(await ensureChatEnabled(res))) return;
  const marketUser = getMarketUserFromHeaders(ctx);
  if (!marketUser) return sendError(res, 401, "UNAUTHORIZED", "Market user headers are required");

  const vendorMongoId = normalize(ctx.params.vendorMongoId);
  const text = normalize(ctx.body?.text);
  if (!text) return sendError(res, 400, "INVALID_MESSAGE", "Message text is required");

  const setting = await prisma.setting.findUnique({
    where: { key: threadKey(vendorMongoId, marketUser.marketUserId) },
  });
  const thread = getThreadFromSetting(setting) || buildThread({ vendorMongoId, ...marketUser });

  const ts = nowIso();
  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    senderType: "user",
    senderId: marketUser.marketUserId,
    text,
    createdAt: ts,
    updatedAt: ts,
    edited: false,
    deletedAt: null,
  };

  thread.messages = [...(thread.messages || []), message];
  thread.userLastReadAt = ts;
  thread.updatedAt = ts;
  thread.marketUserName = marketUser.marketUserName || thread.marketUserName;
  thread.marketUserEmail = marketUser.marketUserEmail || thread.marketUserEmail;

  await saveThread(vendorMongoId, marketUser.marketUserId, thread);
  return sendSuccess(res, message, null, 201);
}

async function editUserMessage({ ctx, res }) {
  if (!(await ensureChatEnabled(res))) return;
  const marketUser = getMarketUserFromHeaders(ctx);
  if (!marketUser) return sendError(res, 401, "UNAUTHORIZED", "Market user headers are required");

  const vendorMongoId = normalize(ctx.params.vendorMongoId);
  const messageId = normalize(ctx.params.messageId);
  const text = normalize(ctx.body?.text);
  if (!text) return sendError(res, 400, "INVALID_MESSAGE", "Message text is required");

  const setting = await prisma.setting.findUnique({
    where: { key: threadKey(vendorMongoId, marketUser.marketUserId) },
  });
  const thread = getThreadFromSetting(setting);
  if (!thread) return sendError(res, 404, "THREAD_NOT_FOUND", "Thread not found");

  const idx = (thread.messages || []).findIndex((m) => m.id === messageId);
  if (idx < 0) return sendError(res, 404, "MESSAGE_NOT_FOUND", "Message not found");

  const msg = thread.messages[idx];
  if (msg.senderType !== "user" || msg.senderId !== marketUser.marketUserId) {
    return sendError(res, 403, "FORBIDDEN", "Cannot edit this message");
  }
  if (Date.now() - toMs(msg.createdAt) > EDIT_WINDOW_MS) {
    return sendError(res, 403, "EDIT_WINDOW_EXPIRED", "Edit window has expired");
  }

  thread.messages[idx] = { ...msg, text, edited: true, updatedAt: nowIso() };
  thread.updatedAt = nowIso();
  await saveThread(vendorMongoId, marketUser.marketUserId, thread);
  return sendSuccess(res, thread.messages[idx]);
}

async function deleteUserMessage({ ctx, res }) {
  if (!(await ensureChatEnabled(res))) return;
  const marketUser = getMarketUserFromHeaders(ctx);
  if (!marketUser) return sendError(res, 401, "UNAUTHORIZED", "Market user headers are required");

  const vendorMongoId = normalize(ctx.params.vendorMongoId);
  const messageId = normalize(ctx.params.messageId);

  const setting = await prisma.setting.findUnique({
    where: { key: threadKey(vendorMongoId, marketUser.marketUserId) },
  });
  const thread = getThreadFromSetting(setting);
  if (!thread) return sendError(res, 404, "THREAD_NOT_FOUND", "Thread not found");

  const idx = (thread.messages || []).findIndex((m) => m.id === messageId);
  if (idx < 0) return sendError(res, 404, "MESSAGE_NOT_FOUND", "Message not found");
  const msg = thread.messages[idx];
  if (msg.senderType !== "user" || msg.senderId !== marketUser.marketUserId) {
    return sendError(res, 403, "FORBIDDEN", "Cannot delete this message");
  }
  if (Date.now() - toMs(msg.createdAt) > EDIT_WINDOW_MS) {
    return sendError(res, 403, "DELETE_WINDOW_EXPIRED", "Delete window has expired");
  }

  thread.messages[idx] = { ...msg, text: "", deletedAt: nowIso(), updatedAt: nowIso() };
  thread.updatedAt = nowIso();
  await saveThread(vendorMongoId, marketUser.marketUserId, thread);
  return sendSuccess(res, { id: messageId });
}

async function markUserThreadRead({ ctx, res }) {
  if (!(await ensureChatEnabled(res))) return;
  const marketUser = getMarketUserFromHeaders(ctx);
  if (!marketUser) return sendError(res, 401, "UNAUTHORIZED", "Market user headers are required");

  const vendorMongoId = normalize(ctx.params.vendorMongoId);
  const setting = await prisma.setting.findUnique({
    where: { key: threadKey(vendorMongoId, marketUser.marketUserId) },
  });
  const thread = getThreadFromSetting(setting);
  if (!thread) return sendSuccess(res, { ok: true });

  thread.userLastReadAt = nowIso();
  thread.updatedAt = nowIso();
  await saveThread(vendorMongoId, marketUser.marketUserId, thread);
  return sendSuccess(res, { ok: true });
}

async function getVendorThreads({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR]);
  if (!auth.ok) return auth.response;
  if (!(await ensureChatEnabled(res))) return;

  const vendor = await getVendorForAuthUser(auth.user.mongoId);
  if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor profile not found");

  const all = await getAllThreads();
  const mine = all.filter((item) => item.thread.vendorMongoId === vendor.mongoId);
  const mapped = await Promise.all(mine.map((item) => mapThreadSummary(item.thread, "vendor")));
  const unreadTotal = mapped.reduce((acc, cur) => acc + (cur.unreadCount || 0), 0);
  return sendSuccess(res, { threads: mapped, unreadTotal });
}

async function getVendorThreadByMarketUser({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR]);
  if (!auth.ok) return auth.response;
  if (!(await ensureChatEnabled(res))) return;

  const vendor = await getVendorForAuthUser(auth.user.mongoId);
  if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor profile not found");

  const marketUserId = normalize(ctx.params.marketUserId);
  const setting = await prisma.setting.findUnique({ where: { key: threadKey(vendor.mongoId, marketUserId) } });
  const thread = getThreadFromSetting(setting);
  if (!thread) return sendError(res, 404, "THREAD_NOT_FOUND", "Thread not found");
  return sendSuccess(res, thread);
}

async function sendVendorMessage({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR]);
  if (!auth.ok) return auth.response;
  if (!(await ensureChatEnabled(res))) return;

  const vendor = await getVendorForAuthUser(auth.user.mongoId);
  if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor profile not found");

  const marketUserId = normalize(ctx.params.marketUserId);
  const text = normalize(ctx.body?.text);
  if (!text) return sendError(res, 400, "INVALID_MESSAGE", "Message text is required");

  const setting = await prisma.setting.findUnique({ where: { key: threadKey(vendor.mongoId, marketUserId) } });
  const thread = getThreadFromSetting(setting);
  if (!thread) return sendError(res, 404, "THREAD_NOT_FOUND", "Thread not found");

  const ts = nowIso();
  const message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    senderType: "vendor",
    senderId: vendor.mongoId,
    text,
    createdAt: ts,
    updatedAt: ts,
    edited: false,
    deletedAt: null,
  };

  thread.messages = [...(thread.messages || []), message];
  thread.vendorLastReadAt = ts;
  thread.updatedAt = ts;

  await saveThread(vendor.mongoId, marketUserId, thread);
  return sendSuccess(res, message, null, 201);
}

async function editVendorMessage({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR]);
  if (!auth.ok) return auth.response;
  if (!(await ensureChatEnabled(res))) return;

  const vendor = await getVendorForAuthUser(auth.user.mongoId);
  if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor profile not found");

  const marketUserId = normalize(ctx.params.marketUserId);
  const messageId = normalize(ctx.params.messageId);
  const text = normalize(ctx.body?.text);
  if (!text) return sendError(res, 400, "INVALID_MESSAGE", "Message text is required");

  const setting = await prisma.setting.findUnique({ where: { key: threadKey(vendor.mongoId, marketUserId) } });
  const thread = getThreadFromSetting(setting);
  if (!thread) return sendError(res, 404, "THREAD_NOT_FOUND", "Thread not found");

  const idx = (thread.messages || []).findIndex((m) => m.id === messageId);
  if (idx < 0) return sendError(res, 404, "MESSAGE_NOT_FOUND", "Message not found");
  const msg = thread.messages[idx];
  if (msg.senderType !== "vendor" || msg.senderId !== vendor.mongoId) {
    return sendError(res, 403, "FORBIDDEN", "Cannot edit this message");
  }
  if (Date.now() - toMs(msg.createdAt) > EDIT_WINDOW_MS) {
    return sendError(res, 403, "EDIT_WINDOW_EXPIRED", "Edit window has expired");
  }

  thread.messages[idx] = { ...msg, text, edited: true, updatedAt: nowIso() };
  thread.updatedAt = nowIso();
  await saveThread(vendor.mongoId, marketUserId, thread);
  return sendSuccess(res, thread.messages[idx]);
}

async function deleteVendorMessage({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR]);
  if (!auth.ok) return auth.response;
  if (!(await ensureChatEnabled(res))) return;

  const vendor = await getVendorForAuthUser(auth.user.mongoId);
  if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor profile not found");

  const marketUserId = normalize(ctx.params.marketUserId);
  const messageId = normalize(ctx.params.messageId);

  const setting = await prisma.setting.findUnique({ where: { key: threadKey(vendor.mongoId, marketUserId) } });
  const thread = getThreadFromSetting(setting);
  if (!thread) return sendError(res, 404, "THREAD_NOT_FOUND", "Thread not found");

  const idx = (thread.messages || []).findIndex((m) => m.id === messageId);
  if (idx < 0) return sendError(res, 404, "MESSAGE_NOT_FOUND", "Message not found");
  const msg = thread.messages[idx];
  if (msg.senderType !== "vendor" || msg.senderId !== vendor.mongoId) {
    return sendError(res, 403, "FORBIDDEN", "Cannot delete this message");
  }
  if (Date.now() - toMs(msg.createdAt) > EDIT_WINDOW_MS) {
    return sendError(res, 403, "DELETE_WINDOW_EXPIRED", "Delete window has expired");
  }

  thread.messages[idx] = { ...msg, text: "", deletedAt: nowIso(), updatedAt: nowIso() };
  thread.updatedAt = nowIso();
  await saveThread(vendor.mongoId, marketUserId, thread);
  return sendSuccess(res, { id: messageId });
}

async function markVendorThreadRead({ ctx, res }) {
  const auth = await requireRole({ ctx, res }, [USER_ROLES.VENDOR]);
  if (!auth.ok) return auth.response;
  if (!(await ensureChatEnabled(res))) return;

  const vendor = await getVendorForAuthUser(auth.user.mongoId);
  if (!vendor) return sendError(res, 404, "VENDOR_NOT_FOUND", "Vendor profile not found");

  const marketUserId = normalize(ctx.params.marketUserId);
  const setting = await prisma.setting.findUnique({ where: { key: threadKey(vendor.mongoId, marketUserId) } });
  const thread = getThreadFromSetting(setting);
  if (!thread) return sendSuccess(res, { ok: true });

  thread.vendorLastReadAt = nowIso();
  thread.updatedAt = nowIso();
  await saveThread(vendor.mongoId, marketUserId, thread);
  return sendSuccess(res, { ok: true });
}

module.exports = {
  getUserThreads,
  getUserThreadByVendor,
  sendUserMessage,
  editUserMessage,
  deleteUserMessage,
  markUserThreadRead,
  getVendorThreads,
  getVendorThreadByMarketUser,
  sendVendorMessage,
  editVendorMessage,
  deleteVendorMessage,
  markVendorThreadRead,
};
