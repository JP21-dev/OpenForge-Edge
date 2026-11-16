import type { ImportRow } from "@/lib/api";
import type { MeterMode } from "@/store/useRepairStore";

const MODE_ALIASES: Record<string, MeterMode> = {
  dcv: "DCV", v: "DCV", vdc: "DCV", voltage: "DCV", volts: "DCV", dc: "DCV",
  acv: "ACV", vac: "ACV", ac: "ACV",
  ohm: "OHM", ohms: "OHM", r: "OHM", resistance: "OHM", "ω": "OHM",
  diode: "DIODE", d: "DIODE", "diode mode": "DIODE", dv: "DIODE",
  cont: "CONT", continuity: "CONT", beep: "CONT",
  amp: "AMP", a: "AMP", current: "AMP",
};

const COLUMN_ALIASES: Record<string, keyof ImportRow> = {
  test_point: "test_point", "test point": "test_point", testpoint: "test_point", point: "test_point", net: "test_point", name: "test_point",
  mode: "mode", type: "mode", measurement: "mode",
  expected: "expected", value: "expected", reading: "expected", typical: "expected",
  expected_min: "expected_min", min: "expected_min", low: "expected_min",
  expected_max: "expected_max", max: "expected_max", high: "expected_max",
  hint: "hint", location: "hint", note: "hint", notes: "hint", where: "hint", component: "hint",
};

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number.parseFloat(String(v).replace(",", ".").replace(/[^\d.eE+\-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function toMode(v: unknown): MeterMode {
  return MODE_ALIASES[String(v ?? "").trim().toLowerCase()] ?? "DCV";
}

function normalise(raw: Record<string, unknown>): ImportRow | null {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = COLUMN_ALIASES[k.trim().toLowerCase()];
    if (key && row[key] === undefined) row[key] = v;
  }
  const testPoint = String(row.test_point ?? "").trim();
  if (!testPoint) return null;
  return {
    test_point: testPoint.slice(0, 120),
    mode: toMode(row.mode),
    hint: row.hint ? String(row.hint).slice(0, 300) : undefined,
    expected: toNumber(row.expected),
    expected_min: toNumber(row.expected_min),
    expected_max: toNumber(row.expected_max),
  };
}

export function parseImport(text: string, filename: string): ImportRow[] {
  const trimmed = text.trim();
  if (filename.toLowerCase().endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const data = JSON.parse(trimmed);
    const list: unknown[] = Array.isArray(data) ? data : (data.points ?? data.entries ?? data.rows ?? []);
    return list.map((r) => normalise(r as Record<string, unknown>)).filter((r): r is ImportRow => r !== null);
  }
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = [",", ";", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const headers = splitCsvLine(lines[0], sep);
  return lines
    .slice(1)
    .map((line) => {
      const cells = splitCsvLine(line, sep);
      return normalise(Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])));
    })
    .filter((r): r is ImportRow => r !== null);
}
