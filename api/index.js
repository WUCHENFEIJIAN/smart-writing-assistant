import { createApp } from "../dist-server/server/app.js";
import { createDeepSeekClient } from "../dist-server/server/ai/deepseek-client.js";

const client = createDeepSeekClient({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
});

const app = createApp({ client });

export default app;
