"use client";

import { useEffect } from "react";
import { SessionHeader } from "@/components/SessionHeader";
import { ChatPanel } from "@/components/ChatPanel";
import { HudSidebar } from "@/components/HudSidebar";
import { useRepairStore } from "@/store/useRepairStore";

export default function BenchPage() {
  useEffect(() => {
    useRepairStore.persist.rehydrate();
  }, []);

  return (
    <div className="flex h-dvh flex-col">
      <SessionHeader />
      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <ChatPanel />
        </main>
        <HudSidebar />
      </div>
    </div>
  );
}
