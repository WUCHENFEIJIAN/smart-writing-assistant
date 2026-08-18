// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildGenerationMessages, buildOptimizeMessages, targetLengthToMaxTokens } from "../../server/ai/prompts.js";
import type { WritingMode } from "../../shared/types/writing.js";

describe("server prompt construction", () => {
  it.each<WritingMode>(["continue", "rewrite", "expand", "summarize", "email", "copywriting"])(
    "builds a bounded %s prompt",
    (mode) => {
      const messages = buildGenerationMessages(
        { mode, input: { content: "用户正文", fields: { tone: "专业" } }, params: { creativity: 0.5, targetLength: 500, versionCount: 2 } },
        0,
      );
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe("system");
      expect(messages[1].content).toContain('"mainContent": "用户正文"');
      expect(messages[1].content).toContain("候选版本 1");
      expect(messages[0].content).toContain("只返回可直接使用的最终文本");
    },
  );

  it("reserves reasoning capacity while staying below the accepted token ceiling", () => {
    expect(targetLengthToMaxTokens(100)).toBe(2_048);
    expect(targetLengthToMaxTokens(500)).toBe(2_048);
    expect(targetLengthToMaxTokens(5_000)).toBe(8_024);
    expect(targetLengthToMaxTokens(5_000)).toBeLessThanOrEqual(8_192);
  });

  it.each<WritingMode>(["continue", "rewrite", "expand", "summarize", "email", "copywriting"])(
    "keeps optimized %s output aligned with its writing mode",
    (mode) => {
      const messages = buildOptimizeMessages({
        mode,
        content: "待优化内容",
        fields: { tone: "专业" },
        params: { creativity: 0.5, targetLength: 500 },
      });

      expect(messages[0].content).toContain("当前写作模式");
      expect(messages[0].content).toContain("输出格式要求");
      expect(messages[1].content).toContain('"mainContent": "待优化内容"');
      expect(messages[1].content).toContain('"tone": "专业"');
    },
  );

  it("requires copywriting optimization to use only the left-card fields", () => {
    const messages = buildOptimizeMessages({
      mode: "copywriting",
      content: "一款便携咖啡机",
      fields: { audience: "上班族", platform: "小红书", sellingPoints: "轻巧、快速" },
      params: { creativity: 0.5, targetLength: 500 },
    });
    const prompt = messages.map((message) => message.content).join("\n");

    expect(prompt).toContain("产品或主题");
    expect(prompt).toContain("目标受众");
    expect(prompt).toContain("发布平台");
    expect(prompt).toContain("核心卖点");
    expect(prompt).toContain("只返回一个严格 JSON 对象");
    expect(prompt).toContain("不要返回任何额外栏目或正文");
    expect(prompt).toContain('"audience": "上班族"');
  });

  it("optimizes only supplied values instead of executing a writing task", () => {
    const messages = buildOptimizeMessages({
      mode: "continue",
      content: "这是一段需要润色的原文。",
      fields: { direction: "说明后续方向" },
      params: { creativity: 0.5, targetLength: 5_000 },
    });
    const prompt = messages.map((message) => message.content).join("\n");

    expect(prompt).toContain("只优化 JSON 中已有的文本值");
    expect(prompt).toContain("不得续写、改写、扩展、总结或生成");
    expect(prompt).not.toContain("创作自然衔接的新内容");
    expect(prompt).not.toContain("目标长度约 5000");
  });
});
