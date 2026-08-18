import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDeepSeekClient } from "./ai/deepseek-client.js";
import { createApp } from "./app.js";
import { readEnvironment } from "./env.js";

const environment = readEnvironment();
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const clientDist = environment.NODE_ENV === "production" ? path.resolve(currentDir, "../../dist") : undefined;
const client = createDeepSeekClient({
  apiKey: environment.DEEPSEEK_API_KEY,
  baseUrl: environment.DEEPSEEK_BASE_URL,
  model: environment.DEEPSEEK_MODEL,
});
const app = createApp({ client, clientDist });

app.listen(environment.PORT, "127.0.0.1", () => {
  console.log(`API server listening on http://127.0.0.1:${environment.PORT}`);
});

