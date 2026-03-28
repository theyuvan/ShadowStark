import { Suspense } from "react";
import { ZKFlowBuilder } from "@/components/builder/ZKFlowBuilder";

export default function BuilderPage() {
  return (
    <main className="space-y-4 p-4">
      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted">Private Strategy Canvas</p>
            <h1 className="font-heading text-2xl font-semibold text-foreground">Build Private Strategy Flow</h1>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="rounded-md border border-cyan/30 bg-cyan/10 px-2 py-1 text-cyan">TEE REQUIRED</span>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-primary">ZK COMPILER READY</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-muted">Left Panel: ZK nodes + cost</div>
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-muted">Center Canvas: drag, connect, compile</div>
          <div className="rounded-lg border border-border bg-background px-3 py-2 text-muted">Right Panel: private/public config</div>
        </div>
      </section>

      <Suspense fallback={<div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">Loading builder...</div>}>
        <ZKFlowBuilder />
      </Suspense>

      <section className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted">
        Compile runs only for deposit-confirmed privOTC intents, requires wallet confirmation, writes proof artifacts to the local proofs folder, and then verifies.
      </section>
    </main>
  );
}
