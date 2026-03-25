export default function HomePage() {
  return (
    <main className="space-y-6 p-4">
      <section className="rounded-xl border border-border bg-surface p-4">
        <nav className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { label: "Home", href: "/" },
            { label: "About", href: "#about" },
            { label: "Builder", href: "/builder" },
            { label: "Trades", href: "/trades" },
            { label: "Dashboard", href: "/dashboard" },
            { label: "Simulate", href: "/simulate" },
            { label: "Docs", href: "/docs" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-md border border-border bg-background/40 px-3 py-1 text-secondary transition-colors hover:bg-elevated hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </section>

      <section className="relative overflow-hidden rounded-xl border border-border bg-surface p-8">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(99,102,241,0.4) 1px, transparent 0)", backgroundSize: "18px 18px" }} />
        <div className="relative">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">ShadowFlowBTC++</p>
          <h1 className="mt-2 font-heading text-4xl font-semibold leading-tight">
            <span className="text-foreground">Private Bitcoin Strategies.</span>{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Proven on Chain.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-secondary">
            Build strategy graphs, keep trade logic private, generate zero-knowledge proofs, and verify execution integrity on Starknet.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="/builder" className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90">Launch Builder</a>
            <a href="/docs" className="rounded-lg border border-border bg-elevated px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-background">Read Docs</a>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Privacy</p>
          <p className="mt-2 text-sm text-secondary">Execution witnesses never leave the client. Only commitments and proof outputs are public.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Integrity</p>
          <p className="mt-2 text-sm text-secondary">Nullifiers enforce replay protection while Merkle roots anchor deterministic state transitions.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Verification</p>
          <p className="mt-2 text-sm text-secondary">Proof checks finalize on Starknet contracts for auditable, tamper-resistant strategy outcomes.</p>
        </div>
      </section>

      <section id="about" className="rounded-xl border border-border bg-surface p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted">About</p>
        <p className="mt-2 text-sm text-secondary">
          ShadowFlowBTC++ is a production-focused OTC + intent execution workflow for BTC strategy automation with Starknet settlement.
          Wallet-connected users submit BUY/SELL intents, produce proofs through backend circuits, and finalize verification on-chain.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Flow Preview</p>
        <div className="mt-3 grid gap-3 md:grid-cols-6">
          {[
            "Input",
            "Commit",
            "Execute",
            "Prove",
            "Verify",
            "Finalize",
          ].map((stage) => (
            <div key={stage} className="rounded-lg border border-border bg-background/50 p-3 text-center text-xs font-code text-cyan-400">
              {stage}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
