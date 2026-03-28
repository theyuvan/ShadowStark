"use client";

import Link from "next/link";
import { ArrowLeftRight, BarChart3, BookOpen, Hexagon, Play, ShieldCheck, Workflow } from "lucide-react";
import { usePathname } from "next/navigation";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { TEEStatus } from "@/components/tee/TEEStatus";
import { useWalletStore } from "@/store/walletStore";

const links = [
  { href: "/builder", label: "ZK Builder", icon: Workflow },
  { href: "/simulate", label: "Simulate", icon: Play },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/trades", label: "My Trades", icon: ArrowLeftRight },
  { href: "/verify", label: "Proof Checker", icon: ShieldCheck },
  { href: "/docs", label: "Docs", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();
  const connected = useWalletStore((state) => state.connected);
  const teeEnabled = process.env.NEXT_PUBLIC_ENABLE_TEE !== "false";

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-[220px] border-r border-border bg-base">
      <div className="flex h-full flex-col p-3">
        <div className="mb-4 flex h-[60px] items-center justify-between border-b border-border px-1">
          <div className="flex items-center gap-2">
            <Hexagon className="h-5 w-5 text-primary" />
            <div>
              <p className="font-display text-sm font-semibold">ShadowFlow</p>
              <p className="font-code text-[11px] text-btc">BTC++</p>
            </div>
          </div>
          <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-secondary">v0.1 testnet</span>
        </div>

        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex h-11 items-center gap-2 rounded-md border-l-2 px-3 text-sm transition-colors ${
                  active
                    ? "border-l-primary bg-elevated text-foreground"
                    : "border-l-transparent text-secondary hover:bg-elevated hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2">
          <ConnectWallet />
          <div className="flex items-center gap-2 rounded-md border border-border bg-elevated px-2 py-1 text-xs text-secondary">
            <span className="h-2 w-2 rounded-full bg-info" />
            Starknet Testnet
          </div>
          <TEEStatus active={connected && teeEnabled} />
        </div>
      </div>
    </aside>
  );
}
