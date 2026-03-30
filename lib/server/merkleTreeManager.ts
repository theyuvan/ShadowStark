/**
 * Merkle Tree Manager — Poseidon-based, compatible with OpenZeppelin's verify_poseidon.
 * Ported from stark_cloak/tee/src/simpleMerkleTree.js to TypeScript.
 *
 * Manages an off-chain Merkle tree of commitments. Root is synced on-chain
 * via escrowService.updateMerkleRoot().
 */

import { hash } from "starknet";

function normalizeFelt(value: string | bigint): string {
  let hex = value.toString().replace("0x", "");
  if (!hex.match(/^[0-9a-fA-F]+$/)) {
    hex = BigInt(value).toString(16);
  }
  hex = hex.padStart(64, "0");
  return "0x" + hex;
}

interface TreeData {
  root: string;
  levels: string[][];
}

export class MerkleTreeManager {
  private leaves: string[] = [];
  private tree: TreeData = { root: "0x0", levels: [] };

  /**
   * Build the tree from an array of commitment leaves.
   * Pairwise-sorted Poseidon hashing (OpenZeppelin compatible).
   */
  private buildTree(): void {
    if (this.leaves.length === 0) {
      this.tree = { root: "0x0", levels: [] };
      return;
    }

    let currentLevel = [...this.leaves];
    const levels: string[][] = [currentLevel];

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] ?? left; // duplicate if odd

        // Pairwise-sorted to match OpenZeppelin expectations
        const a = BigInt(left);
        const b = BigInt(right);
        const [x, y] = a < b ? [a, b] : [b, a];
        const pairHash = hash.computePoseidonHashOnElements([x, y]);
        nextLevel.push(typeof pairHash === "string" ? pairHash : `0x${BigInt(pairHash).toString(16).padStart(64, "0")}`);
      }

      levels.push(nextLevel);
      currentLevel = nextLevel;
    }

    this.tree = { root: currentLevel[0], levels };
  }

  /** Load existing commitments and rebuild the tree */
  loadCommitments(commitments: string[]): void {
    this.leaves = commitments.map((c) => normalizeFelt(c));
    this.buildTree();
  }

  /** Add a single commitment and rebuild */
  addCommitment(commitment: string): { root: string; index: number; total: number } {
    const normalized = normalizeFelt(commitment);
    const index = this.leaves.length;
    this.leaves.push(normalized);
    this.buildTree();
    return { root: this.tree.root, index, total: this.leaves.length };
  }

  /** Get the current Merkle root */
  getRoot(): string {
    return this.tree.root;
  }

  /** Get Merkle proof for a commitment */
  getProof(commitment: string): string[] {
    const normalized = normalizeFelt(commitment);
    const leafIndex = this.leaves.indexOf(normalized);

    if (leafIndex === -1) {
      throw new Error(`Commitment not found in tree: ${commitment}`);
    }

    const proof: string[] = [];
    let currentIndex = leafIndex;

    for (let level = 0; level < this.tree.levels.length - 1; level++) {
      const currentLevel = this.tree.levels[level];
      const isLeft = currentIndex % 2 === 0;
      const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;

      if (siblingIndex >= 0 && siblingIndex < currentLevel.length) {
        proof.push(currentLevel[siblingIndex]);
      } else {
        proof.push(currentLevel[currentIndex]);
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }

  /** Verify a proof against the current root */
  verifyProof(commitment: string, proof: string[]): boolean {
    try {
      const normalized = normalizeFelt(commitment);
      const leafIndex = this.leaves.indexOf(normalized);
      if (leafIndex === -1) return false;

      let currentHash = BigInt(normalized);

      for (let level = 0; level < this.tree.levels.length - 1; level++) {
        const sibling = level < proof.length ? BigInt(proof[level]) : currentHash;
        const [x, y] = currentHash < sibling ? [currentHash, sibling] : [sibling, currentHash];
        const res = hash.computePoseidonHashOnElements([x, y]);
        currentHash = typeof res === "string" ? BigInt(res) : BigInt(res);
      }

      return currentHash === BigInt(this.tree.root);
    } catch {
      return false;
    }
  }

  /** Get all leaves */
  getAllCommitments(): string[] {
    return [...this.leaves];
  }

  /** Tree info */
  getInfo(): { root: string; totalLeaves: number; isEmpty: boolean } {
    return {
      root: this.getRoot(),
      totalLeaves: this.leaves.length,
      isEmpty: this.leaves.length === 0,
    };
  }
}

/** Singleton instance */
export const merkleTreeManager = new MerkleTreeManager();
