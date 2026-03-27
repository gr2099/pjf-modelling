import axios from "axios";

export const http = axios.create({ baseURL: "/api", timeout: 60_000 });

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

// ── Merger ─────────────────────────────────────────────────────────────────

export async function runMergerModel(payload: unknown) {
  const { data } = await http.post("/merger/run", payload);
  return data;
}

// ── Real Estate ────────────────────────────────────────────────────────────

export async function runRealEstateModel(payload: unknown) {
  const { data } = await http.post("/real-estate/run", payload);
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

export async function runWACCCAPM(payload: unknown) {
  const { data } = await http.post("/valuation/wacc-capm", payload);
  return data;
}

export async function runComprehensiveValuation(payload: unknown) {
  const { data } = await http.post("/valuation/comprehensive", payload);
  return data;
}

// ── Excel Export ────────────────────────────────────────────────────────────

async function downloadBlob(url: string, payload: unknown, filename: string) {
  const { data } = await http.post(url, payload, { responseType: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([data]));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export const exportCorporateXlsx = (payload: unknown) =>
  downloadBlob("/export/corporate", payload, "corporate_model.xlsx");

export const exportProjectXlsx = (payload: unknown) =>
  downloadBlob("/export/project", payload, "project_finance.xlsx");

export const exportAcquisitionXlsx = (payload: unknown) =>
  downloadBlob("/export/acquisition", payload, "acquisition_model.xlsx");

export const exportMonteCarloXlsx = (payload: unknown) =>
  downloadBlob("/export/monte-carlo", payload, "monte_carlo.xlsx");
