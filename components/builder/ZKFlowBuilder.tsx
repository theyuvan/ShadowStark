"use client";

import "reactflow/dist/style.css";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type ReactFlowInstance,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "reactflow";
import { nanoid } from "nanoid";

import { ConditionNode } from "@/components/nodes/ConditionNode";
import { ConstraintNode } from "@/components/nodes/ConstraintNode";
import { ExecuteNode } from "@/components/nodes/ExecuteNode";
import { SplitNode } from "@/components/nodes/SplitNode";
import { BtcTransferNode } from "@/components/nodes/BtcTransferNode";
import { useStrategyStore } from "@/store/strategyStore";
import { GraphValidator } from "@/components/builder/GraphValidator";
import { CompileButton } from "@/components/builder/CompileButton";
import { NodeToolbar } from "@/components/builder/NodeToolbar";
import { NodeConfigPanel } from "@/components/builder/NodeConfigPanel";
import { compileGraphToConstraints, validateGraphAsDag } from "@/lib/graphCompiler";
import { ZKConstraintPreview } from "@/components/builder/ZKConstraintPreview";
import { validateConnection } from "@/lib/flowRules";
import { CompileFlow } from "@/components/builder/CompileFlow";
import { useZKStore } from "@/store/zkStore";

const nodeTypes: NodeTypes = {
  condition: ConditionNode,
  split: SplitNode,
  execute: ExecuteNode,
  constraint: ConstraintNode,
  btc_transfer: BtcTransferNode,
};

const templatePathValid = (
  template: "simple" | "split" | "guarded" | null,
  nodeTypesList: Array<"condition" | "split" | "execute" | "constraint" | "btc_transfer">,
) => {
  if (!template) {
    return true;
  }

  const hasCondition = nodeTypesList.includes("condition");
  const hasExecute = nodeTypesList.includes("execute");
  const hasSplit = nodeTypesList.includes("split");
  const hasConstraint = nodeTypesList.includes("constraint");

  if (template === "simple") {
    return hasCondition && hasExecute;
  }

  if (template === "split") {
    return hasCondition && hasSplit && hasExecute;
  }

  return hasCondition && hasSplit && hasExecute && hasConstraint;
};

export function ZKFlowBuilder() {
  const { graph, selectedNodeId, setSelectedNode, addNode, updateNodeData, updateNodePosition, addEdge: addStoreEdge, setCommitment, seedFromTemplate } =
    useStrategyStore();
  const setCurrentProof = useZKStore((state) => state.setCurrentProof);
  const setProofVerified = useZKStore((state) => state.setProofVerified);

  const [toast, setToast] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStage, setCompileStage] = useState(0);
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const searchParams = useSearchParams();

  const templateParam = searchParams.get("template");
  const selectedTemplate =
    templateParam === "simple" || templateParam === "split" || templateParam === "guarded"
      ? templateParam
      : null;
  const selectedPath = searchParams.get("selectedPath");
  const depositConfirmed = searchParams.get("deposit") === "1";
  const depositAmount = Number.parseFloat(searchParams.get("amount") ?? "0");

  const nodes: Node[] = useMemo(
    () =>
      graph.nodes.map((node) => ({
        ...node,
        data: node.data,
      })),
    [graph.nodes],
  );

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((edge) => ({
        ...edge,
        animated: true,
        style: { strokeDasharray: 5, stroke: "#00FF88", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#00FF88",
        },
      })),
    [graph.edges],
  );

  const onConnect = (params: Edge | Connection) => {
    const source = params.source;
    const target = params.target;
    if (!source || !target) {
      return;
    }

    const validationResult = validateConnection(graph, params);
    if (!validationResult.valid) {
      setToast(validationResult.reason ?? "Invalid edge");
      setTimeout(() => setToast(null), 2200);
      return;
    }

    const withId = { ...params, id: `${source}-${target}-${nanoid(4)}` };
    addStoreEdge({
      source,
      target,
      sourceHandle: withId.sourceHandle,
      targetHandle: withId.targetHandle,
      id: withId.id,
    });
  };

  const onNodesChange: OnNodesChange = (changes) => {
    const nextNodes = applyNodeChanges(changes, nodes);
    nextNodes.forEach((node) => {
      const original = graph.nodes.find((item) => item.id === node.id);
      if (!original || original.position.x !== node.position.x || original.position.y !== node.position.y) {
        updateNodePosition(node.id, node.position);
      }
    });
  };

  const onEdgesChange: OnEdgesChange = (changes) => {
    const next = applyEdgeChanges(changes, edges);
    next.forEach((edge) => {
      if (!graph.edges.find((item) => item.id === edge.id) && edge.source && edge.target) {
        addStoreEdge({ id: edge.id, source: edge.source, target: edge.target });
      }
    });
  };

  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const validation = validateGraphAsDag(graph);
  const constraints = useMemo(() => compileGraphToConstraints(graph), [graph]);
  const estimatedProofSize = useMemo(
    () => constraints.reduce((sum, item) => sum + item.estimatedSize, 1024),
    [constraints],
  );
  const nodeTypesList = graph.nodes.map((node) => node.type);
  const selectedPathValid = templatePathValid(selectedTemplate, nodeTypesList);
  const canCompileWithDeposit = depositConfirmed && depositAmount > 0;

  const onDrop: React.DragEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    setIsDragOverCanvas(false);
    const type = event.dataTransfer.getData("application/reactflow") as
      | "condition"
      | "split"
      | "execute"
      | "constraint";
    if (!type) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    addNode(type, {
      x: event.clientX - bounds.left - 90,
      y: event.clientY - bounds.top - 24,
    });
  };

  // ── Auto-seed from URL params (only runs once on mount when graph is empty) ──
  useEffect(() => {
    if (graph.nodes.length > 0) return; // never overwrite manual work
    const tpl = searchParams.get("template");
    const dir = searchParams.get("direction");
    if (!tpl || !dir) return;

    const template = (tpl === "simple" || tpl === "split" || tpl === "guarded") ? tpl : "simple";
    const direction = dir === "sell" ? "sell" : "buy";
    const amount = Number.parseFloat(searchParams.get("amount") ?? "0.1");
    const price = Number.parseFloat(searchParams.get("priceThreshold") ?? "60000");
    const splitCount = Number.parseInt(searchParams.get("splitCount") ?? "3", 10);

    seedFromTemplate({ template, direction, amount, price, splitCount });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only run on first mount

  useEffect(() => {
    if (!isCompiling) {
      return;
    }

    const timers = [350, 700, 1050].map((delay, index) =>
      setTimeout(() => {
        setCompileStage(index + 1);
      }, delay),
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [isCompiling]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex min-h-0 flex-1">
        <NodeToolbar constraintCount={constraints.length} estimatedProofSize={estimatedProofSize} />

        <div
          className={`relative flex-1 transition-colors ${isDragOverCanvas ? "bg-primary/5" : ""}`}
          onDrop={onDrop}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isDragOverCanvas) {
              setIsDragOverCanvas(true);
            }
          }}
          onDragLeave={() => setIsDragOverCanvas(false)}
        >
          <CompileFlow active={isCompiling} stage={compileStage} />

          {isDragOverCanvas ? (
            <div className="pointer-events-none absolute inset-3 z-20 rounded-xl border-2 border-dashed border-primary/70 bg-primary/10" />
          ) : null}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNode(node.id)}
            onInit={setRfInstance}
            fitView
          >
            <Background color="#2a2a45" gap={18} size={1} />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              maskColor="rgba(4, 4, 10, 0.65)"
              style={{
                background: "#0e0e1c",
                border: "1px solid rgba(99, 102, 241, 0.22)",
                borderRadius: 12,
              }}
              nodeStrokeColor="#6366f1"
              nodeColor={(node) => {
                if (node.type === "condition") return "#06b6d4";
                if (node.type === "split") return "#f59e0b";
                if (node.type === "execute") return "#10b981";
                if (node.type === "constraint") return "#8b5cf6";
                return "#64748b";
              }}
              onNodeClick={(_, node) => {
                setSelectedNode(node.id);
                if (rfInstance) {
                  const x = node.position.x + 120;
                  const y = node.position.y + 44;
                  rfInstance.setCenter(x, y, { zoom: 1.1, duration: 350 });
                }
              }}
            />
            <Controls position="bottom-left" />
          </ReactFlow>

          {!nodes.length ? (
            <div className="pointer-events-none absolute inset-8 flex items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">
              Drag nodes to start building
            </div>
          ) : null}

          {toast ? (
            <div className="absolute right-4 top-4 rounded-lg border border-primary/50 bg-surface px-3 py-2 text-xs text-primary">
              {toast}
            </div>
          ) : null}
        </div>

        <NodeConfigPanel node={selectedNode} onUpdate={updateNodeData} />
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-border bg-surface px-4 py-3 lg:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <GraphValidator graph={graph} />
          <ZKConstraintPreview
            selectedNode={selectedNode}
            constraints={constraints}
            estimatedProofSize={estimatedProofSize}
          />
        </div>
        <div className="flex items-start justify-end">
          <CompileButton
            disabled={!validation.valid || !selectedPathValid || !canCompileWithDeposit}
            strategy={{ id: "local-strategy", graph, salt: "shadowflow", createdAt: Date.now() }}
            onLoadingChange={(loading) => {
              setIsCompiling(loading);
              setCompileStage(0);
            }}
            onCompiled={(commitment) => {
              setCommitment(commitment.commitment);
              setCurrentProof(commitment.proof);
              setProofVerified(commitment.verified);
              setToast(
                commitment.verified
                  ? `Proof verified and stored: ${commitment.commitment.slice(0, 14)}...`
                  : `Proof generated but verification failed: ${commitment.commitment.slice(0, 14)}...`,
              );
              setTimeout(() => setToast(null), 2500);
            }}
            onError={(message) => {
              setToast(message);
              setTimeout(() => setToast(null), 3500);
            }}
          />
          {selectedPath ? (
            <div className="mt-2 rounded border border-border bg-background/50 px-3 py-2 text-[11px] text-muted">
              Path lock: <span className="font-code text-cyan-400">{selectedPath}</span> · Deposit: {canCompileWithDeposit ? "confirmed" : "required"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
