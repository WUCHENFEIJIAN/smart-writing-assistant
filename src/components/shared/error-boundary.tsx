import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch() {
    // Deliberately omit the error payload because it may contain user text.
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--color-canvas)] p-6">
        <section className="w-full max-w-md rounded-lg border border-[var(--color-separator)] bg-white p-6 text-center shadow-[0_12px_36px_rgb(0_0_0/10%)]" role="alert">
          <AlertCircle aria-hidden="true" className="mx-auto mb-3 text-[var(--color-danger)]" size={26} />
          <h1 className="text-base font-semibold">页面暂时无法显示</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">当前草稿仍保存在此浏览器中。重新载入页面即可继续。</p>
          <button type="button" onClick={() => window.location.reload()} className="primary-button mt-5">
            <RefreshCw aria-hidden="true" size={15} />重新载入
          </button>
        </section>
      </main>
    );
  }
}
