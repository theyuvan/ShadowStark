import { poseidonHash } from "@scure/starknet";
import { MerkleProof } from "@/types";

const hash2 = (left: bigint, right: bigint): bigint => poseidonHash(left, right);

/**
 * PoseidonMerkleTree: Optimal Starknet zero-knowledge compatible Merkle tree.
 * Uses Poseidon hashing with depth 20 for balance of security and proof size.
 * PRIVATE markers: pathElements and pathIndices must never leave local memory.
 */
export class PoseidonMerkleTree {
  private tree: bigint[][] = [];
  private depth: number;
  private zeroHashes: bigint[] = [];

  constructor(depth: number = 20) {
    this.depth = depth;
    this._precomputeZeroHashes();
  }

  private _precomputeZeroHashes(): void {
    // Compute zero hashes for each level: H(0, 0), H(H(0,0), H(0,0)), etc.
    let currentZero = 0n;
    this.zeroHashes.push(currentZero);

    for (let i = 0; i < this.depth; i++) {
      currentZero = hash2(currentZero, currentZero);
      this.zeroHashes.push(currentZero);
    }
  }

  /**
   * Insert a leaf into the tree.
   * Maintains a sparse tree structure with only the necessary nodes.
   */
  insert(leaf: bigint): void {
    // Initialize tree structure if needed
    if (this.tree.length === 0) {
      for (let i = 0; i < this.depth + 1; i++) {
        this.tree.push([]);
      }
      this.tree[0].push(leaf);
      return;
    }

    const treeLength = this.tree[0].length;
    this.tree[0].push(leaf);

    // Update parent hashes up the tree
    let currentIndex = treeLength;
    for (let level = 1; level <= this.depth; level++) {
      if (!this.tree[level]) {
        this.tree[level] = [];
      }

      const isRight = currentIndex % 2 === 1;
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

      const leftChild =
        this.tree[level - 1][isRight ? siblingIndex : currentIndex] ||
        this.zeroHashes[level - 1];
      const rightChild =
        this.tree[level - 1][isRight ? currentIndex : siblingIndex] ||
        this.zeroHashes[level - 1];

      const parentHash = hash2(leftChild, rightChild);

      if (isRight) {
        this.tree[level][Math.floor(currentIndex / 2)] = parentHash;
      } else {
        this.tree[level][Math.floor(currentIndex / 2)] = parentHash;
      }

      currentIndex = Math.floor(currentIndex / 2);
    }
  }

  /**
   * Get the Merkle root (PUBLIC â€” safe to return).
   */
  getRoot(): bigint {
    if (this.tree[this.depth] && this.tree[this.depth].length > 0) {
      return this.tree[this.depth][0];
    }
    return this.zeroHashes[this.depth];
  }

  /**
   * Generate a Merkle proof for a leaf at index.
   * PRIVATE: pathElements and pathIndices must be kept confidential.
   */
  getProof(leafIndex: number): MerkleProof {
    const leaf = this.tree[0][leafIndex] || this.zeroHashes[0];
    const pathElements: bigint[] = []; // PRIVATE
    const pathIndices: number[] = []; // PRIVATE

    let currentIndex = leafIndex;
    for (let level = 0; level < this.depth; level++) {
      const isRight = currentIndex % 2 === 1;
      const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;

      const sibling =
        this.tree[level][siblingIndex] || this.zeroHashes[level];
      pathElements.push(sibling);
      pathIndices.push(isRight ? 1 : 0);

      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      leaf,
      pathElements, // PRIVATE
      pathIndices, // PRIVATE
      root: this.getRoot(), // PUBLIC
      treeDepth: this.depth,
    };
  }

  /**
   * Verify a Merkle proof (used for off-chain verification).
   * PRIVATE pathElements stay in witness context.
   */
  verify(proof: MerkleProof): boolean {
    let currentHash = proof.leaf;

    for (let level = 0; level < proof.pathElements.length; level++) {
      const isRight = proof.pathIndices[level] === 1;
      const sibling = proof.pathElements[level];

      if (isRight) {
        currentHash = hash2(sibling, currentHash);
      } else {
        currentHash = hash2(currentHash, sibling);
      }
    }

    return currentHash === proof.root;
  }

  /**
   * Get tree depth (PUBLIC).
   */
  getDepth(): number {
    return this.depth;
  }

  /**
   * Get number of leaves (PUBLIC).
   */
  getLeafCount(): number {
    return this.tree[0]?.length ?? 0;
  }

  /**
   * Get state for serialization (all data returned, but PRIVATE markings are implicit).
   */
  getState() {
    return {
      tree: this.tree.map((level) =>
        level.map((h) => h.toString())
      ),
      depth: this.depth,
      leafCount: this.getLeafCount(),
      root: this.getRoot().toString(),
    };
  }
}
