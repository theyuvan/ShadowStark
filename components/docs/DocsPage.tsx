"use client";

export function DocsPage() {
  const sections = [
    "Getting Started",
    "Builder",
    "ZK Proofs",
    "TEE",
    "Starknet",
    "Trading",
  ];

  return (
    <section className="grid gap-6 p-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="h-fit rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-24">
        <p className="mb-3 text-[11px] uppercase tracking-[0.2em] text-muted">Documentation</p>
        <nav className="space-y-2 text-sm">
          {sections.map((name) => {
            const id = name.toLowerCase().replace(/\s+/g, "-");
            return (
              <a
                key={name}
                href={`#${id}`}
                className="block rounded-md px-2 py-1 text-secondary transition-colors hover:bg-elevated hover:text-foreground"
              >
                {name}
              </a>
            );
          })}
        </nav>
      </aside>

      <article className="space-y-6">
        <header className="rounded-xl border border-border bg-surface p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">ShadowFlowBTC++</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold text-foreground">Developer Docs</h1>
          <p className="mt-2 text-sm text-secondary">
            Build private BTC strategies, prove correctness with ZK, and verify outcomes on Starknet.
          </p>
        </header>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-heading text-xl font-semibold">What to do on each page</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-secondary">
            <li><span className="text-foreground">Builder:</span> Create graph nodes and click <span className="font-code text-foreground">Compile to ZK (Wallet Confirm)</span>.</li>
            <li><span className="text-foreground">Simulate:</span> Inspect generated proof, nullifier state, Merkle root, and TEE attestation.</li>
            <li><span className="text-foreground">Trades:</span> Submit BUY/SELL intents and monitor proof-linked execution logs.</li>
            <li><span className="text-foreground">Dashboard:</span> Review global strategy and verification health metrics.</li>
            <li><span className="text-foreground">Docs:</span> Keep RPC/env settings aligned with Sepolia deployment addresses.</li>
          </ol>
        </section>

        <section id="getting-started" className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-heading text-xl font-semibold">Getting Started</h2>
          <div className="mt-3 rounded-lg border border-border bg-background/50 p-3 text-xs font-code text-cyan-400">
            npm install{"\n"}
            npm run dev
          </div>
          <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-secondary">
            Set <span className="font-code text-foreground">NEXT_PUBLIC_STARKNET_NETWORK=sepolia</span> and a valid RPC URL in
            <span className="font-code text-foreground"> .env.local</span>.
          </div>
        </section>

        <section id="builder" className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-heading text-xl font-semibold">Builder</h2>
          <p className="mt-2 text-sm text-secondary">
            Connect nodes in this order: <span className="text-cyan-400">Condition</span> → <span className="text-amber-400">Split</span>
            → <span className="text-emerald-400">Execute</span> → <span className="text-violet-400">Constraint</span>.
          </p>
          <div className="mt-3 rounded-lg border border-border bg-background/50 p-3 text-xs font-code text-cyan-400">
            {`const rule = "condition->split->execute->constraint";`}
          </div>
        </section>

        <section id="zk-proofs" className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-heading text-xl font-semibold">ZK Proofs</h2>
          <p className="mt-2 text-sm text-secondary">
            Public outputs include commitment, nullifier, merkle root, and final state hash. Private witness values stay local.
          </p>
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-secondary">
            PRIVATE fields must stay redacted as <span className="font-code text-red-400">████</span> in all UI surfaces.
          </div>
        </section>

        <section id="tee" className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-heading text-xl font-semibold">TEE</h2>
          <p className="mt-2 text-sm text-secondary">
            Attestation tracks enclave type, measurement hash, and validity before proof verification.
          </p>
        </section>

        <section id="starknet" className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-heading text-xl font-semibold">Starknet</h2>
          <p className="mt-2 text-sm text-secondary">Contracts store commitments, nullifier spend state, and proof verification results.</p>
          <div className="mt-3 rounded-lg border border-border bg-background/50 p-3 text-xs font-code text-cyan-400">
            verify_and_store(proof_hash, public_inputs_hash, final_state_hash, nullifier)
          </div>
        </section>

        <section id="trading" className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-heading text-xl font-semibold">Trading</h2>
          <p className="mt-2 text-sm text-secondary">
            Active, pending, and completed strategies are tracked with commitment IDs and proof statuses.
          </p>
          <p className="mt-2 text-xs text-muted">Use the Trades panel to create template-based executions quickly.</p>
        </section>
      </article>
    </section>
  );
}
