const modes = ["continue", "rewrite", "expand", "summarize", "email", "copywriting"];

for (const mode of modes) {
  let passed = false;
  let lastFailure = "No response";
  for (let attempt = 1; attempt <= 3 && !passed; attempt += 1) {
    const response = await fetch("http://127.0.0.1:8787/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        input: {
          content: "人工智能可以帮助人们更高效地整理思路和表达观点。",
          fields: {},
        },
        params: { creativity: 0.5, targetLength: 100, versionCount: 1 },
      }),
    });
    const payload = await response.json();
    if (response.ok && payload.completedCount === 1 && payload.versions?.[0]?.content) {
      console.log(`${mode}: ok (${payload.versions[0].content.length} chars, attempt ${attempt})`);
      passed = true;
    } else {
      lastFailure = `${response.status} ${payload.code ?? "INVALID_RESPONSE"} ${payload.message ?? ""}`;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  if (!passed) throw new Error(`${mode}: ${lastFailure}`);
}
