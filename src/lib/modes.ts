import type { WritingMode } from "@shared/types/writing";

export interface AuxiliaryFieldConfig {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
}

export interface WritingModeConfig {
  id: WritingMode;
  label: string;
  inputLabel: string;
  inputPlaceholder: string;
  resultLabel: string;
  fields: AuxiliaryFieldConfig[];
}

export const WRITING_MODE_CONFIGS: Record<WritingMode, WritingModeConfig> = {
  continue: {
    id: "continue",
    label: "文章续写",
    inputLabel: "已有内容",
    inputPlaceholder: "粘贴需要继续创作的文章内容…",
    resultLabel: "续写结果",
    fields: [{ key: "direction", label: "续写方向（可选）", placeholder: "说明希望继续展开的方向", multiline: true }],
  },
  rewrite: {
    id: "rewrite",
    label: "内容改写",
    inputLabel: "原始内容",
    inputPlaceholder: "粘贴需要改写的内容…",
    resultLabel: "改写结果",
    fields: [{ key: "tone", label: "改写要求（可选）", placeholder: "例如：更简洁、正式、自然" }],
  },
  expand: {
    id: "expand",
    label: "内容扩展",
    inputLabel: "原始内容",
    inputPlaceholder: "粘贴需要扩展的内容…",
    resultLabel: "扩展结果",
    fields: [{ key: "focus", label: "补充方向（可选）", placeholder: "说明希望重点补充的信息", multiline: true }],
  },
  summarize: {
    id: "summarize",
    label: "内容总结",
    inputLabel: "原始内容",
    inputPlaceholder: "粘贴需要总结的内容…",
    resultLabel: "总结结果",
    fields: [{ key: "focus", label: "总结侧重点（可选）", placeholder: "例如：结论、行动项、关键数据" }],
  },
  email: {
    id: "email",
    label: "邮件撰写",
    inputLabel: "邮件目的与要点",
    inputPlaceholder: "说明这封邮件需要沟通的事项…",
    resultLabel: "邮件草稿",
    fields: [
      { key: "recipient", label: "收件对象（可选）", placeholder: "例如：客户、同事、招聘负责人" },
      { key: "tone", label: "邮件语气（可选）", placeholder: "例如：专业、友好、正式" },
    ],
  },
  copywriting: {
    id: "copywriting",
    label: "文案生成",
    inputLabel: "产品或主题",
    inputPlaceholder: "描述产品、活动或内容主题…",
    resultLabel: "文案结果",
    fields: [
      { key: "audience", label: "目标受众（可选）", placeholder: "描述希望触达的人群" },
      { key: "platform", label: "发布平台（可选）", placeholder: "例如：公众号、小红书、网站" },
      { key: "sellingPoints", label: "核心卖点（可选）", placeholder: "列出需要重点呈现的信息", multiline: true },
    ],
  },
};

export const WRITING_MODE_ORDER: WritingMode[] = [
  "continue",
  "rewrite",
  "expand",
  "summarize",
  "email",
  "copywriting",
];

