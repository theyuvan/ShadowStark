import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { hash } from "starknet";

import type { ExecutionLog, OtcLifecycleStatus, OtcMatchRecord, TEEAttestation, TradeRecord, ZKProof } from "@/types";

type Direction = "buy" | "sell";
type StrategyTemplate = "simple" | "split" | "guarded";

export interface StrategySummary {
  id: string;
  direction: Direction;
  status: OtcLifecycleStatus;
  commitment: string;
  createdAt: number;
}

interface WalletBalanceState {
  btcBalance: string;
  strkBalance: string;
}

interface WalletState {
  balances: WalletBalanceState;
  strategies: StrategySummary[];
  trades: TradeRecord[];
  logs: ExecutionLog[];
  matches: OtcMatchRecord[];
  latestAttestation: TEEAttestation | null;
  latestProof: ZKProof | null;
}

interface OtcOrder {
  id: string;
  walletAddress: string;
  direction: Direction;
  templateId: StrategyTemplate;
  selectedPath: string;
  priceThreshold: number;
  amount: number;
  remainingAmount: number;
  depositAmount: number;
  createdAt: number;
  commitment: string;
  strategyId: string;
  tradeId: string;
}

interface OrderBook {
  buy: OtcOrder[];
  sell: OtcOrder[];
}

interface OtcState {
  wallets: Record<string, WalletState>;
  orderBook: OrderBook;
  matches: OtcMatchRecord[];
}

interface SubmitIntentPayload {
  walletAddress: string;
  direction: Direction;
  templateId: StrategyTemplate;
  priceThreshold: number;
  amount: number;
  splitCount: number;
  selectedPath: string;
  depositConfirmed: boolean;
  depositAmount: number;
}

const STATE_PATH = path.join(process.cwd(), "proofs", "otc-state.json");

const DEFAULT_BTC_BALANCE = 1.25;
const DEFAULT_STRK_BALANCE = 250;

const toKey = (walletAddress: string): string => walletAddress.toLowerCase();

async function loadState(): Promise<OtcState> {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as OtcState;
    return {
      wallets: parsed.wallets ?? {},
      orderBook: {
        buy: parsed.orderBook?.buy ?? [],
        sell: parsed.orderBook?.sell ?? [],
      },
      matches: parsed.matches ?? [],
    };
  } catch {
    return {
      wallets: {},
      orderBook: { buy: [], sell: [] },
      matches: [],
    };
  }
}

async function saveState(state: OtcState): Promise<void> {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

function makeDefaultWalletState(): WalletState {
  return {
    balances: {
      btcBalance: DEFAULT_BTC_BALANCE.toFixed(4),
      strkBalance: DEFAULT_STRK_BALANCE.toFixed(2),
    },
    strategies: [],
    trades: [],
    logs: [],
    matches: [],
    latestAttestation: null,
    latestProof: null,
  };
}

async function getOrCreateWalletState(walletAddress: string): Promise<{ state: OtcState; wallet: WalletState; key: string }> {
  const state = await loadState();
  const key = toKey(walletAddress);
  if (!state.wallets[key]) {
    state.wallets[key] = makeDefaultWalletState();
  }

  return { state, wallet: state.wallets[key], key };
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function maskAmount(amount: number): string {
  const rounded = Math.max(0, amount).toFixed(4);
  const [whole] = rounded.split(".");
  return `${"*".repeat(Math.max(3, Math.min(6, whole.length)))}.${"*".repeat(4)}`;
}

function statusFromAmounts(totalAmount: number, remainingAmount: number): OtcLifecycleStatus {
  if (remainingAmount <= 0) {
    return "settled";
  }
  if (remainingAmount < totalAmount) {
    return "matched";
  }
  return "open";
}

function makeCommitment(walletAddress: string, amount: number, direction: Direction, selectedPath: string): string {
  const nowHex = `0x${Date.now().toString(16)}`;
  const amountScaled = `0x${Math.round(amount * 100_000_000).toString(16)}`;
  const dirTag = direction === "buy" ? "0x1" : "0x2";
  const pathTag = `0x${Buffer.from(selectedPath).toString("hex").slice(0, 60) || "0"}`;

  return hash.computePoseidonHashOnElements([walletAddress, amountScaled, dirTag, pathTag, nowHex]);
}

function toNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getOrCreateWallet(state: OtcState, walletAddress: string): WalletState {
  const key = toKey(walletAddress);
  if (!state.wallets[key]) {
    state.wallets[key] = makeDefaultWalletState();
  }
  return state.wallets[key];
}

function findStrategy(wallet: WalletState, strategyId: string): StrategySummary {
  const strategy = wallet.strategies.find((item) => item.id === strategyId);
  if (!strategy) {
    throw new Error(`Strategy not found: ${strategyId}`);
  }
  return strategy;
}

function findTrade(wallet: WalletState, tradeId: string): TradeRecord {
  const trade = wallet.trades.find((item) => item.id === tradeId);
  if (!trade) {
    throw new Error(`Trade not found: ${tradeId}`);
  }
  return trade;
}

function applyMatchedStatus(
  wallet: WalletState,
  strategyId: string,
  tradeId: string,
  totalAmount: number,
  remainingAmount: number,
  counterpartyWallet: string,
  settlementCommitment: string,
  proofHash: string,
  matchedAmount: number,
): void {
  const strategy = findStrategy(wallet, strategyId);
  const trade = findTrade(wallet, tradeId);

  const status = statusFromAmounts(totalAmount, remainingAmount);
  strategy.status = status;
  trade.status = status;
  trade.remainingAmount = Number(remainingAmount.toFixed(8));
  trade.matchedAmount = Number((matchedAmount + (trade.matchedAmount ?? 0)).toFixed(8));
  trade.counterpartyWallet = counterpartyWallet;
  trade.settlementCommitment = settlementCommitment;
  trade.proofHash = proofHash;
}

function addExecutionLogs(
  wallet: WalletState,
  templateId: StrategyTemplate,
  pathId: string,
  masked: string,
  timestamp: number,
  event: "OPEN" | "MATCH" | "SETTLED",
): void {
  const openStep = event === "OPEN" ? 0 : 2;
  wallet.logs.unshift(
    {
      stepIndex: openStep,
      nodeId: templateId,
      action: "CONDITION_CHECK",
      maskedAmount: masked,
      timestamp,
      constraintsSatisfied: true,
      witnessGenerated: event !== "OPEN",
    },
    {
      stepIndex: openStep + 1,
      nodeId: pathId,
      action: "EXECUTE",
      maskedAmount: masked,
      timestamp: timestamp + 1,
      constraintsSatisfied: true,
      witnessGenerated: event !== "OPEN",
    },
  );
}

function tryMatchOrder(state: OtcState, incoming: OtcOrder): OtcMatchRecord[] {
  const matchedRecords: OtcMatchRecord[] = [];

  const oppositeBook = incoming.direction === "buy" ? state.orderBook.sell : state.orderBook.buy;
  oppositeBook.sort((a, b) => a.createdAt - b.createdAt);

  for (let index = 0; index < oppositeBook.length && incoming.remainingAmount > 0; ) {
    const candidate = oppositeBook[index];

    if (candidate.walletAddress === incoming.walletAddress) {
      index += 1;
      continue;
    }

    if (candidate.selectedPath !== incoming.selectedPath) {
      index += 1;
      continue;
    }

    const buyOrder = incoming.direction === "buy" ? incoming : candidate;
    const sellOrder = incoming.direction === "sell" ? incoming : candidate;

    if (buyOrder.priceThreshold < sellOrder.priceThreshold) {
      index += 1;
      continue;
    }

    const fillAmount = Math.min(incoming.remainingAmount, candidate.remainingAmount);
    if (fillAmount <= 0) {
      index += 1;
      continue;
    }

    const executionPrice = Number(((buyOrder.priceThreshold + sellOrder.priceThreshold) / 2).toFixed(2));
    const now = Date.now();
    const settlementCommitment = makeCommitment(
      buyOrder.walletAddress,
      fillAmount,
      "buy",
      `${sellOrder.walletAddress}:${executionPrice}`,
    );
    const proofHash = settlementCommitment;

    incoming.remainingAmount = Number((incoming.remainingAmount - fillAmount).toFixed(8));
    candidate.remainingAmount = Number((candidate.remainingAmount - fillAmount).toFixed(8));

    const buyerWallet = getOrCreateWallet(state, buyOrder.walletAddress);
    const sellerWallet = getOrCreateWallet(state, sellOrder.walletAddress);

    const buyerBtc = toNumber(buyerWallet.balances.btcBalance);
    buyerWallet.balances.btcBalance = (buyerBtc + fillAmount).toFixed(4);

    const sellerStrk = toNumber(sellerWallet.balances.strkBalance);
    sellerWallet.balances.strkBalance = (sellerStrk + fillAmount).toFixed(2);

    applyMatchedStatus(
      buyerWallet,
      buyOrder.strategyId,
      buyOrder.tradeId,
      buyOrder.amount,
      buyOrder.remainingAmount,
      sellOrder.walletAddress,
      settlementCommitment,
      proofHash,
      fillAmount,
    );
    applyMatchedStatus(
      sellerWallet,
      sellOrder.strategyId,
      sellOrder.tradeId,
      sellOrder.amount,
      sellOrder.remainingAmount,
      buyOrder.walletAddress,
      settlementCommitment,
      proofHash,
      fillAmount,
    );

    const matchStatus = buyOrder.remainingAmount === 0 && sellOrder.remainingAmount === 0 ? "settled" : "matched";
    const matchRecord: OtcMatchRecord = {
      id: nextId("match"),
      buyerWallet: buyOrder.walletAddress,
      sellerWallet: sellOrder.walletAddress,
      buyTradeId: buyOrder.tradeId,
      sellTradeId: sellOrder.tradeId,
      amount: Number(fillAmount.toFixed(8)),
      price: executionPrice,
      createdAt: now,
      settlementCommitment,
      proofHash,
      status: matchStatus,
    };

    state.matches.unshift(matchRecord);
    buyerWallet.matches.unshift(matchRecord);
    sellerWallet.matches.unshift(matchRecord);

    addExecutionLogs(
      buyerWallet,
      buyOrder.templateId,
      buyOrder.selectedPath,
      maskAmount(fillAmount),
      now,
      matchStatus === "settled" ? "SETTLED" : "MATCH",
    );
    addExecutionLogs(
      sellerWallet,
      sellOrder.templateId,
      sellOrder.selectedPath,
      maskAmount(fillAmount),
      now,
      matchStatus === "settled" ? "SETTLED" : "MATCH",
    );

    const attestation: TEEAttestation = {
      enclaveType: "SGX",
      measurementHash: makeCommitment(buyOrder.walletAddress, fillAmount, "buy", "tee-attestation"),
      timestamp: now,
      valid: true,
    };

    const proof: ZKProof = {
      proofHash,
      commitment: settlementCommitment,
      finalStateHash: settlementCommitment,
      nullifier: makeCommitment(sellOrder.walletAddress, fillAmount, "sell", "nullifier"),
      merkleRoot: settlementCommitment,
      publicInputs: {
        commitment: settlementCommitment,
        finalStateHash: settlementCommitment,
        nullifier: makeCommitment(sellOrder.walletAddress, fillAmount, "sell", "nullifier"),
        merkleRoot: settlementCommitment,
      },
      verified: true,
      constraintCount: 3,
      proofSize: 1024,
      timestamp: now,
      teeAttested: true,
    };

    buyerWallet.latestAttestation = attestation;
    sellerWallet.latestAttestation = attestation;
    buyerWallet.latestProof = proof;
    sellerWallet.latestProof = proof;

    matchedRecords.push(matchRecord);

    if (candidate.remainingAmount <= 0) {
      oppositeBook.splice(index, 1);
    } else {
      index += 1;
    }
  }

  return matchedRecords;
}

function updateBalancesForIntent(wallet: WalletState, payload: SubmitIntentPayload): void {
  const btc = toNumber(wallet.balances.btcBalance);
  const strk = toNumber(wallet.balances.strkBalance);

  // Simple demo accounting model for OTC reservation.
  if (payload.direction === "sell") {
    wallet.balances.btcBalance = Math.max(0, btc - payload.depositAmount).toFixed(4);
    wallet.balances.strkBalance = strk.toFixed(2);
    return;
  }

  wallet.balances.strkBalance = Math.max(0, strk - payload.depositAmount).toFixed(2);
  wallet.balances.btcBalance = btc.toFixed(4);
}

export async function getWalletBalances(walletAddress: string): Promise<WalletBalanceState> {
  const { state, wallet } = await getOrCreateWalletState(walletAddress);
  await saveState(state);
  return wallet.balances;
}

export async function listStrategies(walletAddress: string): Promise<StrategySummary[]> {
  const { wallet } = await getOrCreateWalletState(walletAddress);
  return wallet.strategies.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listTrades(walletAddress: string): Promise<TradeRecord[]> {
  const { wallet } = await getOrCreateWalletState(walletAddress);
  return wallet.trades.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listMatches(walletAddress: string): Promise<OtcMatchRecord[]> {
  const { wallet } = await getOrCreateWalletState(walletAddress);
  return wallet.matches.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listExecutionLogs(walletAddress: string): Promise<ExecutionLog[]> {
  const { wallet } = await getOrCreateWalletState(walletAddress);
  return wallet.logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
}

export async function getLatestAttestation(walletAddress: string): Promise<TEEAttestation | null> {
  const { wallet } = await getOrCreateWalletState(walletAddress);
  return wallet.latestAttestation;
}

export async function getLatestProof(walletAddress: string): Promise<ZKProof | null> {
  const { wallet } = await getOrCreateWalletState(walletAddress);
  return wallet.latestProof;
}

export async function submitIntent(payload: SubmitIntentPayload): Promise<{
  strategy: StrategySummary;
  trade: TradeRecord;
  matches: OtcMatchRecord[];
  proof: ZKProof | null;
}> {
  const { state, wallet } = await getOrCreateWalletState(payload.walletAddress);

  if (!payload.depositConfirmed || payload.depositAmount <= 0) {
    throw new Error("Deposit must be confirmed before submitting an OTC intent.");
  }

  const btcBalance = toNumber(wallet.balances.btcBalance);
  const strkBalance = toNumber(wallet.balances.strkBalance);

  if (payload.direction === "sell" && btcBalance < payload.depositAmount) {
    throw new Error("Insufficient BTC balance for SELL intent reservation.");
  }

  if (payload.direction === "buy" && strkBalance < payload.depositAmount) {
    throw new Error("Insufficient STRK balance for BUY intent reservation.");
  }

  const createdAt = Date.now();
  const commitment = makeCommitment(
    payload.walletAddress,
    payload.amount,
    payload.direction,
    payload.selectedPath,
  );

  const strategy: StrategySummary = {
    id: nextId("strategy"),
    direction: payload.direction,
    status: "open",
    commitment,
    createdAt,
  };

  const trade: TradeRecord = {
    id: nextId("trade"),
    direction: payload.direction,
    status: "open",
    createdAt,
    commitment,
    proofHash: undefined,
    maskedAmount: maskAmount(payload.amount),
    maskedPrice: `~$${Math.round(payload.priceThreshold).toLocaleString()}`,
    usesTEE: true,
    remainingAmount: Number(payload.amount.toFixed(8)),
    matchedAmount: 0,
  };

  const order: OtcOrder = {
    id: nextId("order"),
    walletAddress: payload.walletAddress,
    direction: payload.direction,
    templateId: payload.templateId,
    selectedPath: payload.selectedPath,
    priceThreshold: payload.priceThreshold,
    amount: payload.amount,
    remainingAmount: payload.amount,
    depositAmount: payload.depositAmount,
    createdAt,
    commitment,
    strategyId: strategy.id,
    tradeId: trade.id,
  };

  updateBalancesForIntent(wallet, payload);
  wallet.strategies.unshift(strategy);
  wallet.trades.unshift(trade);

  addExecutionLogs(wallet, payload.templateId, payload.selectedPath, trade.maskedAmount, createdAt, "OPEN");

  if (payload.direction === "buy") {
    state.orderBook.buy.push(order);
  } else {
    state.orderBook.sell.push(order);
  }

  const matches = tryMatchOrder(state, order);
  if (order.remainingAmount <= 0) {
    const myBook = payload.direction === "buy" ? state.orderBook.buy : state.orderBook.sell;
    const idx = myBook.findIndex((item) => item.id === order.id);
    if (idx >= 0) {
      myBook.splice(idx, 1);
    }
  }

  const refreshedWallet = getOrCreateWallet(state, payload.walletAddress);

  await saveState(state);

  return {
    strategy: findStrategy(refreshedWallet, strategy.id),
    trade: findTrade(refreshedWallet, trade.id),
    matches,
    proof: refreshedWallet.latestProof,
  };
}
