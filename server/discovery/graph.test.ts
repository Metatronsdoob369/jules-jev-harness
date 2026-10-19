import test from "node:test";
import assert from "node:assert/strict";
import { DiscoveryGraph } from "./graph.js";
import { CANONICAL_JOIN_KEYS, CANONICAL_CROSSWALKS } from "./parser.js";

test("discovery registry: canonical join keys are well-formed", () => {
  assert.ok(CANONICAL_JOIN_KEYS.length >= 12, "must have at least 12 canonical join keys");
  const spatialZip = CANONICAL_JOIN_KEYS.find((k) => k.id === "SPATIAL_ZIP5");
  assert.ok(spatialZip, "must include SPATIAL_ZIP5");
  assert.equal(spatialZip?.dataType, "string");

  const corpCik = CANONICAL_JOIN_KEYS.find((k) => k.id === "CORPORATE_CIK");
  assert.ok(corpCik, "must include CORPORATE_CIK");
});

test("discovery registry: crosswalk bridges cover spatial, corporate, and temporal", () => {
  assert.ok(CANONICAL_CROSSWALKS.length >= 5, "must include at least 5 crosswalks");
  const zipToGeoid = CANONICAL_CROSSWALKS.find(
    (c) => c.fromKey === "SPATIAL_ZIP5" && c.toKey === "SPATIAL_GEOID"
  );
  assert.ok(zipToGeoid, "must include ZIP-to-GEOID crosswalk");
  assert.ok((zipToGeoid?.confidence ?? 0) >= 0.95, "confidence must be high");
});

test("discovery graph: ingests API-All-the-X and foundational endpoints", () => {
  const graph = new DiscoveryGraph();
  const stats = graph.getStats();

  assert.ok(stats.totalEndpoints > 20, "must index dozens or hundreds of endpoints");
  assert.ok(stats.totalAgencies > 5, "must index multiple agencies");
  assert.ok(stats.totalJoinKeys >= 12, "all join keys indexed");
  assert.ok(stats.totalCrosswalkBridges >= 5, "crosswalks indexed");
  assert.ok(stats.totalDiscoveredCorrelations >= 1, "historical baseline correlation exists");
});

test("discovery graph: finds 1-hop and 2-hop join paths between disparate agencies", () => {
  const graph = new DiscoveryGraph();

  // FRED H.8 emits SPATIAL_GEOID. USPS DPV emits/accepts SPATIAL_ZIP5.
  // There is a crosswalk SPATIAL_ZIP5 -> SPATIAL_GEOID.
  const path = graph.findJoinPaths("fred_h8_cre", "usps_dpv_vacancy");
  assert.ok(path, "must find join path between FRED H.8 and USPS DPV");
  assert.ok(
    path?.fromKey === "SPATIAL_GEOID" || path?.fromKey === "SPATIAL_ZIP5",
    "must connect on spatial axis"
  );
});

test("discovery graph: synthesizes ranked hypotheses without testing duplicates", () => {
  const graph = new DiscoveryGraph();
  const hypotheses = graph.synthesizeHypotheses(5);

  assert.ok(hypotheses.length > 0, "must produce candidate hypotheses");
  assert.ok(hypotheses.length <= 5, "respects maxLimit");

  for (const hyp of hypotheses) {
    assert.ok(hyp.id.startsWith("hyp_"), "id must be formatted");
    assert.notEqual(
      hyp.sourceEndpoint.agency,
      hyp.targetEndpoint.agency,
      "source and target must be from different agencies"
    );
    assert.ok(hyp.confidenceScore > 0, "confidence score must be positive");
    assert.ok(hyp.title.length > 10, "hypothesis has a descriptive title");
  }
});

test("discovery graph: exports compliant BigQuery GoogleSQL GQL DDL", () => {
  const graph = new DiscoveryGraph();
  const ddl = graph.exportToBigQueryGqlDDL("metatrons-doob-369", "discovery_engine", "federal_graph");

  assert.ok(ddl.includes("CREATE OR REPLACE PROPERTY GRAPH"), "must contain CREATE PROPERTY GRAPH");
  assert.ok(ddl.includes("`metatrons-doob-369.discovery_engine.federal_graph`"), "must quote identifiers with backticks");
  assert.ok(ddl.includes("NODE TABLES"), "must contain NODE TABLES");
  assert.ok(ddl.includes("EDGE TABLES"), "must contain EDGE TABLES");
  assert.ok(ddl.includes("LABEL `Endpoint`"), "must specify GQL labels");
  assert.ok(ddl.includes("LABEL `JoinKey`"), "must specify JoinKey label");
  assert.ok(ddl.includes("LABEL `BridgesTo`"), "must specify BridgesTo label");
  assert.ok(!ddl.includes("CREATE CONSTRAINT"), "must not contain Cypher-specific syntax");
  assert.ok(!ddl.includes("MERGE ("), "must not contain Cypher-specific syntax");
});
