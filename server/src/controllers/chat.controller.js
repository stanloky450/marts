import { successResponse, errorResponse } from "../utils/apiResponse.js";
import prisma from "../lib/prisma.js";
import { ensureActiveMarketUserFromHeaders } from "../utils/market-user.js";

const CHAT_PREFIX = "chat:thread:";
const EDIT_WINDOW_MS = 2 * 60 * 1000;
const CHAT_FEATURE_KEY = "feature_chat_enabled";

const nowIso = () => new Date().toISOString();
const toMs = (v) => new Date(v).getTime();

const normalize = (v) => String(v || "").trim();

const getFeatureEnabled = async () => {
  const setting = await prisma.setting.findUnique({ where: { key: CHAT_FEATURE_KEY } });
  if (!setting) return true;
  return setting.value !== false;
};

const ensureChatEnabled = async (res) => {
  const enabled = await getFeatureEnabled();
  if (!enabled) {
    res.status(403).json(errorResponse("FEATURE_DISABLED", "Chat is currently disabled"));
    return false;
  }
  return true;
};

const threadKey = (vendorMongoId, marketUserId) =>
  `${CHAT_PREFIX}${vendorMongoId}:${marketUserId}`;

const buildThread = ({ vendorMongoId, marketUserId, marketUserName, marketUserEmail }) => {
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
};

const getVendorForAuthUser = async (req) => {
  return prisma.vendor.findFirst({
    where: { ownerMongoId: req.user.id },
    select: { mongoId: true, businessName: true, subdomain: true },
  });
};

const getThreadFromSetting = (setting) => {
  const value = setting?.value;
  if (!value || typeof value !== "object") return null;
  return value;
};

const saveThread = async (vendorMongoId, marketUserId, thread) => {
  await prisma.setting.upsert({
    where: { key: threadKey(vendorMongoId, marketUserId) },
    update: { value: thread },
    create: { key: threadKey(vendorMongoId, marketUserId), value: thread },
  });
};

const getAllThreads = async () => {
  const rows = await prisma.setting.findMany({
    where: { key: { startsWith: CHAT_PREFIX } },
    orderBy: { updatedAt: "desc" },
  });
  return rows
    .map((row) => ({ key: row.key, thread: getThreadFromSetting(row) }))
    .filter((item) => !!item.thread);
};

const computeUnread = (thread, receiver) => {
  const lastReadAt = receiver === "vendor" ? thread.vendorLastReadAt : thread.userLastReadAt;
  const lastMs = lastReadAt ? toMs(lastReadAt) : 0;
  return (thread.messages || []).filter((m) => {
    if (m.deletedAt) return false;
    if (receiver === "vendor" && m.senderType !== "user") return false;
    if (receiver === "user" && m.senderType !== "vendor") return false;
    return toMs(m.createdAt) > lastMs;
  }).length;
};

const mapThreadSummary = async (thread, receiver) => {
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
};

export const getUserThreads = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const marketUser = await ensureActiveMarketUserFromHeaders(req, res);
    if (!marketUser) return;

    const all = await getAllThreads();
    const mine = all.filter((item) => item.thread.marketUserId === marketUser.marketUserId);
    const mapped = await Promise.all(mine.map((item) => mapThreadSummary(item.thread, "user")));
    const unreadTotal = mapped.reduce((acc, cur) => acc + (cur.unreadCount || 0), 0);

    res.json(successResponse({ threads: mapped, unreadTotal }));
  } catch (error) {
    next(error);
  }
};

export const getUserThreadByVendor = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const marketUser = await ensureActiveMarketUserFromHeaders(req, res);
    if (!marketUser) return;
    const vendorMongoId = normalize(req.params.vendorMongoId);
    if (!vendorMongoId) {
      return res.status(400).json(errorResponse("INVALID_VENDOR", "vendorMongoId is required"));
    }

    const setting = await prisma.setting.findUnique({
      where: { key: threadKey(vendorMongoId, marketUser.marketUserId) },
    });
    const thread =
      getThreadFromSetting(setting) ||
      buildThread({ vendorMongoId, ...marketUser });

    res.json(successResponse(thread));
  } catch (error) {
    next(error);
  }
};

export const sendUserMessage = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const marketUser = await ensureActiveMarketUserFromHeaders(req, res);
    if (!marketUser) return;
    const vendorMongoId = normalize(req.params.vendorMongoId);
    const text = normalize(req.body.text);
    if (!text) {
      return res.status(400).json(errorResponse("INVALID_MESSAGE", "Message text is required"));
    }

    const setting = await prisma.setting.findUnique({
      where: { key: threadKey(vendorMongoId, marketUser.marketUserId) },
    });
    const thread =
      getThreadFromSetting(setting) ||
      buildThread({ vendorMongoId, ...marketUser });

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
    res.status(201).json(successResponse(message));
  } catch (error) {
    next(error);
  }
};

export const editUserMessage = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const marketUser = await ensureActiveMarketUserFromHeaders(req, res);
    if (!marketUser) return;
    const vendorMongoId = normalize(req.params.vendorMongoId);
    const messageId = normalize(req.params.messageId);
    const text = normalize(req.body.text);
    if (!text) {
      return res.status(400).json(errorResponse("INVALID_MESSAGE", "Message text is required"));
    }

    const setting = await prisma.setting.findUnique({
      where: { key: threadKey(vendorMongoId, marketUser.marketUserId) },
    });
    const thread = getThreadFromSetting(setting);
    if (!thread) {
      return res.status(404).json(errorResponse("THREAD_NOT_FOUND", "Thread not found"));
    }

    const idx = (thread.messages || []).findIndex((m) => m.id === messageId);
    if (idx < 0) {
      return res.status(404).json(errorResponse("MESSAGE_NOT_FOUND", "Message not found"));
    }
    const msg = thread.messages[idx];
    if (msg.senderType !== "user" || msg.senderId !== marketUser.marketUserId) {
      return res.status(403).json(errorResponse("FORBIDDEN", "Cannot edit this message"));
    }
    if (Date.now() - toMs(msg.createdAt) > EDIT_WINDOW_MS) {
      return res.status(403).json(errorResponse("EDIT_WINDOW_EXPIRED", "Edit window has expired"));
    }

    thread.messages[idx] = {
      ...msg,
      text,
      edited: true,
      updatedAt: nowIso(),
    };
    thread.updatedAt = nowIso();
    await saveThread(vendorMongoId, marketUser.marketUserId, thread);
    res.json(successResponse(thread.messages[idx]));
  } catch (error) {
    next(error);
  }
};

export const deleteUserMessage = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const marketUser = await ensureActiveMarketUserFromHeaders(req, res);
    if (!marketUser) return;
    const vendorMongoId = normalize(req.params.vendorMongoId);
    const messageId = normalize(req.params.messageId);

    const setting = await prisma.setting.findUnique({
      where: { key: threadKey(vendorMongoId, marketUser.marketUserId) },
    });
    const thread = getThreadFromSetting(setting);
    if (!thread) {
      return res.status(404).json(errorResponse("THREAD_NOT_FOUND", "Thread not found"));
    }

    const idx = (thread.messages || []).findIndex((m) => m.id === messageId);
    if (idx < 0) {
      return res.status(404).json(errorResponse("MESSAGE_NOT_FOUND", "Message not found"));
    }
    const msg = thread.messages[idx];
    if (msg.senderType !== "user" || msg.senderId !== marketUser.marketUserId) {
      return res.status(403).json(errorResponse("FORBIDDEN", "Cannot delete this message"));
    }
    if (Date.now() - toMs(msg.createdAt) > EDIT_WINDOW_MS) {
      return res.status(403).json(errorResponse("DELETE_WINDOW_EXPIRED", "Delete window has expired"));
    }

    thread.messages[idx] = {
      ...msg,
      text: "",
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    };
    thread.updatedAt = nowIso();
    await saveThread(vendorMongoId, marketUser.marketUserId, thread);
    res.json(successResponse({ id: messageId }));
  } catch (error) {
    next(error);
  }
};

export const markUserThreadRead = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const marketUser = await ensureActiveMarketUserFromHeaders(req, res);
    if (!marketUser) return;
    const vendorMongoId = normalize(req.params.vendorMongoId);
    const setting = await prisma.setting.findUnique({
      where: { key: threadKey(vendorMongoId, marketUser.marketUserId) },
    });
    const thread = getThreadFromSetting(setting);
    if (!thread) return res.json(successResponse({ ok: true }));

    thread.userLastReadAt = nowIso();
    thread.updatedAt = nowIso();
    await saveThread(vendorMongoId, marketUser.marketUserId, thread);
    res.json(successResponse({ ok: true }));
  } catch (error) {
    next(error);
  }
};

export const getVendorThreads = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const vendor = await getVendorForAuthUser(req);
    if (!vendor) {
      return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor profile not found"));
    }
    const all = await getAllThreads();
    const mine = all.filter((item) => item.thread.vendorMongoId === vendor.mongoId);
    const mapped = await Promise.all(mine.map((item) => mapThreadSummary(item.thread, "vendor")));
    const unreadTotal = mapped.reduce((acc, cur) => acc + (cur.unreadCount || 0), 0);
    res.json(successResponse({ threads: mapped, unreadTotal }));
  } catch (error) {
    next(error);
  }
};

export const getVendorThreadByMarketUser = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const vendor = await getVendorForAuthUser(req);
    if (!vendor) {
      return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor profile not found"));
    }
    const marketUserId = normalize(req.params.marketUserId);
    const setting = await prisma.setting.findUnique({
      where: { key: threadKey(vendor.mongoId, marketUserId) },
    });
    const thread = getThreadFromSetting(setting);
    if (!thread) {
      return res.status(404).json(errorResponse("THREAD_NOT_FOUND", "Thread not found"));
    }
    res.json(successResponse(thread));
  } catch (error) {
    next(error);
  }
};

export const sendVendorMessage = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const vendor = await getVendorForAuthUser(req);
    if (!vendor) {
      return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor profile not found"));
    }
    const marketUserId = normalize(req.params.marketUserId);
    const text = normalize(req.body.text);
    if (!text) {
      return res.status(400).json(errorResponse("INVALID_MESSAGE", "Message text is required"));
    }

    const setting = await prisma.setting.findUnique({
      where: { key: threadKey(vendor.mongoId, marketUserId) },
    });
    const thread = getThreadFromSetting(setting);
    if (!thread) {
      return res.status(404).json(errorResponse("THREAD_NOT_FOUND", "Thread not found"));
    }

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
    res.status(201).json(successResponse(message));
  } catch (error) {
    next(error);
  }
};

export const editVendorMessage = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const vendor = await getVendorForAuthUser(req);
    if (!vendor) {
      return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor profile not found"));
    }
    const marketUserId = normalize(req.params.marketUserId);
    const messageId = normalize(req.params.messageId);
    const text = normalize(req.body.text);
    if (!text) {
      return res.status(400).json(errorResponse("INVALID_MESSAGE", "Message text is required"));
    }

    const setting = await prisma.setting.findUnique({
      where: { key: threadKey(vendor.mongoId, marketUserId) },
    });
    const thread = getThreadFromSetting(setting);
    if (!thread) {
      return res.status(404).json(errorResponse("THREAD_NOT_FOUND", "Thread not found"));
    }

    const idx = (thread.messages || []).findIndex((m) => m.id === messageId);
    if (idx < 0) {
      return res.status(404).json(errorResponse("MESSAGE_NOT_FOUND", "Message not found"));
    }
    const msg = thread.messages[idx];
    if (msg.senderType !== "vendor" || msg.senderId !== vendor.mongoId) {
      return res.status(403).json(errorResponse("FORBIDDEN", "Cannot edit this message"));
    }
    if (Date.now() - toMs(msg.createdAt) > EDIT_WINDOW_MS) {
      return res.status(403).json(errorResponse("EDIT_WINDOW_EXPIRED", "Edit window has expired"));
    }

    thread.messages[idx] = {
      ...msg,
      text,
      edited: true,
      updatedAt: nowIso(),
    };
    thread.updatedAt = nowIso();
    await saveThread(vendor.mongoId, marketUserId, thread);
    res.json(successResponse(thread.messages[idx]));
  } catch (error) {
    next(error);
  }
};

export const deleteVendorMessage = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const vendor = await getVendorForAuthUser(req);
    if (!vendor) {
      return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor profile not found"));
    }
    const marketUserId = normalize(req.params.marketUserId);
    const messageId = normalize(req.params.messageId);

    const setting = await prisma.setting.findUnique({
      where: { key: threadKey(vendor.mongoId, marketUserId) },
    });
    const thread = getThreadFromSetting(setting);
    if (!thread) {
      return res.status(404).json(errorResponse("THREAD_NOT_FOUND", "Thread not found"));
    }

    const idx = (thread.messages || []).findIndex((m) => m.id === messageId);
    if (idx < 0) {
      return res.status(404).json(errorResponse("MESSAGE_NOT_FOUND", "Message not found"));
    }
    const msg = thread.messages[idx];
    if (msg.senderType !== "vendor" || msg.senderId !== vendor.mongoId) {
      return res.status(403).json(errorResponse("FORBIDDEN", "Cannot delete this message"));
    }
    if (Date.now() - toMs(msg.createdAt) > EDIT_WINDOW_MS) {
      return res.status(403).json(errorResponse("DELETE_WINDOW_EXPIRED", "Delete window has expired"));
    }

    thread.messages[idx] = {
      ...msg,
      text: "",
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    };
    thread.updatedAt = nowIso();
    await saveThread(vendor.mongoId, marketUserId, thread);
    res.json(successResponse({ id: messageId }));
  } catch (error) {
    next(error);
  }
};

export const markVendorThreadRead = async (req, res, next) => {
  try {
    if (!(await ensureChatEnabled(res))) return;
    const vendor = await getVendorForAuthUser(req);
    if (!vendor) {
      return res.status(404).json(errorResponse("VENDOR_NOT_FOUND", "Vendor profile not found"));
    }
    const marketUserId = normalize(req.params.marketUserId);
    const setting = await prisma.setting.findUnique({
      where: { key: threadKey(vendor.mongoId, marketUserId) },
    });
    const thread = getThreadFromSetting(setting);
    if (!thread) return res.json(successResponse({ ok: true }));

    thread.vendorLastReadAt = nowIso();
    thread.updatedAt = nowIso();
    await saveThread(vendor.mongoId, marketUserId, thread);
    res.json(successResponse({ ok: true }));
  } catch (error) {
    next(error);
  }
};
