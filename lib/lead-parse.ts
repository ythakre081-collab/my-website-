import * as XLSX from "xlsx";
import Papa from "papaparse";

export type ParsedLead = { name: string; mobile: string };

const NAME_KEYS = ["name", "candidate", "customer", "full name", "fullname", "candidate name", "customer name", "client", "lead", "lead name"];
const MOBILE_KEYS = ["mobile", "phone", "contact", "number", "mobile number", "phone number", "contact number", "phone no", "mob", "mob no", "cell", "whatsapp"];

function normKey(k: string) {
  return k.toLowerCase().replace(/[^a-z ]/g, "").trim();
}

function pick(row: Record<string, unknown>, keys: string[]): string | undefined {
  const norm: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) norm[normKey(k)] = v;
  for (const k of keys) {
    const v = norm[normKey(k)];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

function cleanMobile(m: string) {
  const digits = m.replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.slice(-10);
}

function normalizeRows(rows: Record<string, unknown>[]): ParsedLead[] {
  const seen = new Set<string>();
  const out: ParsedLead[] = [];
  for (const row of rows) {
    const rawMobile = pick(row, MOBILE_KEYS);
    const rawName = pick(row, NAME_KEYS) ?? "Unknown";
    if (!rawMobile) continue;
    const mobile = cleanMobile(rawMobile);
    if (!mobile || seen.has(mobile)) continue;
    seen.add(mobile);
    out.push({ name: rawName, mobile });
  }
  return out;
}

export function parsePastedText(text: string): ParsedLead[] {
  const rows: Record<string, unknown>[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  // Try CSV first
  const csv = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
  if (csv.data.length > 0 && Object.keys(csv.data[0]).length >= 2) {
    return normalizeRows(csv.data);
  }

  // Fallback: each line = "name<sep>mobile" or just mobile
  for (const line of lines) {
    const parts = line.split(/[,\t;|]+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 1) {
      rows.push({ name: "Unknown", mobile: parts[0] });
    } else {
      // Assume last numeric part is mobile
      const mobilePart = parts.find((p) => /\d{10,}/.test(p.replace(/\D/g, ""))) ?? parts[parts.length - 1];
      const namePart = parts.filter((p) => p !== mobilePart).join(" ") || "Unknown";
      rows.push({ name: namePart, mobile: mobilePart });
    }
  }
  return normalizeRows(rows);
}

export async function parseFile(file: File): Promise<ParsedLead[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "csv") {
    const text = await file.text();
    const csv = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
    return normalizeRows(csv.data);
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return normalizeRows(rows);
}