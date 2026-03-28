import type { NodeGraph, ZKConstraint } from "@/types";

const constraintByType = {
  condition: "range_check",
  split: "sum_partition",
  execute: "state_transition",
  constraint: "assertion",
  btc_transfer: "asset_commitment",
} as const;

const sizeByType: Record<string, number> = {
  condition: 256,
  split: 256,
  execute: 256,
  constraint: 256,
  btc_transfer: 512, // HTLC + Merkle path adds more constraints
};

export function compileGraphToConstraints(graph: NodeGraph): ZKConstraint[] {
  return graph.nodes.map((node) => ({
    nodeId: node.id,
    constraintType: constraintByType[node.type],
    publicInputs: [
      node.type,
      node.id,
      // For btc_transfer, expose commitment and timelock as public inputs
      ...(node.type === "btc_transfer"
        ? [(node.data as { commitment?: string }).commitment ?? "0x0",
           String((node.data as { htlcTimelock?: number }).htlcTimelock ?? 144)]
        : []),
    ],
    privateWitness: [JSON.stringify(node.data)], // PRIVATE — never log or transmit
    estimatedSize: sizeByType[node.type] ?? 256,
  }));
}

export function validateGraphAsDag(graph: NodeGraph): { valid: boolean; reason: string } {
  if (!graph.nodes.length) {
    return { valid: false, reason: "Graph has no nodes" };
  }

  const ids = new Set(graph.nodes.map((node) => node.id));
  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      return { valid: false, reason: "Graph contains dangling edge reference" };
    }
  }

  const incoming = new Map<string, number>();
  graph.nodes.forEach((node) => incoming.set(node.id, 0));
  graph.edges.forEach((edge) => incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1));

  const queue = Array.from(incoming.entries())
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id);

  let visited = 0;
  while (queue.length) {
    const current = queue.shift()!;
    visited += 1;

    graph.edges
      .filter((edge) => edge.source === current)
      .forEach((edge) => {
        const next = (incoming.get(edge.target) ?? 0) - 1;
        incoming.set(edge.target, next);
        if (next === 0) {
          queue.push(edge.target);
        }
      });
  }

  if (visited !== graph.nodes.length) {
    return { valid: false, reason: "Cycle detected — strategy must be a DAG" };
  }

  return { valid: true, reason: "Graph is valid" };
}
