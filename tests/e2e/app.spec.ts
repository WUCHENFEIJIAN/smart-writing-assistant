import { expect, test, type Page, type Route } from "@playwright/test";

interface MockOptions {
  failFirst?: boolean;
  partial?: boolean;
  delayMs?: number;
}

async function mockWritingApi(page: Page, options: MockOptions = {}) {
  let generationCalls = 0;
  let optimizeCalls = 0;
  await page.route("**/api/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const requestBody = route.request().postDataJSON() as {
      mode?: string;
      content?: string;
      fields?: Record<string, string>;
      params?: { versionCount?: number };
    };
    if (url.pathname === "/api/generate") {
      generationCalls += 1;
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      if (options.failFirst && generationCalls === 1) {
        await route.fulfill({
          status: 502,
          contentType: "application/json",
          body: JSON.stringify({ requestId: "00000000-0000-4000-8000-000000000099", code: "UPSTREAM_TIMEOUT", message: "模型响应超时，请重试", retryable: true }),
        });
        return;
      }
      const requestedCount = requestBody.params?.versionCount ?? 1;
      const completedCount = options.partial ? Math.max(1, requestedCount - 1) : requestedCount;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "00000000-0000-4000-8000-000000000098",
          versions: Array.from({ length: completedCount }, (_, index) => ({
            id: `00000000-0000-4000-8000-${String(generationCalls * 100 + index).padStart(12, "0")}`,
            content: `生成版本 ${index + 1}`,
          })),
          requestedCount,
          completedCount,
          partial: completedCount !== requestedCount,
        }),
      });
      return;
    }
    if (url.pathname === "/api/optimize") {
      optimizeCalls += 1;
      const optimizedContent = optimizeCalls === 1 ? "优化后的专业表达" : "再次优化后的专业表达";
      const structuredInput = {
        content: optimizedContent,
        fields: { direction: requestBody.fields?.direction || "清晰说明后续方向" },
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          requestId: "00000000-0000-4000-8000-000000000097",
          versions: [{
            id: `00000000-0000-4000-8000-${String(9_000 + optimizeCalls).padStart(12, "0")}`,
            content: `已有内容\n${structuredInput.content}\n\n续写方向（可选）\n${structuredInput.fields.direction}`,
            structuredInput,
          }],
          requestedCount: 1,
          completedCount: 1,
          partial: false,
        }),
      });
      return;
    }
    await route.fulfill({ status: 404 });
  });
  return { getGenerationCalls: () => generationCalls };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("generates, optimizes, re-optimizes, and intelligently fills structured input", async ({ page }) => {
  await mockWritingApi(page);
  await page.getByRole("textbox", { name: "已有内容" }).fill("这是需要续写并保留的正文。");
  await page.getByRole("button", { name: "增加生成版本" }).click();
  await page.getByRole("button", { name: "增加生成版本" }).click();
  await page.getByRole("button", { name: "生成内容" }).click();

  const preview = page.getByRole("document", { name: "生成结果预览" });
  await expect(preview).toContainText("生成版本 1");
  await expect(page.getByRole("tab", { name: "版本 3" })).toBeVisible();
  await page.getByRole("button", { name: "编辑生成结果" }).click();
  const output = page.getByRole("textbox", { name: "生成结果内容" });
  await output.fill("用户编辑后的版本");
  await page.getByRole("button", { name: "完成编辑生成结果" }).click();
  await page.waitForTimeout(350);
  const inputTabBeforeOptimize = page.getByRole("tab", { name: "输入" });
  if (await inputTabBeforeOptimize.isVisible()) await inputTabBeforeOptimize.click();
  await expect(page.getByRole("button", { name: "再次优化" })).toBeDisabled();
  await page.getByRole("button", { name: "优化表达" }).click();
  await expect(preview).toContainText("优化后的专业表达");
  if (await inputTabBeforeOptimize.isVisible()) await inputTabBeforeOptimize.click();
  await page.getByRole("button", { name: "再次优化" }).click();
  await expect(preview).toContainText("再次优化后的专业表达");
  await expect(page.getByRole("tab", { name: "优化 2" })).toBeVisible();
  await page.getByRole("button", { name: "一键填入" }).click();
  await expect(page.getByRole("textbox", { name: "已有内容" })).toHaveValue("再次优化后的专业表达");
  await expect(page.getByRole("textbox", { name: "续写方向（可选）" })).toHaveValue("清晰说明后续方向");

  await page.getByRole("link", { name: "历史记录" }).click();
  const latestRecord = page.getByRole("button", { name: /打开历史记录/ }).first();
  if (await latestRecord.isVisible()) {
    await latestRecord.click();
  }
  await page.getByRole("tab", { name: "优化 2" }).click();
  await expect(page.getByText(/再次优化后的专业表达/)).toBeVisible();
  await page.getByRole("button", { name: "重新使用" }).click();
  await expect(page.getByRole("textbox", { name: "已有内容" })).toHaveValue("这是需要续写并保留的正文。");
  const resultTab = page.getByRole("tab", { name: "结果" });
  if (await resultTab.isVisible()) await resultTab.click();
  await expect(page.getByRole("document", { name: "生成结果预览" })).toContainText("优化后的专业表达");
});

test("keeps input through a timeout and retries successfully", async ({ page }) => {
  const api = await mockWritingApi(page, { failFirst: true });
  const input = page.getByRole("textbox", { name: "已有内容" });
  await input.fill("网络错误时不能丢失的输入");
  await page.getByRole("button", { name: "生成内容" }).click();
  await expect(page.getByText("模型响应超时，请重试")).toBeVisible();
  const inputTab = page.getByRole("tab", { name: "输入" });
  const hasMobilePanels = await inputTab.isVisible();
  if (hasMobilePanels) {
    await inputTab.click();
    await expect(page.getByRole("textbox", { name: "已有内容" })).toHaveValue("网络错误时不能丢失的输入");
    await page.getByRole("tab", { name: "结果" }).click();
  } else {
    await expect(input).toHaveValue("网络错误时不能丢失的输入");
  }
  await page.getByRole("button", { name: "重试" }).click();
  await expect(page.getByRole("document", { name: "生成结果预览" })).toContainText("生成版本 1");
  expect(api.getGenerationCalls()).toBe(2);
});

test("rotates the generation indicator while waiting", async ({ page }) => {
  await mockWritingApi(page, { delayMs: 1_000 });
  await page.getByRole("textbox", { name: "已有内容" }).fill("检查生成等待动画");
  await page.getByRole("button", { name: "生成内容" }).click();
  const spinner = page.getByTestId("generation-spinner");
  await expect(spinner).toBeVisible();
  const firstTransform = await spinner.evaluate((element) => getComputedStyle(element).transform);
  await page.waitForTimeout(220);
  const secondTransform = await spinner.evaluate((element) => getComputedStyle(element).transform);
  expect(firstTransform).not.toBe("none");
  expect(secondTransform).not.toBe(firstTransform);
  await expect(page.getByRole("document", { name: "生成结果预览" })).toContainText("生成版本 1");
});

test("shows partial generation and local storage quota warnings", async ({ page }) => {
  await page.evaluate(() => {
    const historyKey = "smart-writer:history:v1";
    const storagePrototype = Object.getPrototypeOf(localStorage) as Storage;
    const originalSetItem = storagePrototype.setItem;
    Object.defineProperty(storagePrototype, "setItem", {
      configurable: true,
      writable: true,
      value(this: Storage, key: string, value: string) {
        if (key === historyKey) throw new DOMException("Storage full", "QuotaExceededError");
        return originalSetItem.call(this, key, value);
      },
    });

    try {
      localStorage.setItem(historyKey, "quota-probe");
      throw new Error("LocalStorage quota fault injection was not installed");
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "QuotaExceededError") throw error;
    }
  });
  await mockWritingApi(page, { partial: true });
  await page.getByRole("textbox", { name: "已有内容" }).fill("测试部分成功和本地空间不足");
  await page.getByRole("button", { name: "增加生成版本" }).click();
  await page.getByRole("button", { name: "增加生成版本" }).click();
  await page.getByRole("button", { name: "生成内容" }).click();
  await expect(page.getByText("已生成 2/3 个版本")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("本地存储空间不足");
  await expect(page.getByRole("document", { name: "生成结果预览" })).toContainText("生成版本 1");
});

test("has no viewport overflow or duplicate desktop history action", async ({ page }, testInfo) => {
  const desktopParameterBar = page.getByTestId("desktop-inline-parameters");
  const visibleParameterBar = await desktopParameterBar.isVisible()
    ? desktopParameterBar
    : page.getByTestId("mobile-inline-parameters");
  await expect(visibleParameterBar.getByLabel("生成参数")).toBeVisible();
  await expect(visibleParameterBar.getByRole("button", { name: "增加生成版本" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "参数调节" })).toHaveCount(0);
  const measurements = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    height: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(measurements.scrollWidth).toBeLessThanOrEqual(measurements.width);
  expect(measurements.scrollHeight).toBeLessThanOrEqual(measurements.height);

  const desktopToolbar = page.getByTestId("desktop-toolbar");
  if (await desktopToolbar.isVisible()) {
    await expect(desktopToolbar.getByRole("link", { name: "历史记录" })).toHaveCount(0);
  } else {
    await expect(page.getByTestId("mobile-toolbar").getByRole("link", { name: "历史记录" })).toBeVisible();
  }
  await page.screenshot({ path: testInfo.outputPath(`workspace-${testInfo.project.name}.png`) });
});

test("renders history detail without clipping", async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    localStorage.setItem("smart-writer:history:v1", JSON.stringify([{
      id: "00000000-0000-4000-8000-000000000010",
      schemaVersion: 1,
      mode: "continue",
      input: { content: "这是一段用于视觉验收的原始文章内容。", fields: { direction: "继续说明实际应用价值" } },
      params: { creativity: 0.5, targetLength: 500, versionCount: 2 },
      versions: [
        { id: "00000000-0000-4000-8000-000000000011", content: "这是第一版生成结果，用于检查历史详情的排版、留白和操作区域。", source: "generated", createdAt: now, updatedAt: now },
        { id: "00000000-0000-4000-8000-000000000012", content: "这是第二版生成结果。", source: "generated", createdAt: now, updatedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    }]));
  });
  await page.goto("/history");
  const recordButton = page.getByRole("button", { name: /打开历史记录/ });
  if (await recordButton.isVisible()) await recordButton.click();
  await expect(page.getByText("这是第一版生成结果，用于检查历史详情的排版、留白和操作区域。")).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight);
  await page.screenshot({ path: testInfo.outputPath(`history-${testInfo.project.name}.png`) });
});

test("keeps primary actions reachable during zoom acceptance", async ({ page }, testInfo) => {
  if (testInfo.project.name.startsWith("desktop")) {
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  }
  await expect(page.getByRole("button", { name: "生成内容" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
