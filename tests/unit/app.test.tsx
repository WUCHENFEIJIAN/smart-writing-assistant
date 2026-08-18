import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app";
import { DRAFT_STORAGE_KEY } from "@/lib/storage/drafts";
import { HISTORY_STORAGE_KEY } from "@/lib/storage/history";
import { SETTINGS_STORAGE_KEY } from "@/lib/storage/settings";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const apiResponse = (contents: string[], requestedCount = contents.length) => ({
    requestId: crypto.randomUUID(),
    versions: contents.map((content) => ({ id: crypto.randomUUID(), content })),
    requestedCount,
    completedCount: contents.length,
    partial: contents.length !== requestedCount,
  });

  const optimizedApiResponse = (content: string, structuredInput: { content: string; fields: Record<string, string> }) => ({
    requestId: crypto.randomUUID(),
    versions: [{ id: crypto.randomUUID(), content, structuredInput }],
    requestedCount: 1,
    completedCount: 1,
    partial: false,
  });

  const historyRecord = (content: string, result: string) => {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      schemaVersion: 1,
      mode: "continue",
      input: { content, fields: { direction: "继续展开" } },
      params: { creativity: 0.5, targetLength: 500, versionCount: 1 },
      versions: [{ id: crypto.randomUUID(), content: result, source: "generated", createdAt: now, updatedAt: now }],
      createdAt: now,
      updatedAt: now,
    } as const;
  };

  it("renders the writing workspace entry", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "已有内容" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "写作模式" })).toBeInTheDocument();
  });

  it("places rewrite, re-optimize, generate, and copy actions in the requested order", () => {
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    const inputActions = screen.getByTestId("input-actions");
    const inputText = inputActions.textContent ?? "";
    expect(inputText.indexOf("优化表达")).toBeLessThan(inputText.indexOf("再次优化"));
    expect(inputText.indexOf("再次优化")).toBeLessThan(inputText.indexOf("生成内容"));
    expect(within(inputActions).getByRole("button", { name: "再次优化" })).toBeDisabled();

    const resultActions = screen.getByTestId("result-actions");
    expect(within(resultActions).getByRole("button", { name: "复制" })).toBeInTheDocument();
    expect(within(resultActions).queryByRole("button", { name: "再次优化" })).not.toBeInTheDocument();
  });

  it("keeps desktop history in the sidebar and out of the desktop toolbar", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const sidebar = screen.getByTestId("desktop-sidebar");
    const desktopToolbar = screen.getByTestId("desktop-toolbar");
    const mobileToolbar = screen.getByTestId("mobile-toolbar");
    expect(within(sidebar).getByRole("link", { name: "历史记录" })).toBeInTheDocument();
    expect(within(desktopToolbar).queryByRole("link", { name: "历史记录" })).not.toBeInTheDocument();
    expect(within(mobileToolbar).getByRole("link", { name: "历史记录" })).toBeInTheDocument();
  });

  it("exposes the current mode and all parameters in the requested top-bar order", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const toolbar = screen.getByTestId("desktop-inline-parameters");
    const content = toolbar.textContent ?? "";
    expect(within(toolbar).getByLabelText("当前模式：文章续写")).toBeInTheDocument();
    expect(content.indexOf("文章续写")).toBeLessThan(content.indexOf("创意度"));
    expect(content.indexOf("创意度")).toBeLessThan(content.indexOf("输出长度"));
    expect(content.indexOf("输出长度")).toBeLessThan(content.indexOf("生成版本"));
    expect(within(toolbar).getByRole("slider", { name: "创意度" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("spinbutton", { name: "输出长度" })).toBeInTheDocument();
    expect(within(toolbar).getByLabelText("生成版本数量")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "参数调节" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "参数调节" })).not.toBeInTheDocument();
  });

  it("navigates to the history empty state", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(within(screen.getByTestId("desktop-sidebar")).getByRole("link", { name: "历史记录" }));
    expect(screen.getByRole("heading", { name: "暂无历史记录" })).toBeInTheDocument();
  });

  it("renders mode-specific fields and preserves independent drafts", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.type(screen.getByRole("textbox", { name: "已有内容" }), "续写草稿");
    await user.click(screen.getByRole("button", { name: /邮件撰写/ }));
    expect(screen.getByRole("heading", { name: "邮件目的与要点" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "收件对象（可选）" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "邮件目的与要点" }), "邮件草稿");

    await user.click(screen.getByRole("button", { name: /文章续写/ }));
    expect(screen.getByRole("textbox", { name: "已有内容" })).toHaveValue("续写草稿");
    await user.click(screen.getByRole("button", { name: /邮件撰写/ }));
    expect(screen.getByRole("textbox", { name: "邮件目的与要点" })).toHaveValue("邮件草稿");
  });

  it("persists draft content after the debounce window", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    await user.type(screen.getByRole("textbox", { name: "已有内容" }), "需要保存的草稿");
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toContain("需要保存的草稿");
  });

  it("uses the confirmed parameter defaults and enforces boundaries", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    const parameters = within(screen.getByTestId("desktop-inline-parameters"));
    expect(parameters.getByRole("slider", { name: "创意度" })).toHaveValue("0.5");
    expect(parameters.getByRole("spinbutton", { name: "输出长度" })).toHaveValue(500);
    expect(parameters.getByLabelText("生成版本数量")).toHaveTextContent("1");

    const increase = parameters.getByRole("button", { name: "增加生成版本" });
    for (let index = 0; index < 9; index += 1) await user.click(increase);
    expect(parameters.getByLabelText("生成版本数量")).toHaveTextContent("10");
    expect(increase).toBeDisabled();

    const length = parameters.getByRole("spinbutton", { name: "输出长度" });
    await user.clear(length);
    await user.type(length, "99");
    expect(length).toHaveAttribute("aria-invalid", "true");
    expect(parameters.getByRole("alert")).toHaveTextContent("请输入 100–5000 之间的整数");
    await user.tab();
    expect(length).toHaveValue(500);
  });

  it("generates multiple versions and saves one history record", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(apiResponse(["版本甲", "版本乙", "版本丙"])), { status: 200 })));
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    await user.type(screen.getByRole("textbox", { name: "已有内容" }), "需要续写的正文");
    const parameters = within(screen.getByTestId("desktop-inline-parameters"));
    const increase = parameters.getByRole("button", { name: "增加生成版本" });
    await user.click(increase);
    await user.click(increase);
    await user.click(screen.getByRole("button", { name: "生成内容" }));

    expect(await screen.findByRole("document", { name: "生成结果预览" })).toHaveTextContent("版本甲");
    expect(screen.getByRole("tab", { name: "版本 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "版本 2" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "版本 3" })).toBeInTheDocument();
    const history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]");
    expect(history).toHaveLength(1);
    expect(history[0].versions).toHaveLength(3);
  });

  it("keeps a history quota warning after a later draft save succeeds", async () => {
    const user = userEvent.setup();
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function setItem(this: Storage, key, value) {
      if (key === HISTORY_STORAGE_KEY) throw new DOMException("Storage full", "QuotaExceededError");
      return originalSetItem.call(this, key, value);
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(apiResponse(["生成内容"])), { status: 200 })));
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);

    await user.type(screen.getByRole("textbox", { name: "已有内容" }), "触发历史存储失败");
    await user.click(screen.getByRole("button", { name: "生成内容" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("本地存储空间不足");

    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(screen.getByRole("alert")).toHaveTextContent("本地存储空间不足");
  });

  it("re-optimizes a structured optimization without replacing its first version", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(optimizedApiResponse(
        "已有内容\n第一版优化",
        { content: "第一版优化", fields: { direction: "" } },
      )), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(optimizedApiResponse(
        "已有内容\n第二版优化",
        { content: "第二版优化", fields: { direction: "" } },
      )), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    await user.type(screen.getByRole("textbox", { name: "已有内容" }), "需要处理的正文");
    await user.click(screen.getByRole("button", { name: "优化表达" }));
    const result = await screen.findByRole("document", { name: "生成结果预览" });
    expect(result).toHaveTextContent("第一版优化");
    const reoptimize = screen.getByRole("button", { name: "再次优化" });
    expect(reoptimize).toBeEnabled();
    await user.click(reoptimize);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await vi.waitFor(() => expect(screen.getByRole("document", { name: "生成结果预览" })).toHaveTextContent("第二版优化"));
    expect(screen.getByRole("tab", { name: "优化 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "优化 2" })).toBeInTheDocument();
    const history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]");
    expect(history[0].versions.map((version: { structuredInput?: { content: string } }) => version.structuredInput?.content)).toEqual(["第一版优化", "第二版优化"]);
  });

  it("keeps input after an API error and succeeds on retry", async () => {
    const user = userEvent.setup();
    const errorBody = { requestId: crypto.randomUUID(), code: "UPSTREAM_TIMEOUT", message: "模型响应超时，请重试", retryable: true };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(errorBody), { status: 502 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(apiResponse(["重试成功"])), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    const input = screen.getByRole("textbox", { name: "已有内容" });
    await user.type(input, "不能丢失的输入");
    await user.click(screen.getByRole("button", { name: "生成内容" }));
    expect(await screen.findByText("模型响应超时，请重试")).toBeInTheDocument();
    expect(input).toHaveValue("不能丢失的输入");
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByRole("document", { name: "生成结果预览" })).toHaveTextContent("重试成功");
  });

  it("persists edits to a generated version", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(apiResponse(["生成内容"])), { status: 200 })));
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    await user.type(screen.getByRole("textbox", { name: "已有内容" }), "原始输入");
    await user.click(screen.getByRole("button", { name: "生成内容" }));
    await screen.findByRole("document", { name: "生成结果预览" });
    await user.click(screen.getByRole("button", { name: "编辑生成结果" }));
    const result = screen.getByRole("textbox", { name: "生成结果内容" });
    await user.clear(result);
    await user.type(result, "用户编辑后的内容");
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toContain("用户编辑后的内容");
  });

  it("focuses and edits the active result inside the result card", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(apiResponse(["可编辑的生成内容"])), { status: 200 })));
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    await user.type(screen.getByRole("textbox", { name: "已有内容" }), "用于生成的原始输入");
    await user.click(screen.getByRole("button", { name: "生成内容" }));
    await screen.findByRole("document", { name: "生成结果预览" });
    await user.click(screen.getByRole("button", { name: "编辑生成结果" }));
    const result = screen.getByRole("textbox", { name: "生成结果内容" });
    expect(result).toHaveFocus();
    await user.clear(result);
    await user.type(result, "在结果卡片内完成编辑");
    await new Promise((resolve) => setTimeout(resolve, 350));

    expect(result).toHaveValue("在结果卡片内完成编辑");
    expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toContain("在结果卡片内完成编辑");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders Markdown safely and returns to preview after editing", async () => {
    const user = userEvent.setup();
    const markdown = [
      "# 发布方案",
      "",
      "- 第一项",
      "- **第二项**",
      "",
      "| 平台 | 状态 |",
      "| --- | --- |",
      "| 官网 | 就绪 |",
      "",
      "[查看详情](https://example.com)",
      "",
      "<script>window.__unsafe = true</script>",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(apiResponse([markdown])), { status: 200 })));
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);

    await user.type(screen.getByRole("textbox", { name: "已有内容" }), "生成 Markdown 内容");
    await user.click(screen.getByRole("button", { name: "生成内容" }));

    const preview = await screen.findByRole("document", { name: "生成结果预览" });
    expect(within(preview).getByRole("heading", { name: "发布方案", level: 1 })).toBeInTheDocument();
    expect(within(preview).getByRole("list")).toBeInTheDocument();
    expect(within(preview).getByRole("table")).toBeInTheDocument();
    expect(within(preview).getByRole("link", { name: "查看详情" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(preview.querySelector("script")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "编辑生成结果" }));
    const editor = screen.getByRole("textbox", { name: "生成结果内容" });
    expect(editor).toHaveFocus();
    await user.clear(editor);
    await user.type(editor, "## 更新后的标题");
    await user.click(screen.getByRole("button", { name: "完成编辑生成结果" }));

    expect(screen.getByRole("heading", { name: "更新后的标题", level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "生成结果内容" })).not.toBeInTheDocument();
  });

  it("optimizes input without replacing the original text", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(optimizedApiResponse(
      "已有内容\n优化后的表达\n\n续写方向（可选）\n",
      { content: "优化后的表达", fields: { direction: "" } },
    )), { status: 200 })));
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    const input = screen.getByRole("textbox", { name: "已有内容" });
    await user.type(input, "需要保留的原文");
    await user.click(screen.getByRole("button", { name: "优化表达" }));
    expect(await screen.findByRole("document", { name: "生成结果预览" })).toHaveTextContent("优化后的表达");
    expect(input).toHaveValue("需要保留的原文");
    expect(screen.getByRole("button", { name: "一键填入" })).toBeInTheDocument();
    const history = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]");
    expect(history[0].mode).toBe("optimize");
  });

  it("only shows one-click fill for optimized results and fills the input", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(apiResponse(["普通生成版本"])), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(optimizedApiResponse(
        "已有内容\n优化后的输入\n\n续写方向（可选）\n优化后的方向",
        { content: "优化后的输入", fields: { direction: "优化后的方向" } },
      )), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    const input = screen.getByRole("textbox", { name: "已有内容" });
    await user.type(input, "原始输入内容");
    await user.click(screen.getByRole("button", { name: "生成内容" }));
    expect(await screen.findByRole("document", { name: "生成结果预览" })).toHaveTextContent("普通生成版本");

    expect(screen.queryByRole("button", { name: "一键填入" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再次优化" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "优化表达" }));
    expect(await screen.findByRole("document", { name: "生成结果预览" })).toHaveTextContent("优化后的输入");
    await user.click(screen.getByRole("button", { name: "一键填入" }));

    expect(input).toHaveValue("优化后的输入");
    expect(screen.getByRole("textbox", { name: "续写方向（可选）" })).toHaveValue("优化后的方向");
    expect(screen.getByText("已填入输入区")).toBeInTheDocument();
  });

  it("intelligently fills every copywriting value into its matching input", async () => {
    const user = userEvent.setup();
    const structuredInput = {
      content: "轻量便携咖啡机",
      fields: { audience: "忙碌的通勤上班族", platform: "小红书", sellingPoints: "轻巧便携，快速萃取" },
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(optimizedApiResponse(
      "产品或主题\n轻量便携咖啡机\n\n目标受众（可选）\n忙碌的通勤上班族\n\n发布平台（可选）\n小红书\n\n核心卖点（可选）\n轻巧便携，快速萃取",
      structuredInput,
    )), { status: 200 })));
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    await user.click(screen.getByRole("button", { name: /文案生成/ }));
    await user.type(screen.getByRole("textbox", { name: "产品或主题" }), "便携咖啡机");
    await user.type(screen.getByRole("textbox", { name: "目标受众（可选）" }), "上班族");
    await user.type(screen.getByRole("textbox", { name: "发布平台（可选）" }), "小红书");
    await user.type(screen.getByRole("textbox", { name: "核心卖点（可选）" }), "轻巧、快速");
    await user.click(screen.getByRole("button", { name: "优化表达" }));
    expect(await screen.findByRole("document", { name: "生成结果预览" })).toHaveTextContent("轻量便携咖啡机");
    await user.click(screen.getByRole("button", { name: "一键填入" }));

    expect(screen.getByRole("textbox", { name: "产品或主题" })).toHaveValue("轻量便携咖啡机");
    expect(screen.getByRole("textbox", { name: "目标受众（可选）" })).toHaveValue("忙碌的通勤上班族");
    expect(screen.getByRole("textbox", { name: "发布平台（可选）" })).toHaveValue("小红书");
    expect(screen.getByRole("textbox", { name: "核心卖点（可选）" })).toHaveValue("轻巧便携，快速萃取");
  });

  it("sends copywriting fields when optimizing in copywriting mode", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      void _url;
      void _init;
      return new Response(JSON.stringify(optimizedApiResponse(
        "产品或主题\n便携咖啡机\n\n目标受众（可选）\n上班族",
        { content: "便携咖啡机", fields: { audience: "上班族", platform: "小红书", sellingPoints: "轻巧、快速" } },
      )), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: /文案生成/ }));
    await user.type(screen.getByRole("textbox", { name: "产品或主题" }), "便携咖啡机");
    await user.type(screen.getByRole("textbox", { name: "目标受众（可选）" }), "上班族");
    await user.type(screen.getByRole("textbox", { name: "发布平台（可选）" }), "小红书");
    await user.type(screen.getByRole("textbox", { name: "核心卖点（可选）" }), "轻巧、快速");
    await user.click(screen.getByRole("button", { name: "优化表达" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      mode: "copywriting",
      fields: { audience: "上班族", platform: "小红书", sellingPoints: "轻巧、快速" },
    });
  });

  it("copies the active version and announces success", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(apiResponse(["待复制内容"])), { status: 200 })));
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    await user.type(screen.getByRole("textbox", { name: "已有内容" }), "原始输入");
    await user.click(screen.getByRole("button", { name: "生成内容" }));
    expect(await screen.findByRole("document", { name: "生成结果预览" })).toHaveTextContent("待复制内容");
    await user.click(screen.getByRole("button", { name: "复制" }));
    expect(writeText).toHaveBeenCalledWith("待复制内容");
    expect(screen.getByText("已复制到剪贴板")).toBeInTheDocument();
  });

  it("cancels an in-flight request without clearing the input", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn((_url: string | URL | Request, options?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    ));
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    const input = screen.getByRole("textbox", { name: "已有内容" });
    await user.type(input, "取消后仍需保留");
    await user.click(screen.getByRole("button", { name: "生成内容" }));
    expect(await screen.findByRole("button", { name: "取消" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(input).toHaveValue("取消后仍需保留");
    expect(await screen.findByText("暂无生成结果")).toBeInTheDocument();
  });

  it("shows history details and reuses a record without sending a request", async () => {
    const user = userEvent.setup();
    const record = historyRecord("历史输入正文", "历史生成结果");
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([record]));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/history"]}><App /></MemoryRouter>);

    expect(screen.getByText("历史生成结果")).toBeInTheDocument();
    expect(screen.getByText("继续展开")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新使用" }));
    expect(screen.getByRole("textbox", { name: "已有内容" })).toHaveValue("历史输入正文");
    expect(screen.getByRole("document", { name: "生成结果预览" })).toHaveTextContent("历史生成结果");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires confirmation and deletes only the selected record", async () => {
    const user = userEvent.setup();
    const first = historyRecord("第一条输入", "第一条结果");
    const second = historyRecord("第二条输入", "第二条结果");
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([first, second]));
    render(<MemoryRouter initialEntries={["/history"]}><App /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "删除这条记录" }));
    expect(screen.getByRole("dialog", { name: "删除这条历史记录？" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "删除这条记录" }));
    await user.click(within(screen.getByRole("dialog", { name: "删除这条历史记录？" })).getByRole("button", { name: "删除" }));
    const remaining = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(second.id);
  });

  it("requires strengthened acknowledgement before clearing all history", async () => {
    const user = userEvent.setup();
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([historyRecord("第一条", "结果一"), historyRecord("第二条", "结果二")]));
    render(<MemoryRouter initialEntries={["/history"]}><App /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: "清空全部" }));
    const dialog = screen.getByRole("dialog", { name: "清空全部历史记录？" });
    const confirm = within(dialog).getByRole("button", { name: "永久清空" });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: "我确认这些记录无需保留" }));
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(screen.getByRole("heading", { name: "暂无历史记录" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) ?? "[]")).toEqual([]);
  });

  it("synchronizes drafts and parameters changed in another browser tab", async () => {
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    const now = new Date().toISOString();
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      drafts: { continue: { input: { content: "其他标签页的草稿", fields: {} }, updatedAt: now } },
    }));
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      activeMode: "continue",
      params: { creativity: 0.8, targetLength: 1_200, versionCount: 3 },
    }));

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: DRAFT_STORAGE_KEY }));
      window.dispatchEvent(new StorageEvent("storage", { key: SETTINGS_STORAGE_KEY }));
    });

    expect(screen.getByRole("textbox", { name: "已有内容" })).toHaveValue("其他标签页的草稿");
    const parameters = within(screen.getByTestId("desktop-inline-parameters"));
    expect(parameters.getByRole("slider", { name: "创意度" })).toHaveValue("0.8");
    expect(parameters.getByRole("spinbutton", { name: "输出长度" })).toHaveValue(1_200);
    expect(parameters.getByLabelText("生成版本数量")).toHaveTextContent("3");
  });

  it("updates an open history page when another tab changes history", () => {
    render(<MemoryRouter initialEntries={["/history"]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "暂无历史记录" })).toBeInTheDocument();
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify([historyRecord("跨标签输入", "跨标签结果")]));

    act(() => window.dispatchEvent(new StorageEvent("storage", { key: HISTORY_STORAGE_KEY })));

    expect(screen.getByText("跨标签结果")).toBeInTheDocument();
  });

  it("shows a recoverable warning when stored history is corrupt", () => {
    localStorage.setItem(HISTORY_STORAGE_KEY, "{invalid-json");
    render(<MemoryRouter initialEntries={["/history"]}><App /></MemoryRouter>);
    expect(screen.getByRole("alert")).toHaveTextContent("部分本地历史数据已损坏");
    expect(localStorage.getItem(HISTORY_STORAGE_KEY)).toBe("{invalid-json");
  });

  it("supports keyboard changes on the exposed parameter controls", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    const parameters = within(screen.getByTestId("desktop-inline-parameters"));
    const increase = parameters.getByRole("button", { name: "增加生成版本" });
    increase.focus();
    await user.keyboard("{Enter}");
    expect(parameters.getByLabelText("生成版本数量")).toHaveTextContent("2");
  });
});
