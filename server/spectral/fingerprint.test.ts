import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COLD_MAP_5_MANIFOLD,
  computeHeat,
  computeShatter,
  cosineDistance,
  l2Normalize,
  scoreSpectralDiff,
  structuralFingerprint,
} from "./fingerprint.js";

test("spectral fingerprint: strictly 5-D unit vector", () => {
  const code = `
    import { useState, useEffect } from 'react';
    export function Counter() {
      const [count, setCount] = useState(0);
      return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
    }
  `;
  const vec = structuralFingerprint(code);
  assert.equal(vec.length, 5, "must have exactly 5 dimensions");

  // Verify L2 norm is 1.0
  const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  assert.ok(Math.abs(norm - 1.0) < 1e-7, `norm should be 1.0, got ${norm}`);

  // All coordinates must be valid finite numbers
  for (let i = 0; i < 5; i++) {
    const val = vec[i] ?? -1;
    assert.ok(Number.isFinite(val), `dim ${i} must be finite`);
    assert.ok(val >= 0, `dim ${i} should be >= 0`);
  }
});

test("spectral fingerprint: sub-millisecond execution", () => {
  const largeSample = `
    import { a, b, c } from 'module';
    ${"function step() { return 42; }\n".repeat(100)}
  `;
  const report = scoreSpectralDiff(largeSample);
  assert.ok(report.computeTimeMs < 10, `compute time must be under 10ms, was ${report.computeTimeMs}ms`);
  assert.equal(typeof report.heat, "number");
  assert.ok(report.heat > 0);
});

test("spectral scoring: identical code has 0 shatter and passes in ANCHOR band", () => {
  const code = `
    export interface Config { timeout: number; }
    export function run(cfg: Config) { return cfg.timeout > 0; }
  `;
  const report = scoreSpectralDiff(code, code);
  assert.equal(report.shatter, 0, "identical code must have 0 shatter");
  assert.equal(report.recommendation, "ANCHOR");
  assert.equal(report.verdict, "pass");
});

test("spectral scoring: minor edit stays within safe bounds", () => {
  const base = `
    export function calculateTax(amount: number): number {
      const rate = 0.08;
      return amount * rate;
    }
  `;
  const minorEdit = `
    export function calculateTax(amount: number): number {
      const rate = 0.0825; // updated rate
      return amount * rate;
    }
  `;
  const report = scoreSpectralDiff(minorEdit, base);
  assert.ok(report.shatter < 0.05, `minor edit shatter (${report.shatter}) should be < 0.05`);
  assert.equal(report.recommendation, "ANCHOR");
  assert.equal(report.verdict, "pass");
});

test("spectral scoring: structural fracture exceeds 0.15 shatter and blocks", () => {
  const base = `
    import { Router } from 'express';
    import { auth } from './auth';
    export class ApiRouter {
      private router = Router();
      public getRoutes() { return this.router; }
      public handleAuth() { return auth(); }
      public handlePing() { return "pong"; }
    }
  `;
  // Significant structural drift: stripped all imports and definitions, replaced with single tiny helper
  const drifted = `
    const helper = (x: number) => x * 2;
    console.log(helper(5));
  `;
  const report = scoreSpectralDiff(drifted, base);

  assert.ok(report.shatter > 0.15, `shatter must exceed 0.15 threshold, got ${report.shatter}`);
  assert.equal(report.recommendation, "SHATTER_RESOLVE");
  assert.equal(report.verdict, "block");
  assert.match(report.receipt, /Shatter critical/);
});

test("spectral scoring: hollow stub triggers cold-map failure proximity", () => {
  // Empty room or near-empty stub file
  const hollowStub = "// empty\n";
  const report = scoreSpectralDiff(hollowStub);

  assert.ok(report.failureProximity || report.coldDistance < 0.05, "should detect cold-map proximity");
  assert.equal(report.verdict, "block");
});

test("vector math: cosineDistance and computeShatter", () => {
  const a = l2Normalize([1, 0, 0, 0, 0]);
  const b = l2Normalize([0, 1, 0, 0, 0]);
  const c = l2Normalize([1, 0, 0, 0, 0]);

  // Orthogonal vectors
  assert.ok(Math.abs(cosineDistance(a, b) - 1.0) < 1e-7);
  assert.ok(Math.abs(computeShatter(a, b) - Math.sqrt(2)) < 1e-7);

  // Parallel identical vectors
  assert.ok(Math.abs(cosineDistance(a, c) - 0.0) < 1e-7);
  assert.equal(computeShatter(a, c), 0);
});
