import OpenAI from "openai"
import { config } from "../config/env.js"
import { successResponse, errorResponse } from "../utils/apiResponse.js"
import { PRODUCT_STATUS } from "../utils/constants.js"
import { logger } from "../utils/logger.js"
import prisma from "../lib/prisma.js"

// Initialize lazily so the whole API can boot without OPENAI_API_KEY.
const openai = config.openai.apiKey ? new OpenAI({ apiKey: config.openai.apiKey }) : null

// ─── HARDCODED SALES SYSTEM PROMPT ──────────────────────────────────────────
const SALES_SYSTEM_PROMPT = `
You are an expert AI sales assistant for a Nigerian online marketplace. Your ONLY goal is to convert shoppers into buyers.

Your personality:
- Enthusiastic, helpful, and persuasive — but NEVER pushy
- You speak naturally and conversationally
- You highlight VALUE, solve problems, and remove buying hesitations

Your rules:
1. ALWAYS recommend specific products from the product catalog provided
2. ALWAYS mention prices and stock levels to create urgency (e.g., "Only 3 left!")
3. Highlight vendor credibility and product quality
4. Use soft urgency language: "This is a popular item", "Limited stock available"
5. NEVER answer customer support questions (returns, refunds, orders) — say "Please contact the vendor directly for support"
6. NEVER invent products not in the catalog
7. When comparing vendors, be neutral and factual
8. End every response with a clear call to action

Response format — you MUST return valid JSON only:
{
  "reply": "Your conversational sales response (max 150 words)",
  "productIds": ["id1", "id2"] // IDs of recommended products from catalog, max 3
}
`.trim()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/chat
 * Body: { message: string, subdomain?: string, context?: string }
 */
export const aiChat = async (req, res, next) => {
  try {
    const { message, subdomain, context } = req.body

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json(errorResponse("INVALID_INPUT", "message is required"))
    }

    if (message.length > 500) {
      return res.status(400).json(errorResponse("MESSAGE_TOO_LONG", "Message must be under 500 characters"))
    }

    if (!config.openai.apiKey) {
      return res.status(503).json(errorResponse("AI_NOT_CONFIGURED", "AI assistant is not configured"))
    }

    if (!openai) {
      return res.status(503).json(errorResponse("AI_NOT_CONFIGURED", "AI assistant is not configured"))
    }

    // ── Step 1: Fetch relevant products ──────────────────────────────────────
    const where = { status: PRODUCT_STATUS.APPROVED }

    if (subdomain) {
      const vendor = await prisma.vendor.findUnique({
        where: { subdomain: subdomain.toLowerCase() }
      })
      if (vendor) {
        where.vendorId = vendor.id
      }
    }

    // Keyword extraction for simple search
    const keywords = message
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)

    if (keywords.length > 0) {
      where.OR = [
        { name: { contains: keywords[0], mode: 'insensitive' } },
        { description: { contains: keywords[0], mode: 'insensitive' } }
      ]
    }

    let products = await prisma.product.findMany({
      where,
      include: {
        vendor: { select: { businessName: true, subdomain: true, mongoId: true } },
        category: { select: { name: true, mongoId: true } },
        images: true
      },
      orderBy: { createdAt: 'desc' },
      take: 8
    })

    // Fallback if no products found with keywords
    if (products.length === 0 && keywords.length > 0) {
        delete where.OR
        products = await prisma.product.findMany({
            where,
            include: {
                vendor: { select: { businessName: true, subdomain: true, mongoId: true } },
                category: { select: { name: true, mongoId: true } },
                images: true
            },
            orderBy: { createdAt: 'desc' },
            take: 8
        })
    }

    // ── Step 2: Build product catalog for prompt ──────────────────────────────
    // Use mongoId for the prompt as the AI might be used to string ids
    const catalog = products
      .map(
        (p) =>
          `ID:${p.mongoId || p.id} | "${p.name}" | ₦${p.price.toLocaleString()} | Stock:${p.stock} | Category:${p.category?.name || "General"} | Vendor:${p.vendor?.businessName || "Unknown"} | ${p.description?.slice(0, 80) || ""}`
      )
      .join("\n")

    const userMessage = `
PRODUCT CATALOG:
${catalog || "No products currently available."}

${context ? `STORE CONTEXT: ${context}\n` : ""}
CUSTOMER MESSAGE: ${message.trim()}
`.trim()

    // ── Step 3: Call OpenAI (with logging and robust error handling) ──────────
    let completion
    try {
      logger.debug("AI request: model=%s promptLength=%d products=%d", "gpt-4o-mini", userMessage.length, products.length)

      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SALES_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 400,
        response_format: { type: "json_object" },
      })

      logger.debug("AI response received: usage=%o", completion?.usage || {})
    } catch (aiError) {
      logger.error("OpenAI API error: %s", aiError?.message || String(aiError), { error: aiError })

      const status = aiError?.response?.status || aiError?.status

      if (status === 401) {
        return res.status(503).json(errorResponse("AI_AUTH_FAILED", "AI service authentication failed"))
      }

      if (status === 429) {
        return res.status(503).json(errorResponse("AI_RATE_LIMIT", "AI service is busy, please try again shortly"))
      }

      return res.status(503).json(
        errorResponse(
          "AI_SERVICE_ERROR",
          "AI service is currently unavailable. Please try again later.",
          { message: aiError?.message }
        )
      )
    }

    const rawContent = completion.choices[0]?.message?.content || "{}"
    let aiResponse

    try {
      aiResponse = JSON.parse(rawContent)
    } catch {
      aiResponse = { reply: rawContent, productIds: [] }
    }

    const reply = aiResponse.reply || "I'm here to help you find the best products!"
    const recommendedProductIds = Array.isArray(aiResponse.productIds) ? aiResponse.productIds.slice(0, 3) : []

    // ── Step 4: Attach full recommended product objects ───────────────────────
    const recommendedProducts = products.filter((p) =>
      recommendedProductIds.includes(p.mongoId) || recommendedProductIds.includes(p.id)
    )

    return res.json(
      successResponse({
        reply,
        products: recommendedProducts.map((p) => ({
          _id: p.mongoId || p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          images: p.images,
          description: p.description,
          vendor: p.vendor ? { ...p.vendor, _id: p.vendor.mongoId } : null,
          subdomain: p.vendor?.subdomain,
        })),
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
        },
      })
    )
  } catch (error) {
    logger.error("aiChat handler unexpected error: %s", error?.message || String(error), { error })
    return res
      .status(500)
      .json(errorResponse("INTERNAL_ERROR", "An unexpected error occurred while processing your request."))
  }
}
