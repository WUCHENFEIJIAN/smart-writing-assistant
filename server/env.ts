import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: ".env.local", quiet: true });

const environmentSchema = z.object({
  DEEPSEEK_API_KEY: z.string().min(1, "DEEPSEEK_API_KEY is required"),
  DEEPSEEK_BASE_URL: z.url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().min(1).default("deepseek-v4-flash"),
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export function readEnvironment() {
  return environmentSchema.parse(process.env);
}

