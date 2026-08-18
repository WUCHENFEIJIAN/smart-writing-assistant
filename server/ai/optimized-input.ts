import type { WritingInput, WritingMode, WritingOperation } from "../../shared/types/writing.js";
import { DeepSeekClientError } from "./deepseek-client.js";

interface InputFieldDefinition {
  key: string;
  label: string;
}

interface InputDefinition {
  contentLabel: string;
  fields: InputFieldDefinition[];
}

const MODE_INPUT_DEFINITIONS: Record<WritingMode, InputDefinition> = {
  continue: { contentLabel: "已有内容", fields: [{ key: "direction", label: "续写方向（可选）" }] },
  rewrite: { contentLabel: "原始内容", fields: [{ key: "tone", label: "改写要求（可选）" }] },
  expand: { contentLabel: "原始内容", fields: [{ key: "focus", label: "补充方向（可选）" }] },
  summarize: { contentLabel: "原始内容", fields: [{ key: "focus", label: "总结侧重点（可选）" }] },
  email: {
    contentLabel: "邮件目的与要点",
    fields: [
      { key: "recipient", label: "收件对象（可选）" },
      { key: "tone", label: "邮件语气（可选）" },
    ],
  },
  copywriting: {
    contentLabel: "产品或主题",
    fields: [
      { key: "audience", label: "目标受众（可选）" },
      { key: "platform", label: "发布平台（可选）" },
      { key: "sellingPoints", label: "核心卖点（可选）" },
    ],
  },
};

export function getOptimizedInputDefinition(mode: WritingOperation, original?: WritingInput): InputDefinition {
  if (mode !== "optimize") return MODE_INPUT_DEFINITIONS[mode];
  return {
    contentLabel: "主要内容",
    fields: Object.keys(original?.fields ?? {}).map((key) => ({ key, label: key })),
  };
}

export function parseOptimizedInput(mode: WritingOperation, raw: string, original: WritingInput): WritingInput {
  let payload: unknown;
  try {
    payload = JSON.parse(stripJsonFence(raw));
  } catch {
    throw new DeepSeekClientError("invalid-response", "模型未按输入字段格式返回", true);
  }

  if (!isObject(payload) || typeof payload.content !== "string" || !payload.content.trim()) {
    throw new DeepSeekClientError("invalid-response", "模型返回的主输入无效", true);
  }

  const returnedFields = isObject(payload.fields) ? payload.fields : {};
  const definition = getOptimizedInputDefinition(mode, original);
  const fields = Object.fromEntries(definition.fields.map(({ key }) => {
    const returnedValue = returnedFields[key];
    const value = typeof returnedValue === "string" && returnedValue.trim()
      ? returnedValue.trim()
      : original.fields[key] ?? "";
    return [key, value];
  }));

  return { content: payload.content.trim(), fields };
}

export function formatOptimizedInput(mode: WritingOperation, input: WritingInput): string {
  const definition = getOptimizedInputDefinition(mode, input);
  const sections = [
    { label: definition.contentLabel, value: input.content },
    ...definition.fields.map(({ key, label }) => ({ label, value: input.fields[key] ?? "" })),
  ];
  return sections.map(({ label, value }) => `${label}\n${value}`).join("\n\n");
}

function stripJsonFence(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
