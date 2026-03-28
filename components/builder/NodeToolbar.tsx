"use client";

import { NODE_CONFIGS } from "@/constants/nodes";
import type { NodeType } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NodeToolbarProps {
  constraintCount?: number;
  estimatedProofSize?: number;
}

export function NodeToolbar({ constraintCount = 0, estimatedProofSize = 0 }: NodeToolbarProps) {
  const onDragStart = (event: React.DragEvent<HTMLDivElement>, nodeType: NodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <TooltipProvider>
      <div className="h-full w-[240px] overflow-y-auto border-r border-border bg-surface p-4">
        <h3 className="mb-1 font-heading text-lg font-bold">Intent Nodes</h3>
        <p className="mb-4 text-xs text-muted">Drag to canvas to build private OTC execution path</p>
        <div className="mb-4 rounded-lg border border-border bg-background p-2 text-xs">
          <p className="font-semibold text-primary">ZK Cost Estimator</p>
          <p className="text-muted">Constraints: {constraintCount}</p>
          <p className="text-muted">Proof size: {estimatedProofSize} bytes</p>
        </div>
        <div className="space-y-3">
          {Object.values(NODE_CONFIGS).map((config) => {
            const Icon = config.icon;
            return (
              <Tooltip key={config.type}>
                <TooltipTrigger asChild>
                  <div
                    draggable
                    onDragStart={(event) => onDragStart(event, config.type)}
                    className="group cursor-grab rounded-xl border border-border bg-background/70 p-3 transition-all hover:border-primary/40 hover:bg-highlight/50 hover:shadow-card active:cursor-grabbing"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon style={{ color: config.color }} className="h-4 w-4" />
                        <span className="font-semibold">{config.label}</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted group-hover:text-primary">drag</span>
                    </div>
                    <div className="mb-2 h-px bg-border/70" />
                    <p className="text-xs text-muted">{config.zkLabel}</p>
                    <div className="mt-2 rounded-md border border-border/60 bg-base px-2 py-1 text-[10px] text-secondary">
                      {config.description}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>{config.description}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
