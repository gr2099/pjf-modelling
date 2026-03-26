import axios from "axios";

export const http = axios.create({ baseURL: "/api", timeout: 30_000 });

// ── Corporate ──────────────────────────────────────────────────────────────

export async function runCorporateModel(payload: unknown) {
  const { data } = await http.post("/corporate/run", payload);
  return data;
}

// ── Project Finance ────────────────────────────────────────────────────────

export async function runProjectModel(payload: unknown) {
  const { data } = await http.post("/project/run", payload);
  return data;
}

// ── Acquisition ────────────────────────────────────────────────────────────

export async function runAcquisitionModel(payload: unknown) {
  const { data } = await http.post("/acquisition/run", payload);
  return data;
}

// ── Risk ───────────────────────────────────────────────────────────────────

export async function runMonteCarlo(payload: unknown) {
  const { data } = await http.post("/risk/monte-carlo", payload);
  return data;
}

export async function runTornado(payload: unknown) {
  const { data } = await http.post("/risk/tornado", payload);
  return data;
}

export async function runBreakEven(payload: unknown) {
  const { data } = await http.post("/risk/break-even", payload);
  return data;
}

// ── Valuation ──────────────────────────────────────────────────────────────

export async function runDCF(payload: unknown) {
  const { data } = await http.post("/valuation/dcf", payload);
  return data;
}

export async function runWACC(payload: unknown) {
  const { data } = await http.post("/valuation/wacc", payload);
  return data;
}
