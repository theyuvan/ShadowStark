export type NodeType = "condition" | "split" | "execute" | "constraint";

export interface ConditionData {
  asset: "BTC";
  operator: "<" | ">" | "==";
  price: number; // PRIVATE — never log or transmit
}

export interface SplitData {
  splitCount: number; // PRIVATE — never log or transmit
  splitMode: "equal" | "random";
}

export interface ExecuteData {
  direction: "buy" | "sell";
  amount: number; // PRIVATE — never log or transmit
  delayMs: number; // PRIVATE — never log or transmit
}

export interface ConstraintData {
  field: string;
  operator: "<" | ">" | "==" | ">=" | "<=";
  value: number; // PRIVATE — never log or transmit
}

export interface StrategyNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: ConditionData | SplitData | ExecuteData | ConstraintData;
}

export interface NodeGraph {
  nodes: StrategyNode[];
  edges: { id: string; source: string; target: string }[];
}

export interface Strategy {
  id: string;
  graph: NodeGraph;
  salt: string;
  createdAt: number;
}

export interface ZKConstraint {
  nodeId: string;
  constraintType: "range_check" | "sum_partition" | "state_transition" | "assertion";
  publicInputs: string[];
  privateWitness: string[]; // PRIVATE — never log or transmit
  estimatedSize: number; // in bytes for cost estimation
}

export interface MerkleProof {
  leaf: bigint;
  pathElements: bigint[]; // PRIVATE
  pathIndices: number[]; // PRIVATE
  root: bigint; // PUBLIC
  treeDepth: number;
}

export interface RangeProofWitness {
  bits: bigint[]; // PRIVATE: bit decomposition
  blindingFactor: bigint; // PRIVATE
  publicCommitment: bigint; // PUBLIC: Poseidon(value, blinding)
  lowerBound: bigint; // PRIVATE
  upperBound: bigint; // PRIVATE
}

export interface NullifierData {
  nullifier: bigint; // PUBLIC: stored on chain
  spent: boolean; // PUBLIC: tracked in smart contract
}

export interface CircuitPublicInputs {
  commitment: string;
  finalStateHash: string;
  nullifier: string;
  merkleRoot: string;
}

export interface CircuitPrivateInputs {
  strategyHash: string;
  salt: string;
  tradeAmount: string;
  priceLower: string;
  priceUpper: string;
  executionSteps: string[];
  merklePath: string[];
  nullifierSecret: string;
}

export interface ZKProof {
  proofHash: string;
  commitment: string; // PUBLIC
  finalStateHash: string; // PUBLIC
  nullifier: string; // PUBLIC
  merkleRoot: string; // PUBLIC
  publicInputs: CircuitPublicInputs;
  verified: boolean;
  constraintCount: number;
  proofSize: number; // in bytes
  timestamp: number;
}

export interface AggregatedProof {
  aggregatedProofHash: string;
  individualCommitments: string[];
  finalStateHashes: string[];
  proofCount: number;
  verified: boolean;
  totalConstraintCount: number;
}

export interface ExecutionLog {
  stepIndex: number;
  nodeId: string;
  action: "CONDITION_CHECK" | "SPLIT" | "EXECUTE" | "CONSTRAINT_PASS" | "DELAY";
  maskedAmount: string;
  timestamp: number; // PRIVATE — never log or transmit
  constraintsSatisfied: boolean;
  witnessGenerated: boolean;
}
