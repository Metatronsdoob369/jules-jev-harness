export type JoinKeyType =
  | "SPATIAL_ZIP5"
  | "SPATIAL_GEOID"
  | "SPATIAL_COORDINATES"
  | "CORPORATE_CIK"
  | "CORPORATE_EIN"
  | "CORPORATE_UEI"
  | "TEMPORAL_DATE"
  | "TEMPORAL_MONTH"
  | "TEMPORAL_QUARTER"
  | "MACRO_SERIES_ID"
  | "INDUSTRY_NAICS"
  | "AGRICULTURE_COMMODITY"
  | "GOV_AWARD_ID"
  | "FINANCIAL_CUSIP";

export interface JoinKeyDefinition {
  id: JoinKeyType;
  canonicalName: string;
  description: string;
  dataType: "string" | "integer" | "date" | "coordinates";
  regexPattern?: string;
}

export interface EndpointNode {
  id: string;
  name: string;
  agency: string;
  url: string;
  domain:
    | "macro"
    | "credit"
    | "real_estate"
    | "corporate"
    | "agriculture"
    | "procurement"
    | "labor"
    | "energy"
    | "general_gov";
  emitsKeys: JoinKeyType[];
  acceptsKeys: JoinKeyType[];
  documentation?: string;
  isNoKeyNeeded?: boolean;
}

export interface AgencyNode {
  id: string;
  name: string;
  parentDepartment?: string;
}

export interface CrosswalkEdge {
  id: string;
  fromKey: JoinKeyType;
  toKey: JoinKeyType;
  name: string;
  confidence: number;
  transformationFn: string;
}

export interface DiscoveredCorrelationEdge {
  id: string;
  sourceEndpointId: string;
  targetEndpointId: string;
  joinPath: JoinKeyType[];
  pValue: number;
  correlationR: number;
  leadTimeDays: number;
  lastVerified: string;
  branch: string;
  prUrl?: string;
}

export interface HypothesisCandidate {
  id: string;
  title: string;
  sourceEndpoint: EndpointNode;
  targetEndpoint: EndpointNode;
  joinPath: {
    fromKey: JoinKeyType;
    toKey: JoinKeyType;
    viaCrosswalk?: string;
  };
  rationale: string;
  estimatedLeadTimeDays: number;
  status: "candidate" | "queued" | "testing" | "proven" | "disproven";
  confidenceScore: number;
}

export interface GraphStats {
  totalAgencies: number;
  totalEndpoints: number;
  totalJoinKeys: number;
  totalCrosswalkBridges: number;
  totalDiscoveredCorrelations: number;
  totalCandidateHypotheses: number;
}
