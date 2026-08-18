import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/app-shell/app-shell";
import { WorkspaceProvider } from "@/context/workspace-context";
import { useWorkspace } from "@/hooks/use-workspace";
import { HistoryPage } from "@/pages/history-page";
import { WorkspacePage } from "@/pages/workspace-page";

export function App() {
  return (
    <WorkspaceProvider>
      <AppContent />
    </WorkspaceProvider>
  );
}

function AppContent() {
  const { activeMode, params, setActiveMode, updateParams, saveStatus } = useWorkspace();

  return (
    <AppShell
      activeMode={activeMode}
      params={params}
      onModeChange={setActiveMode}
      onParamsChange={updateParams}
      saveStatus={saveStatus}
    >
      <Routes>
        <Route path="/" element={<WorkspacePage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
