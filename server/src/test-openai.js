import OpenAI from "openai";
import { config } from "./config/env.js";

async function testOpenAI() {
    const key = config.openai.apiKey;
    console.log("Key source  :", key ? "config loaded" : "MISSING");
    console.log("Key preview :", key ? (key.substring(0, 14) + "..." + key.slice(-6)) : "N/A");
    console.log("Key length  :", key ? key.length : 0);

    if (!key) {
        console.error("❌ No OpenAI API key found. Add OPENAI_API_KEY to server/.env");
        return;
    }

    const openai = new OpenAI({ apiKey: key });

    try {
        console.log("\nCalling OpenAI gpt-4o-mini...");
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "Say: OK" }],
            max_tokens: 5,
        });
        console.log("✅ OpenAI works! Response:", completion.choices[0]?.message?.content);
    } catch (error) {
        console.error("❌ OpenAI Error:", error.message);
        console.error("   HTTP Status :", error.status || error?.response?.status || "unknown");
        console.error("   Error code  :", error.code || error?.error?.code || "unknown");
        if (error.status === 401) {
            console.error("\n→ Your API key is INVALID or EXPIRED.");
            console.error("  Get a new key at: https://platform.openai.com/api-keys");
        } else if (error.status === 429) {
            console.error("\n→ Rate limit / quota exceeded. Check your plan at: https://platform.openai.com/usage");
        }
    }
}

testOpenAI();

