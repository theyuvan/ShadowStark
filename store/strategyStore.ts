import { create } from "zustand";
import { produce } from "immer";
import { nanoid } from "nanoid";

import type {
  BtcTransferData,
  ConditionData,
  ConstraintData,
  ExecuteData,
  NodeGraph,
  NodeType,
  StrategyNode,
  SplitData,
} from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface StrategyState {
  graph: NodeGraph;
  selectedNodeId: string | null;
  isValid: boolean;
  commitment: string | null;
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  updateNodeData: (id: string, data: Record<string, unknown>) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: {
    id?: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }) => void;
  setSelectedNode: (id: string | null) => void;
  validateGraph: () => boolean;
  resetGraph: () => void;
  setCommitment: (commitment: string | null) => void;
  /**
   * Seed the canvas with a pre-wired node graph from a template + direction.
   * Only runs when the graph is currently empty to avoid overwriting manual work.
   */
  seedFromTemplate: (opts: {
    template: "simple" | "split" | "guarded";
    direction: "buy" | "sell";
    amount: number;
    price: number;
    splitCount: number;
  }) => void;
}

// ── Defaults ───────────────────────────────────────────────────────────────────

const emptyGraph: NodeGraph = { nodes: [], edges: [] };

function defaultNodeData(
  type: NodeType,
  overrides?: Partial<ConditionData & SplitData & ExecuteData & ConstraintData & BtcTransferData>,
): ConditionData | SplitData | ExecuteData | ConstraintData | BtcTransferData {
  switch (type) {
    case "condition":
      return {
        asset: "BTC",
        operator: "<",
        price: overrides?.price ?? 60000,
      } satisfies ConditionData;
    case "split":
      return {
        splitCount: overrides?.splitCount ?? 3,
        splitMode: "equal",
      } satisfies SplitData;
    case "execute":
      return {
        direction: overrides?.direction ?? "buy",
        amount: overrides?.amount ?? 0.1,
        delayMs: 500,
      } satisfies ExecuteData;
    case "constraint":
      return { field: "maxSlippage", operator: "<=", value: 2 } satisfies ConstraintData;
    case "btc_transfer":
      return {
        asset: "BTC",
        fromAddress: "",
        toAddress: "",
        btcAmount: overrides?.amount ?? 0.1,
        htlcTimelock: 144, // ~24 hours at 10 min/block
        commitment: "0x0000000000000000000000000000000000000000000000000000000000000000",
      } satisfies BtcTransferData;
  }
}

// ── Template node graphs ───────────────────────────────────────────────────────
// Pre-positions nodes on the canvas in a horizontal left-to-right flow.
// X spacing: 320px, Y offset: 0 (all on the same row with small stagger).

function buildTemplateGraph(
  template: "simple" | "split" | "guarded",
  direction: "buy" | "sell",
  amount: number,
  price: number,
  splitCount: number,
): NodeGraph {
  // Shared data overrides for every node in this template
  const overrides = { direction, amount, price, splitCount };

  // Factory helpers
  const node = (
    type: NodeType,
    x: number,
    y = 0,
  ): StrategyNode => ({
    id: nanoid(8),
    type,
    position: { x, y },
    data: defaultNodeData(type, overrides),
  });

  const edge = (source: string, target: string) => ({
    id: `${source}-${target}-${nanoid(4)}`,
    source,
    target,
  });

  // ── simple: Condition → BTC Transfer → Execute
  if (template === "simple") {
    const cond = node("condition", 60);
    const btc  = node("btc_transfer", 400);
    const exec = node("execute", 740);
    return {
      nodes: [cond, btc, exec],
      edges: [edge(cond.id, btc.id), edge(btc.id, exec.id)],
    };
  }

  // ── split: Condition → BTC Transfer → Split → Execute
  if (template === "split") {
    const cond  = node("condition", 40);
    const btc   = node("btc_transfer", 360);
    const split = node("split", 700);
    const exec  = node("execute", 1020);
    return {
      nodes: [cond, btc, split, exec],
      edges: [
        edge(cond.id, btc.id),
        edge(btc.id, split.id),
        edge(split.id, exec.id),
      ],
    };
  }

  // ── guarded: Condition → Constraint → BTC Transfer → Split → Execute
  const cond       = node("condition", 40);
  const constraint = node("constraint", 360, -80);
  const btc        = node("btc_transfer", 700);
  const split      = node("split", 1040);
  const exec       = node("execute", 1360);
  return {
    nodes: [cond, constraint, btc, split, exec],
    edges: [
      edge(cond.id, constraint.id),
      edge(constraint.id, btc.id),
      edge(btc.id, split.id),
      edge(split.id, exec.id),
    ],
  };
}

// ── Graph validation (DAG check) ───────────────────────────────────────────────

const validateNodeGraph = (graph: NodeGraph): boolean => {
  if (!graph.nodes.length) return false;

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false;
  }

  const indegree = new Map<string, number>();
  graph.nodes.forEach((n) => indegree.set(n.id, 0));
  graph.edges.forEach((e) =>
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1),
  );

  const queue = Array.from(indegree.entries())
    .filter(([, d]) => d === 0)
    .map(([id]) => id);

  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited += 1;
    graph.edges
      .filter((e) => e.source === id)
      .forEach((e) => {
        const next = (indegree.get(e.target) ?? 0) - 1;
        indegree.set(e.target, next);
        if (next === 0) queue.push(e.target);
      });
  }
  return visited === graph.nodes.length;
};

// ── Store ──────────────────────────────────────────────────────────────────────

export const useStrategyStore = create<StrategyState>((set, get) => ({
  graph: emptyGraph,
  selectedNodeId: null,
  isValid: false,
  commitment: null,

  addNode: (type, position) =>
    set(
      produce((state: StrategyState) => {
        state.graph.nodes.push({
          id: nanoid(8),
          type,
          position,
          data: defaultNodeData(type),
        });
      }),
    ),

  updateNodeData: (id, data) =>
    set(
      produce((state: StrategyState) => {
        const node = state.graph.nodes.find((item) => item.id === id);
        if (!node) return;
        node.data = { ...node.data, ...data } as typeof node.data;
      }),
    ),

  updateNodePosition: (id, position) =>
    set(
      produce((state: StrategyState) => {
        const node = state.graph.nodes.find((item) => item.id === id);
        if (!node) return;
        node.position = position;
      }),
    ),

  removeNode: (id) =>
    set(
      produce((state: StrategyState) => {
        state.graph.nodes = state.graph.nodes.filter((n) => n.id !== id);
        state.graph.edges = state.graph.edges.filter(
          (e) => e.source !== id && e.target !== id,
        );
        if (state.selectedNodeId === id) state.selectedNodeId = null;
      }),
    ),

  addEdge: (edge) =>
    set(
      produce((state: StrategyState) => {
        const edgeId = edge.id ?? `${edge.source}-${edge.target}-${nanoid(4)}`;
        const exists = state.graph.edges.some(
          (item) =>
            item.source === edge.source &&
            item.target === edge.target &&
            item.sourceHandle === edge.sourceHandle,
        );
        if (!exists) {
          state.graph.edges.push({
            id: edgeId,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
          });
        }
      }),
    ),

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  validateGraph: () => {
    const valid = validateNodeGraph(get().graph);
    set({ isValid: valid });
    return valid;
  },

  resetGraph: () =>
    set({ graph: emptyGraph, selectedNodeId: null, isValid: false, commitment: null }),

  setCommitment: (commitment) => set({ commitment }),

  seedFromTemplate: ({ template, direction, amount, price, splitCount }) => {
    // Only seed when canvas is empty — never overwrite manual work
    if (get().graph.nodes.length > 0) return;

    const seededGraph = buildTemplateGraph(template, direction, amount, price, splitCount);
    set({ graph: seededGraph, isValid: validateNodeGraph(seededGraph) });
  },
}));
