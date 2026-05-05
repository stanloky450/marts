const axios = require("axios");
const { prisma } = require("../db/prisma");
const { sendSuccess, sendError } = require("../http/response");
const { PRODUCT_STATUS } = require("../constants");

const SALES_SYSTEM_PROMPT = `
You are an expert AI sales assistant for a Nigerian online marketplace. Your ONLY goal is to convert shoppers into buyers.

Your personality:
- Enthusiastic, helpful, and persuasive but never pushy
- You speak naturally and conversationally
- You highlight value, solve problems, and remove buying hesitations

Your rules:
1. Always recommend specific products from the provided catalog.
2. Always mention prices and stock levels.
3. Highlight vendor credibility and product quality.
4. Use soft urgency language.
5. Do not answer customer support questions.
6. Do not invent products.
7. When comparing vendors, be neutral and factual.
8. End every response with a clear call to action.

Return valid JSON only:
{
  "reply": "Your response",
  "productIds": ["id1", "id2"]
}
`.trim();

async function requestOpenAI(body) {
  const response = await axios.post("https://api.openai.com/v1/chat/completions", body, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
}

async function aiChat({ ctx, res }) {
  const message = typeof ctx.body?.message === "string" ? ctx.body.message : "";
  const subdomain = typeof ctx.body?.subdomain === "string" ? ctx.body.subdomain : "";
  const storeContext = typeof ctx.body?.context === "string" ? ctx.body.context : "";

  if (!message.trim()) return sendError(res, 400, "INVALID_INPUT", "message is required");
  if (message.length > 500) return sendError(res, 400, "MESSAGE_TOO_LONG", "Message must be under 500 characters");
  if (!process.env.OPENAI_API_KEY) return sendError(res, 503, "AI_NOT_CONFIGURED", "AI assistant is not configured");

  const where = { status: PRODUCT_STATUS.APPROVED };
  if (subdomain) {
    const vendor = await prisma.vendor.findUnique({ where: { subdomain: subdomain.toLowerCase() } });
    if (vendor) where.vendorMongoId = vendor.mongoId;
  }

  const keywords = message.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter((word) => word.length > 3);
  if (keywords.length > 0) {
    where.OR = [
      { name: { contains: keywords[0], mode: "insensitive" } },
      { description: { contains: keywords[0], mode: "insensitive" } },
    ];
  }

  let products = await prisma.product.findMany({
    where,
    include: {
      vendor: { select: { businessName: true, subdomain: true, mongoId: true } },
      category: { select: { name: true, mongoId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  if (products.length === 0 && keywords.length > 0) {
    delete where.OR;
    products = await prisma.product.findMany({
      where,
      include: {
        vendor: { select: { businessName: true, subdomain: true, mongoId: true } },
        category: { select: { name: true, mongoId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
  }

  const catalog = products
    .map(
      (product) =>
        `ID:${product.mongoId} | "${product.name}" | NGN ${Number(product.price).toLocaleString()} | Stock:${product.stock} | Category:${product.category?.name || "General"} | Vendor:${product.vendor?.businessName || "Unknown"} | ${String(product.description || "").slice(0, 80)}`
    )
    .join("\n");

  const userMessage = `
PRODUCT CATALOG:
${catalog || "No products currently available."}

${storeContext ? `STORE CONTEXT: ${storeContext}\n` : ""}CUSTOMER MESSAGE: ${message.trim()}
`.trim();

  try {
    const completion = await requestOpenAI({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: SALES_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const rawContent = completion.choices?.[0]?.message?.content || "{}";
    let aiResponse;
    try {
      aiResponse = JSON.parse(rawContent);
    } catch {
      aiResponse = { reply: rawContent, productIds: [] };
    }

    const recommendedIds = Array.isArray(aiResponse.productIds) ? aiResponse.productIds.slice(0, 3) : [];
    const recommendedProducts = products.filter((product) => recommendedIds.includes(product.mongoId) || recommendedIds.includes(product.id));

    return sendSuccess(res, {
      reply: aiResponse.reply || "I'm here to help you find the best products!",
      products: recommendedProducts.map((product) => ({
        _id: product.mongoId,
        name: product.name,
        price: product.price,
        stock: product.stock,
        images: product.images,
        description: product.description,
        vendor: product.vendor ? { ...product.vendor, _id: product.vendor.mongoId } : null,
        subdomain: product.vendor?.subdomain,
      })),
      usage: {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
      },
    });
  } catch (error) {
    const status = error?.response?.status || error?.status;
    if (status === 401) return sendError(res, 503, "AI_AUTH_FAILED", "AI service authentication failed");
    if (status === 429) return sendError(res, 503, "AI_RATE_LIMIT", "AI service is busy, please try again shortly");
    return sendError(
      res,
      503,
      "AI_SERVICE_ERROR",
      "AI service is currently unavailable. Please try again later.",
      error?.response?.data || { message: error?.message }
    );
  }
}

module.exports = {
  aiChat,
};
