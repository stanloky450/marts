import { successResponse, errorResponse } from "../utils/apiResponse.js"
import axios from "axios"
import prisma from "../lib/prisma.js"

// Public settings keys that are safe to expose
const PUBLIC_KEYS = [
  "market_banner_url",
  "market_rss_url",
  "market_rss_ad_count",
  "market_rss_avg_time",
  "feature_chat_enabled",
  "feature_reviews_enabled",
]

/**
 * Get all settings (Admin only)
 */
export const getAllSettings = async (req, res, next) => {
  try {
    const settings = await prisma.setting.findMany()
    
    // Convert to a neat key-value object
    const settingsMap = settings.reduce((acc, current) => {
      acc[current.key] = current.value
      return acc
    }, {})

    res.json(successResponse(settingsMap))
  } catch (error) {
    next(error)
  }
}

/**
 * Get public settings
 */
export const getPublicSettings = async (req, res, next) => {
  try {
    const settings = await prisma.setting.findMany({
      where: { key: { in: PUBLIC_KEYS } }
    })
    
    const settingsMap = settings.reduce((acc, current) => {
      acc[current.key] = current.value
      return acc
    }, {})

    res.json(successResponse(settingsMap))
  } catch (error) {
    next(error)
  }
}

/**
 * Update multiple settings (Admin only)
 */
export const updateSettings = async (req, res, next) => {
  try {
    const settingsUpdates = req.body // Expects { key1: value1, key2: value2 }

    const updatePromises = Object.entries(settingsUpdates).map(([key, value]) => {
      return prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value }
      })
    })

    await Promise.all(updatePromises)
    
    res.json(successResponse({ message: "Settings updated successfully" }))
  } catch (error) {
    next(error)
  }
}

/**
 * Proxy RSS feed to avoid CORS
 */
export const getRssProxy = async (req, res, next) => {
  try {
    const { url } = req.query
    if (!url) {
      return res.status(400).json(errorResponse(400, "URL is required"))
    }

    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    })

    const xmlData = response.data
    const items = []

    // Simple Regex Parsing for RSS items
    const itemRegex = /<(item|entry)>([\s\S]*?)<\/\1>/g
    let match
    while ((match = itemRegex.exec(xmlData)) !== null) {
      const content = match[2]
      
      const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/)
      const linkMatch = content.match(/<link[^>]*>(?:([\s\S]*?)<\/link>|.*?href=["'](.*?)["'].*?>)/)
      const descMatch = content.match(/<(description|content|summary)[^>]*>([\s\S]*?)<\/\1>/)

      let title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "No Title"
      let link = ""
      if (linkMatch) {
         link = (linkMatch[1] || linkMatch[2] || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim()
      }
      let description = descMatch ? descMatch[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").substring(0, 200).trim() : ""

      items.push({ title, link, description })
    }

    res.json(successResponse({ items }))
  } catch (error) {
    console.error("RSS Proxy error:", error.message)
    res.status(502).json(errorResponse(502, "Failed to fetch RSS feed"))
  }
}
