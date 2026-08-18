# 智能写作助手

智能写作助手是一款面向内容创作者、职场人士和日常写作者的中文 AI 写作工具，适合在灵感不足、需要润色文章、整理长文、撰写邮件或生成社交平台文案时快速获得可编辑的内容。输入已有文字或一个主题，选择写作模式和期望长度，即可同时生成多个版本并继续优化。

## 可以用它做什么

| 使用场景 | 能力 |
| --- | --- |
| 写到一半没有思路 | 根据已有内容续写文章 |
| 表达不够清楚或自然 | 改写、扩展或总结内容 |
| 需要快速沟通 | 根据目的、对象和语气撰写邮件 |
| 运营社交媒体或推广产品 | 根据受众、平台和卖点生成文案 |

## 主要功能

- 文章续写、内容改写、内容扩展、内容总结、邮件撰写和文案生成六种模式。
- 自由调节创意度、目标长度和生成版本数量。
- 优化输入、比较多个版本、编辑结果和一键复制。
- 支持 Markdown 内容展示。
- 自动保存草稿、参数和历史记录。
- 适配桌面、平板和手机屏幕。

## 界面预览

<table>
  <tr>
    <td width="50%" align="center">
      <strong>文章续写</strong><br>
      <img src="docs/images/article-continuation.png" alt="文章续写界面">
    </td>
    <td width="50%" align="center">
      <strong>内容改写</strong><br>
      <img src="docs/images/content-rewrite.png" alt="内容改写界面">
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <strong>邮件撰写</strong><br>
      <img src="docs/images/email-writing.png" alt="邮件撰写界面">
    </td>
    <td width="50%" align="center">
      <strong>文案生成</strong><br>
      <img src="docs/images/copywriting.png" alt="文案生成界面">
    </td>
  </tr>
</table>

## 快速开始

本地运行需要 Node.js 20+、pnpm 10+ 和一个 [DeepSeek API Key](https://platform.deepseek.com/api_keys)。

### 1. 安装依赖

```powershell
pnpm install
Copy-Item .env.local.example .env.local
```

### 2. 配置 API Key

打开 `.env.local`，填入你的 Key：

```dotenv
DEEPSEEK_API_KEY=你的服务端密钥
```

### 3. 启动项目

```powershell
pnpm dev
```

启动成功后访问 `http://127.0.0.1:5173`，选择任意写作模式即可开始使用。本地 API 服务运行在 `http://127.0.0.1:8787`。

## 技术栈

- React + TypeScript + Vite
- Express + Zod
- DeepSeek API
- Vitest + Testing Library + Playwright
- pnpm

## API Key 与数据安全

- API Key 只由 Express 服务读取；`.env.local` 默认被 Git 忽略，不会进入浏览器代码。
- 草稿和历史记录只保存在当前浏览器中，服务端不保存用户正文。
- 不要使用 `VITE_` 前缀或把 Key 写入源码；如果 Key 曾被提交，请立即撤销并重新生成。

## 测试与构建

```powershell
pnpm test
pnpm build
```

测试默认使用模拟请求，不消耗 API 配额。生产构建会同时完成类型检查，并扫描浏览器代码中是否包含本地真实 Key。

## 常见故障排查

| 问题 | 处理方式 |
| --- | --- |
| 找不到 `pnpm` 命令 | 确认已安装 Node.js 20+，执行 `corepack enable` 后重新打开终端。 |
| 提示 `DEEPSEEK_API_KEY is required` | 确认项目根目录存在 `.env.local`，并且 `DEEPSEEK_API_KEY` 已填写；修改后重新启动项目。 |
| 页面可以打开，但生成时提示网络连接失败 | 确认 `pnpm dev` 启动的前后端进程都在运行，并访问 `http://127.0.0.1:8787/api/health`，正常时应返回 `{&quot;ok&quot;:true}`。 |
| 启动时提示端口 `8787` 被占用 | 关闭占用该端口的程序后重新执行 `pnpm dev`。开发环境的网页代理默认连接此端口。 |
| 提示模型服务不可用、超时或请求过于频繁 | 检查 Key 是否有效、账户余额和网络连接是否正常；遇到限流或超时时稍后重试。 |
| 草稿或历史记录消失 | 草稿和历史只保存在当前浏览器中；请使用相同浏览器和地址，并避免隐私模式或清除站点数据。 |
