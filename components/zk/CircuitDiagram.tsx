"use client";
import React from "react";

interface CircuitDiagramProps {
  constraintCount?: number;
}

/**
 * CircuitDiagram: Static visual of the Cairo circuit structure.
 * Shows:
 * - PUBLIC wires (green): commitment, nullifier, merkleRoot, finalStateHash
 * - PRIVATE wires (red): merkle path, range bits, execution steps
 * - Constraint nodes: range_check, sum_partition, state_transition, assertion
 * - Wire colors and flow direction
 * 
 * This is a conceptual diagram; actual circuit logic is in Cairo contracts.
 */
export function CircuitDiagram({ constraintCount = 12 }: CircuitDiagramProps) {
  const constraints = [
    { x: 10, label: "hash\ncommitment", color: "#4499FF" },
    { x: 110, label: "verify_\nmerkle", color: "#00FF88" },
    { x: 210, label: "range_\ncheck", color: "#FFAA00" },
    { x: 310, label: "nullifier\nspent", color: "#FF5500" },
    { x: 410, label: "state_\ntransition", color: "#FF00FF" },
  ];

  return (
    <div className="w-full bg-gradient-to-b from-[#1E1E32] to-[#12121E] rounded-lg border border-[#2A2A3E] p-6">
      <h3 className="font-mono text-sm font-semibold text-[#E0E0E8] mb-4">
        Circuit Structure (Cairo Constraints)
      </h3>

      <svg width="100%" height="320" viewBox="0 0 600 320" className="border border-[#2A2A3E] rounded bg-[#0F0F17]">
        {/* Title */}
        <text x="300" y="20" textAnchor="middle" fontSize="12" fill="#00FF88" fontWeight="bold">
          strategy_execution Circuit
        </text>

        {/* INPUT SECTION */}
        <text x="10" y="50" fontSize="11" fill="#888899" fontWeight="bold">
          INPUTS
        </text>

        {/* PUBLIC Inputs */}
        <text x="10" y="75" fontSize="10" fill="#00FF88" fontWeight="bold">
          PUBLIC:
        </text>
        <rect x="90" y="65" width="120" height="18" fill="#00FF881A" stroke="#00FF88" strokeWidth="1" />
        <text x="100" y="78" fontSize="9" fill="#00FF88" fontFamily="monospace">
          commitment
        </text>

        <rect x="220" y="65" width="120" height="18" fill="#00FF881A" stroke="#00FF88" strokeWidth="1" />
        <text x="230" y="78" fontSize="9" fill="#00FF88" fontFamily="monospace">
          nullifier
        </text>

        <rect x="350" y="65" width="120" height="18" fill="#00FF881A" stroke="#00FF88" strokeWidth="1" />
        <text x="360" y="78" fontSize="9" fill="#00FF88" fontFamily="monospace">
          merkle_root
        </text>

        {/* PRIVATE Inputs */}
        <text x="10" y="110" fontSize="10" fill="#FF5500" fontWeight="bold">
          PRIVATE:
        </text>
        <rect x="90" y="100" width="100" height="18" fill="#FF55001A" stroke="#FF5500" strokeWidth="1" />
        <text x="95" y="113" fontSize="8" fill="#FF5500" fontFamily="monospace">
          merkle_path[20]
        </text>

        <rect x="200" y="100" width="100" height="18" fill="#FF55001A" stroke="#FF5500" strokeWidth="1" />
        <text x="205" y="113" fontSize="8" fill="#FF5500" fontFamily="monospace">
          range_bits[64]
        </text>

        <rect x="310" y="100" width="100" height="18" fill="#FF55001A" stroke="#FF5500" strokeWidth="1" />
        <text x="320" y="113" fontSize="8" fill="#FF5500" fontFamily="monospace">
          exec_steps
        </text>

        <rect x="420" y="100" width="100" height="18" fill="#FF55001A" stroke="#FF5500" strokeWidth="1" />
        <text x="430" y="113" fontSize="8" fill="#FF5500" fontFamily="monospace">
          salt
        </text>

        {/* CONSTRAINTS SECTION */}
        <text x="10" y="155" fontSize="11" fill="#888899" fontWeight="bold">
          CONSTRAINTS ({constraintCount})
        </text>

        {/* Constraint boxes */}
        {constraints.map((c, i) => (
          <g key={i}>
            <rect
              x={c.x}
              y="170"
              width="85"
              height="50"
              fill={c.color + "1A"}
              stroke={c.color}
              strokeWidth="1.5"
              rx="4"
            />
            <text
              x={c.x + 42.5}
              y="200"
              textAnchor="middle"
              fontSize="8"
              fill={c.color}
              fontWeight="bold"
              fontFamily="monospace"
            >
              {c.label}
            </text>
          </g>
        ))}

        {/* Connection lines */}
        {/* PUBLIC to Constraints */}
        <line x1="150" y1="83" x2="52.5" y2="170" stroke="#00FF88" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="280" y1="83" x2="152.5" y2="170" stroke="#00FF88" strokeWidth="1" strokeDasharray="3,3" />
        <line x1="410" y1="83" x2="452.5" y2="170" stroke="#00FF88" strokeWidth="1" strokeDasharray="3,3" />

        {/* PRIVATE to Constraints */}
        <line x1="140" y1="118" x2="152.5" y2="170" stroke="#FF5500" strokeWidth="1" />
        <line x1="250" y1="118" x2="252.5" y2="170" stroke="#FF5500" strokeWidth="1" />
        <line x1="360" y1="118" x2="352.5" y2="170" stroke="#FF5500" strokeWidth="1" />

        {/* OUTPUT SECTION */}
        <text x="10" y="260" fontSize="11" fill="#888899" fontWeight="bold">
          OUTPUT
        </text>

        <rect x="90" y="270" width="420" height="30" fill="#00FF881A" stroke="#00FF88" strokeWidth="2" rx="4" />
        <text x="300" y="278" textAnchor="middle" fontSize="10" fill="#00FF88" fontWeight="bold">
          ✓ All constraints satisfied → Proof valid
        </text>
        <text x="300" y="295" textAnchor="middle" fontSize="9" fill="#666677" fontFamily="monospace">
          PublicOutputs (commitment, nullifier, merkleRoot, finalStateHash)
        </text>

        {/* Legend */}
        <text x="10" y="320" fontSize="9" fill="#888899">
          ━ PUBLIC (shown on-chain) | ━ PRIVATE (witnesses only)
        </text>
      </svg>

      {/* Description */}
      <div className="mt-4 space-y-2 text-xs text-[#888899]">
        <p>
          <span className="text-[#00FF88]">Circuit Logic:</span> Proves that commitment from strategy is valid, value is in range, nullifier hasn&apos;t been spent, and execution completed successfully.
        </p>
        <p>
          <span className="text-[#FF5500]">Private Witnesses:</span> Merkle path, bit decomposition, execution steps—all proved in ZK without revealing.
        </p>
      </div>
    </div>
  );
}
