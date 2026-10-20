import {
  CANONICAL_JOIN_KEYS,
  CANONICAL_CROSSWALKS,
  parseAllTheXEndpoints,
} from "./parser.js";
import type {
  JoinKeyDefinition,
  JoinKeyType,
  EndpointNode,
  AgencyNode,
  CrosswalkEdge,
  DiscoveredCorrelationEdge,
  HypothesisCandidate,
  GraphStats,
} from "./types.js";

export class DiscoveryGraph {
  public agencies = new Map<string, AgencyNode>();
  public endpoints = new Map<string, EndpointNode>();
  public joinKeys = new Map<JoinKeyType, JoinKeyDefinition>();
  public crosswalks: CrosswalkEdge[] = [];
  public correlations: DiscoveredCorrelationEdge[] = [];
  public hypotheses: HypothesisCandidate[] = [];

  constructor(customYamlPath?: string) {
    this.initialize(customYamlPath);
  }

  public initialize(customYamlPath?: string): void {
    // 1. Load canonical join keys
    for (const key of CANONICAL_JOIN_KEYS) {
      this.joinKeys.set(key.id, key);
    }

    // 2. Load crosswalks
    this.crosswalks = [...CANONICAL_CROSSWALKS];

    // 3. Ingest endpoints and agencies
    const { agencies, endpoints } = parseAllTheXEndpoints(customYamlPath);
    for (const agency of agencies) {
      this.agencies.set(agency.id, agency);
    }
    for (const endpoint of endpoints) {
      this.endpoints.set(endpoint.id, endpoint);
    }

    // 4. Pre-seed canonical discovered correlation (historical baseline)
    this.correlations.push({
      id: "corr_fred_cre_vs_usps_dpv",
      sourceEndpointId: "fred_h8_cre",
      targetEndpointId: "usps_dpv_vacancy",
      joinPath: ["SPATIAL_GEOID", "SPATIAL_ZIP5"],
      pValue: 0.0034,
      correlationR: 0.782,
      leadTimeDays: 90,
      lastVerified: "2026-10-15",
      branch: "exp/fred-usps-01073",
      prUrl: "https://github.com/Metatronsdoob369/jules-jev-harness/pull/1",
    });

    // 5. Synthesize candidate hypotheses
    this.synthesizeHypotheses(15);
  }

  public getStats(): GraphStats {
    return {
      totalAgencies: this.agencies.size,
      totalEndpoints: this.endpoints.size,
      totalJoinKeys: this.joinKeys.size,
      totalCrosswalkBridges: this.crosswalks.length,
      totalDiscoveredCorrelations: this.correlations.length,
      totalCandidateHypotheses: this.hypotheses.length,
    };
  }

  /**
   * Evaluates if two endpoints can join directly or via a 1-hop crosswalk.
   */
  public findJoinPaths(
    sourceId: string,
    targetId: string
  ): {
    fromKey: JoinKeyType;
    toKey: JoinKeyType;
    viaCrosswalk?: string;
  } | null {
    const source = this.endpoints.get(sourceId);
    const target = this.endpoints.get(targetId);
    if (!source || !target) return null;

    // 1. Direct operational input overlap (target accepts what source emits)
    for (const sKey of source.emitsKeys) {
      if (target.acceptsKeys.includes(sKey)) {
        return { fromKey: sKey, toKey: sKey };
      }
    }

    // 2. 2-hop bridge via crosswalk to target input
    for (const sKey of source.emitsKeys) {
      for (const cross of this.crosswalks) {
        if (cross.fromKey === sKey && target.acceptsKeys.includes(cross.toKey)) {
          return {
            fromKey: sKey,
            toKey: cross.toKey,
            viaCrosswalk: cross.name,
          };
        }
        if (cross.toKey === sKey && target.acceptsKeys.includes(cross.fromKey)) {
          return {
            fromKey: sKey,
            toKey: cross.fromKey,
            viaCrosswalk: cross.name,
          };
        }
      }
    }

    // 3. Mutual dimension overlap (both emit same key, e.g. spatial tract or month)
    for (const sKey of source.emitsKeys) {
      if (target.emitsKeys.includes(sKey)) {
        return { fromKey: sKey, toKey: sKey };
      }
    }

    // 4. Mutual dimension via crosswalk
    for (const sKey of source.emitsKeys) {
      for (const cross of this.crosswalks) {
        if (cross.fromKey === sKey && target.emitsKeys.includes(cross.toKey)) {
          return {
            fromKey: sKey,
            toKey: cross.toKey,
            viaCrosswalk: cross.name,
          };
        }
        if (cross.toKey === sKey && target.emitsKeys.includes(cross.fromKey)) {
          return {
            fromKey: sKey,
            toKey: cross.fromKey,
            viaCrosswalk: cross.name,
          };
        }
      }
    }

    return null;
  }

  /**
   * Traverses endpoint graph to find non-obvious cross-agency correlation candidates.
   */
  public synthesizeHypotheses(maxLimit = 10): HypothesisCandidate[] {
    const candidates: HypothesisCandidate[] = [];
    const testedPairs = new Set<string>();

    for (const corr of this.correlations) {
      testedPairs.add(`${corr.sourceEndpointId}:${corr.targetEndpointId}`);
      testedPairs.add(`${corr.targetEndpointId}:${corr.sourceEndpointId}`);
    }

    const endpointList = Array.from(this.endpoints.values());

    for (let i = 0; i < endpointList.length; i++) {
      const src = endpointList[i];
      if (!src) continue;
      let srcCount = 0;

      for (let j = i + 1; j < endpointList.length; j++) {
        const dst = endpointList[j];
        if (!dst) continue;

        // Skip same agency
        if (src.agency === dst.agency) continue;

        // Skip already tested
        const pairKey = `${src.id}:${dst.id}`;
        if (testedPairs.has(pairKey)) continue;

        const path = this.findJoinPaths(src.id, dst.id);
        if (!path) continue;

        // Score hypothesis: high score if cross-domain (e.g. macro vs real_estate, credit vs corporate)
        let domainBonus = 1.0;
        if (
          (src.domain === "credit" && dst.domain === "real_estate") ||
          (src.domain === "macro" && dst.domain === "corporate") ||
          (src.domain === "procurement" && dst.domain === "corporate") ||
          (src.domain === "real_estate" && dst.domain === "corporate") ||
          (src.domain === "corporate" && dst.domain === "real_estate")
        ) {
          domainBonus = 1.6;
        }

        const confidence = (path.viaCrosswalk ? 0.85 : 0.95) * domainBonus;

        const hypothesisId = `hyp_${src.id}_${dst.id}`.slice(0, 48);
        const title = `Correlate [${src.name}] + [${dst.name}] across [${path.fromKey}${
          path.viaCrosswalk ? ` ➔ ${path.toKey}` : ""
        }]`;

        const rationale = path.viaCrosswalk
          ? `Crosswalk join from ${path.fromKey} to ${path.toKey} via ${path.viaCrosswalk}. Tests if lead-indicator shifts in ${src.name} predict downstream anomalies in ${dst.name}.`
          : `Direct spatial/temporal join on ${path.fromKey}. Tests if variations in ${src.name} (${src.agency}) exhibit predictive causality against ${dst.name} (${dst.agency}).`;

        candidates.push({
          id: hypothesisId,
          title,
          sourceEndpoint: src,
          targetEndpoint: dst,
          joinPath: path,
          rationale,
          estimatedLeadTimeDays: src.domain === "credit" ? 90 : 60,
          status: "candidate",
          confidenceScore: Math.min(1.0, confidence),
        });

        srcCount++;
        if (srcCount >= 2) break;
      }
      if (candidates.length >= maxLimit * 3) break;
    }

    // Sort by confidence score descending
    candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
    this.hypotheses = candidates.slice(0, maxLimit);
    return this.hypotheses;
  }

  /**
   * Generates BigQuery GoogleSQL `CREATE PROPERTY GRAPH` DDL definition.
   * Conforms to the ISO GQL standard supported by BigQuery.
   */
  public exportToBigQueryGqlDDL(
    project = "metatrons-doob-369",
    dataset = "discovery_engine",
    graphName = "federal_knowledge_graph"
  ): string {
    return `-- BigQuery Property Graph DDL (GoogleSQL ISO GQL standard)
-- Generated automatically by Jules-Jev Discovery Engine
-- Total Endpoints: ${this.endpoints.size} | Total Join Keys: ${this.joinKeys.size} | Total Crosswalks: ${this.crosswalks.length}

CREATE OR REPLACE PROPERTY GRAPH \`${project}.${dataset}.${graphName}\`
  NODE TABLES (
    \`${project}.${dataset}.node_endpoints\` AS endpoint
      KEY (endpoint_id)
      LABEL \`Endpoint\`
      PROPERTIES (endpoint_id, name, agency, url, domain, is_no_key_needed),

    \`${project}.${dataset}.node_join_keys\` AS join_key
      KEY (key_id)
      LABEL \`JoinKey\`
      PROPERTIES (key_id, canonical_name, description, data_type)
  )
  EDGE TABLES (
    \`${project}.${dataset}.edge_emits\` AS emits
      KEY (emit_id)
      SOURCE KEY (endpoint_id) REFERENCES endpoint (endpoint_id)
      DESTINATION KEY (key_id) REFERENCES join_key (key_id)
      LABEL \`Emits\`,

    \`${project}.${dataset}.edge_accepts\` AS accepts
      KEY (accept_id)
      SOURCE KEY (endpoint_id) REFERENCES endpoint (endpoint_id)
      DESTINATION KEY (key_id) REFERENCES join_key (key_id)
      LABEL \`Accepts\`,

    \`${project}.${dataset}.edge_crosswalks\` AS bridges
      KEY (crosswalk_id)
      SOURCE KEY (from_key_id) REFERENCES join_key (key_id)
      DESTINATION KEY (to_key_id) REFERENCES join_key (key_id)
      LABEL \`BridgesTo\`
      PROPERTIES (confidence, transformation_fn),

    \`${project}.${dataset}.edge_discovered_correlations\` AS correlates
      KEY (correlation_id)
      SOURCE KEY (source_endpoint_id) REFERENCES endpoint (endpoint_id)
      DESTINATION KEY (target_endpoint_id) REFERENCES endpoint (endpoint_id)
      LABEL \`DiscoveredCorrelation\`
      PROPERTIES (p_value, correlation_r, lead_time_days, last_verified, branch, pr_url)
  );

-- Example GQL Query to Discover Untested Multi-Variable Combinations:
-- GRAPH \`${project}.${dataset}.${graphName}\`
-- MATCH (macro:Endpoint)-[:Emits]->(k1:JoinKey)-[:BridgesTo]->(k2:JoinKey)<-[:Accepts]-(micro:Endpoint)
-- WHERE macro.agency != micro.agency
--   AND NOT EXISTS { MATCH (macro)-[:DiscoveredCorrelation]-(micro) }
-- RETURN macro.name AS source_macro, micro.name AS target_micro, k1.canonical_name AS from_axis, k2.canonical_name AS to_axis
-- LIMIT 10;
`;
  }
}

export const defaultDiscoveryGraph = new DiscoveryGraph();
