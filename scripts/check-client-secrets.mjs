import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", quiet: true });

const dist = path.resolve("dist");
const candidates = ["DEEPSEEK_API_KEY", process.env.DEEPSEEK_API_KEY].filter(Boolean);
let matches = 0;

function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) inspect(target);
    else if (candidates.some((candidate) => fs.readFileSync(target).includes(candidate))) matches += 1;
  }
}

inspect(dist);
if (matches > 0) throw new Error(`Client secret scan failed: ${matches} matching file(s)`);
console.log("Client secret scan passed: 0 matching files");
