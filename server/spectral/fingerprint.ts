/**
 * SPECTRAL TERRAIN — 5-D STRUCTURAL FINGERPRINT & RADAR
 *
 * Implements the 0-dim philosophy: 5 scalar dimensions expressing metadata
 * *through* the file (zero GPU, microsecond execution, static code/law/medical).
 *
 * Dimensions:
 *   d1 = ln(1 + chars)                       (size)
 *   d2 = (abs(imul(31, hash)) % 1000) / 1000 (complexity hash)
 *   d3 = ln(1 + lines)                       (structure)
 *   d4 = ln(1 + defs)                        (definition density: function, class, etc.)
 *   d5 = ln(1 + imports)                     (coupling: import, require, etc.)
 *
 * L2-normalized to unit sphere via Kahan summation.
 *
 * Sits at the Risky Gate to pre-flight code diffs and PR proposals against:
 *   1. Diamond-Stable canonical baseline (shatter score)
 *   2. Cold-map failure manifold (coldDistance)
 *
 * Proprietary — NODE OUT / Joe Wales
 */

export type SpectralVector5D = [number, number, number, number, number];

export interface SpectralAuditReport {
  [key: string]: unknown;
  vector: SpectralVector5D;
  dimensions: {
    size: number;
    complexityHash: number;
    structureLines: number;
    defDensity: number;
    couplingImports: number;
  };
  heat: number;
  shatter: number;
  coldDistance: number;
  recommendation: "ANCHOR" | "REVIEW" | "SHATTER_RESOLVE";
  failureProximity: boolean;
  verdict: "pass" | "watch" | "block";
  receipt: string;
  computeTimeMs: number;
}

// ─────────────────────────────────────────────────────────────────
// VECTOR MATH (Kahan summation for numerical stability)
// ─────────────────────────────────────────────────────────────────

export function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  let c = 0;
  for (const v of vec) {
    const y = v * v - c;
    const t = sum + y;
    c = t - sum - y;
    sum = t;
  }
  const mag = Math.sqrt(sum);
  if (mag < 1e-9) {
    const fallback = new Array(vec.length).fill(0);
    fallback[Math.min(2, vec.length - 1)] = 1;
    return fallback;
  }
  return vec.map((v) => v / mag);
}

/** Manhattan resonance — average energy of the 5-D vector */
export function computeHeat(vec: number[]): number {
  if (vec.length === 0) return 0;
  return vec.reduce((acc, v) => acc + Math.abs(v), 0) / vec.length;
}

/** Euclidean distance between two points in 5-D space */
export function computeShatter(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  let sum = 0;
  let c = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    const y = diff * diff - c;
    const t = sum + y;
    c = t - sum - y;
    sum = t;
  }
  return Math.sqrt(sum);
}

/** Cosine distance between two normalized unit vectors (1 - dot) */
export function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  let c = 0;
  for (let i = 0; i < a.length; i++) {
    const y = (a[i] ?? 0) * (b[i] ?? 0) - c;
    const t = dot + y;
    c = t - dot - y;
    dot = t;
  }
  return Math.max(0, 1 - dot);
}

// ─────────────────────────────────────────────────────────────────
// 5-D STRUCTURAL FINGERPRINT
// ─────────────────────────────────────────────────────────────────

export function structuralFingerprint(text: string): SpectralVector5D {
  const chars = text.length;
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (Math.imul(31, hash) + text.charCodeAt(i)) | 0;
  }
  const lines = text.length > 0 ? text.split("\n").length : 0;
  const defs = (text.match(/\b(function|def|class|struct|impl|interface|type|fn)\b/g) || []).length;
  const imports = (text.match(/\b(import|from|require|include|use)\b/g) || []).length;

  const raw = [
    Math.log1p(chars),
    (Math.abs(hash) % 1000) / 1000,
    Math.log1p(lines),
    Math.log1p(defs),
    Math.log1p(imports),
  ];

  const norm = l2Normalize(raw);
  return [norm[0] ?? 0, norm[1] ?? 0, norm[2] ?? 0, norm[3] ?? 0, norm[4] ?? 0];
}

// ─────────────────────────────────────────────────────────────────
// CANONICAL BASELINE & COLD-MAP FAILURE MANIFOLD
// ─────────────────────────────────────────────────────────────────

/**
 * Diamond-Stable reference centroid for healthy, modular source code
 * (Derived from canonical repository components with balanced definition density and clean boundaries).
 */
export const CANONICAL_CODE_CENTROID: SpectralVector5D = structuralFingerprint(`
export interface ServiceConfig {
  apiKey: string;
  timeoutMs?: number;
}
export class CoreService {
  constructor(private config: ServiceConfig) {}
  async execute(input: string): Promise<boolean> {
    return input.length > 0;
  }
}
`);

/**
 * Known failure manifolds from spectral-terrain slop-canon and incidents:
 *   1. hollow_stub: empty files or hollow rooms that cause protocol or import failures
 *   2. unstructured_dump: massive unstructured single-file dumps with zero functions/classes
 *   3. coupling_blowout: runaway external dependencies with zero local definitions
 *   4. hubjob_done_respawn: failure pattern from slop-canon (closed card respawn / clean exit leak)
 */
export const COLD_MAP_5_MANIFOLD = [
  {
    name: "hollow_stub",
    description: "Empty room / hollow stub with zero definitions and near-zero body",
    vector: l2Normalize([Math.log1p(10), 0.01, Math.log1p(1), 0, 0]) as SpectralVector5D,
  },
  {
    name: "unstructured_dump",
    description: "Massive unstructured code dump without functions/classes or modular boundaries",
    vector: l2Normalize([Math.log1p(25_000), 0.45, Math.log1p(2_000), 0, 0]) as SpectralVector5D,
  },
  {
    name: "coupling_blowout",
    description: "Runaway external coupling and imports with no local definitions or interfaces",
    vector: l2Normalize([Math.log1p(1_500), 0.25, Math.log1p(50), 0, Math.log1p(40)]) as SpectralVector5D,
  },
  {
    name: "hubjob_done_respawn",
    description: "Slop-canon failure: unacknowledged state leak and premature exit violation",
    vector: structuralFingerprint(
      "A job that already closed looks like every other green tile. The page can reopen it with a status click. A worker that exits cleanly without closing the card is counted as a crash and started again."
    ),
  },
] as const;

// ─────────────────────────────────────────────────────────────────
// AUDIT ENGINE
// ─────────────────────────────────────────────────────────────────

/**
 * Score a proposed text/diff against baseline and the cold-map failure manifold.
 * Takes < 1ms on any CPU.
 */
export function scoreSpectralDiff(currentText: string, baseText?: string): SpectralAuditReport {
  const start = performance.now();
  const currentVec = structuralFingerprint(currentText);

  const rawChars = currentText.length;
  const rawLines = currentText.length > 0 ? currentText.split("\n").length : 0;
  const rawDefs = (currentText.match(/\b(function|def|class|struct|impl|interface|type|fn)\b/g) || []).length;
  const rawImports = (currentText.match(/\b(import|from|require|include|use)\b/g) || []).length;

  // Measure shatter: against baseline if provided, else against canonical reference centroid
  let shatter: number;
  if (baseText !== undefined && baseText.trim().length > 0) {
    const baseVec = structuralFingerprint(baseText);
    shatter = computeShatter(currentVec, baseVec);
  } else {
    shatter = computeShatter(currentVec, CANONICAL_CODE_CENTROID);
  }

  // Measure distance to cold-map failure manifold
  let minColdDistance = Infinity;
  for (const failurePoint of COLD_MAP_5_MANIFOLD) {
    const dist = cosineDistance(currentVec, failurePoint.vector as unknown as number[]);
    if (dist < minColdDistance) {
      minColdDistance = dist;
    }
  }

  // Failure manifold conditions:
  // 1. Hollow stub (empty room): chars < 50, defs = 0, imports = 0
  // 2. Unstructured bloat dump: lines > 100, defs = 0, imports = 0
  // 3. Extreme manifold singularity: minColdDistance < 0.005
  let hitFailureMode: string | null = null;
  if (rawChars < 50 && rawDefs === 0 && rawImports === 0) {
    hitFailureMode = "hollow_stub";
  } else if (rawLines > 100 && rawDefs === 0 && rawImports === 0) {
    hitFailureMode = "unstructured_dump";
  } else if (minColdDistance < 0.005) {
    hitFailureMode = "cold_manifold_proximity";
  }

  const heat = computeHeat(currentVec);
  const failureProximity = hitFailureMode !== null;

  // Recommendation thresholds per terrain contract:
  // shatter < 0.05: ANCHOR
  // 0.05 <= shatter <= 0.15: REVIEW
  // shatter > 0.15: SHATTER_RESOLVE
  let recommendation: "ANCHOR" | "REVIEW" | "SHATTER_RESOLVE";
  let verdict: "pass" | "watch" | "block";

  if (failureProximity || shatter > 0.15) {
    recommendation = "SHATTER_RESOLVE";
    verdict = "block";
  } else if (shatter > 0.05) {
    recommendation = "REVIEW";
    verdict = "watch";
  } else {
    recommendation = "ANCHOR";
    verdict = "pass";
  }

  const computeTimeMs = Number((performance.now() - start).toFixed(3));

  let receipt = "";
  if (failureProximity && shatter > 0.15) {
    receipt = `Shatter critical: Δshatter ${shatter.toFixed(4)} > 0.15 & cold-map alert ("${hitFailureMode}", dist: ${minColdDistance.toFixed(4)})`;
  } else if (failureProximity) {
    receipt = `Cold-map alert: proximity to fatal manifold "${hitFailureMode}" (dist: ${minColdDistance.toFixed(4)})`;
  } else if (shatter > 0.15) {
    receipt = `Shatter critical: Δshatter ${shatter.toFixed(4)} > 0.15 threshold (SHATTER_RESOLVE)`;
  } else if (shatter > 0.05) {
    receipt = `Shatter review: Δshatter ${shatter.toFixed(4)} in 0.05–0.15 band (REVIEW)`;
  } else {
    receipt = `Canonical anchor: Δshatter ${shatter.toFixed(4)} within safe harbor (<0.05)`;
  }

  return {
    vector: currentVec,
    dimensions: {
      size: Number(currentVec[0].toFixed(4)),
      complexityHash: Number(currentVec[1].toFixed(4)),
      structureLines: Number(currentVec[2].toFixed(4)),
      defDensity: Number(currentVec[3].toFixed(4)),
      couplingImports: Number(currentVec[4].toFixed(4)),
    },
    heat: Number(heat.toFixed(4)),
    shatter: Number(shatter.toFixed(4)),
    coldDistance: Number(minColdDistance.toFixed(4)),
    recommendation,
    failureProximity,
    verdict,
    receipt,
    computeTimeMs,
  };
}
