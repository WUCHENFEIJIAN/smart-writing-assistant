import { describe, expect, it } from "vitest";
import { generateRequestSchema, generationParamsSchema } from "@shared/validation";

describe("generation validation", () => {
  it("accepts the confirmed default parameters", () => {
    expect(generationParamsSchema.parse({ creativity: 0.5, targetLength: 500, versionCount: 1 })).toEqual({
      creativity: 0.5,
      targetLength: 500,
      versionCount: 1,
    });
  });

  it.each([
    { creativity: -0.01, targetLength: 500, versionCount: 1 },
    { creativity: 1.01, targetLength: 500, versionCount: 1 },
    { creativity: 0.5, targetLength: 99, versionCount: 1 },
    { creativity: 0.5, targetLength: 5_001, versionCount: 1 },
    { creativity: 0.5, targetLength: 500, versionCount: 0 },
    { creativity: 0.5, targetLength: 500, versionCount: 11 },
  ])("rejects parameters outside the PRD limits: $creativity/$targetLength/$versionCount", (params) => {
    expect(generationParamsSchema.safeParse(params).success).toBe(false);
  });

  it("requires the primary content but allows empty auxiliary fields", () => {
    expect(
      generateRequestSchema.safeParse({
        mode: "email",
        input: { content: "请帮我安排会议", fields: {} },
        params: { creativity: 0.5, targetLength: 500, versionCount: 1 },
      }).success,
    ).toBe(true);

    expect(
      generateRequestSchema.safeParse({
        mode: "email",
        input: { content: "   ", fields: {} },
        params: { creativity: 0.5, targetLength: 500, versionCount: 1 },
      }).success,
    ).toBe(false);
  });
});

