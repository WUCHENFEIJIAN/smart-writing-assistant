// @vitest-environment node

import { describe, expect, it } from "vitest";
import { formatOptimizedInput, parseOptimizedInput } from "../../server/ai/optimized-input.js";
import type { WritingInput, WritingMode } from "../../shared/types/writing.js";

const MODE_CASES: Array<{ mode: WritingMode; fields: Record<string, string>; labels: string[] }> = [
  { mode: "continue", fields: { direction: "继续说明价值" }, labels: ["已有内容", "续写方向（可选）"] },
  { mode: "rewrite", fields: { tone: "更专业" }, labels: ["原始内容", "改写要求（可选）"] },
  { mode: "expand", fields: { focus: "补充案例" }, labels: ["原始内容", "补充方向（可选）"] },
  { mode: "summarize", fields: { focus: "突出结论" }, labels: ["原始内容", "总结侧重点（可选）"] },
  { mode: "email", fields: { recipient: "客户", tone: "正式" }, labels: ["邮件目的与要点", "收件对象（可选）", "邮件语气（可选）"] },
  { mode: "copywriting", fields: { audience: "上班族", platform: "小红书", sellingPoints: "轻巧、快速" }, labels: ["产品或主题", "目标受众（可选）", "发布平台（可选）", "核心卖点（可选）"] },
];

describe("optimized input formatting", () => {
  it.each(MODE_CASES)("formats $mode using only its left-card labels", ({ mode, fields, labels }) => {
    const structuredInput: WritingInput = { content: "优化后的主内容", fields };
    const formatted = formatOptimizedInput(mode, structuredInput);

    labels.forEach((label) => expect(formatted).toContain(`${label}\n`));
    expect(formatted).not.toContain("生成结果");
    expect(formatted).not.toContain("文案正文");
  });

  it("parses model JSON, removes unsupported fields, and preserves the mode structure", () => {
    const raw = `\`\`\`json
{"content":"便携咖啡机","fields":{"audience":"通勤上班族","platform":"小红书","sellingPoints":"轻巧快速","generatedCopy":"立即购买"}}
\`\`\``;
    const original: WritingInput = {
      content: "便携咖啡机",
      fields: { audience: "上班族", platform: "小红书", sellingPoints: "轻巧、快速" },
    };

    expect(parseOptimizedInput("copywriting", raw, original)).toEqual({
      content: "便携咖啡机",
      fields: { audience: "通勤上班族", platform: "小红书", sellingPoints: "轻巧快速" },
    });
  });
});
