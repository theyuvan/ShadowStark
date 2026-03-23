import { formatISO } from "date-fns";

import type { ExecutionLog, NodeGraph } from "@/types";

const maskAmount = (value: number) => {
  const floored = Math.max(1, Math.round(value * 1000));
  return `██${(floored % 97).toString().padStart(2, "0")}██`;
};

const randomizeTimestamp = (base: number, index: number) => base + index * 317 + Math.floor(Math.random() * 181);

export function executeStrategyPrivately(graph: NodeGraph): {
  logs: ExecutionLog[];
  finalStateHash: string;
  executedAt: string;
} {
  const base = Date.now();
  const logs: ExecutionLog[] = graph.nodes.map((node, index) => ({
    stepIndex: index,
    nodeId: node.id,
    action:
      node.type === "condition"
        ? "CONDITION_CHECK"
        : node.type === "split"
          ? "SPLIT"
          : node.type === "execute"
            ? "EXECUTE"
            : "CONSTRAINT_PASS",
    maskedAmount: maskAmount(index + 1),
    timestamp: randomizeTimestamp(base, index), // PRIVATE — never log or transmit
    constraintsSatisfied: true,
    witnessGenerated: false,
  }));

  const finalStateHash = `0x${Buffer.from(`${graph.nodes.length}:${graph.edges.length}:${base}`).toString("hex").slice(0, 62)}`;

  return {
    logs,
    finalStateHash,
    executedAt: formatISO(new Date(base)),
  };
}
