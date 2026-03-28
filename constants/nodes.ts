import type { LucideIcon } from "lucide-react";
import { Bitcoin, GitBranch, Shield, Shuffle, Zap } from "lucide-react";

import type { NodeType } from "@/types";

export interface NodeConfig {
  type: NodeType;
  label: string;
  color: string;
  icon: LucideIcon;
  zkLabel: string;
  description: string;
}

export const NODE_CONFIGS: Record<NodeType, NodeConfig> = {
  condition: {
    type: "condition",
    label: "Condition",
    color: "#06B6D4",
    icon: GitBranch,
    zkLabel: "Range Check",
    description: "IF BTC price threshold",
  },
  split: {
    type: "split",
    label: "Split Trade",
    color: "#F59E0B",
    icon: Shuffle,
    zkLabel: "Partition",
    description: "Divide into N sub-trades",
  },
  execute: {
    type: "execute",
    label: "Execute",
    color: "#10B981",
    icon: Zap,
    zkLabel: "State Transition",
    description: "Run trade action",
  },
  constraint: {
    type: "constraint",
    label: "Constraint",
    color: "#8B5CF6",
    icon: Shield,
    zkLabel: "Assertion",
    description: "Add rule / guard",
  },
  btc_transfer: {
    type: "btc_transfer",
    label: "BTC Transfer",
    color: "#F7931A",
    icon: Bitcoin,
    zkLabel: "HTLC Commitment",
    description: "Lock BTC via HTLC → Starknet commitment",
  },
};
