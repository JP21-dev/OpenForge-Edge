"use client";

import { useEffect } from "react";
import { SessionHeader } from "@/components/SessionHeader";
import { ChatPanel } from "@/components/ChatPanel";
import { HudSidebar } from "@/components/HudSidebar";
import { IngestPanel } from "@/components/IngestPanel";
import { SchematicViewer } from "@/components/SchematicViewer";
import { loadReferences } from "@/components/HudPanels";
import { useRepairStore } from "@/store/useRepairStore";
import { api } from "@/lib/api";

export default function BenchPage() {
  const appMode = useRepairStore((s) => s.appMode);
  const deviceModel = useRepairStore((s) => s.deviceModel);
  const boardRevision = useRepairStore((s) => s.boardRevision);

  useEffect(() => {
    useRepairStore.persist.rehydrate();
    api
      .getMode()
      .then((m) => useRepairStore.getState().setAppMode(m.mode, m.loading))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadReferences();
  }, [deviceModel, boardRevision]);

  return (
    <div className="flex h-dvh flex-col">
      <SessionHeader />
      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">{appMode === "repair" ? <ChatPanel /> : <IngestPanel />}</main>
        <HudSidebar />
      </div>
      <SchematicViewer />
    </div>
  );
}
