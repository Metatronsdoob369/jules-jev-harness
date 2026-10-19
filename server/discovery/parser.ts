import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";
import type {
  JoinKeyDefinition,
  JoinKeyType,
  EndpointNode,
  AgencyNode,
  CrosswalkEdge,
} from "./types.js";

export const CANONICAL_JOIN_KEYS: JoinKeyDefinition[] = [
  {
    id: "SPATIAL_ZIP5",
    canonicalName: "5-Digit Postal ZIP Code",
    description: "USPS 5-digit delivery area code used for localized spatial aggregation",
    dataType: "string",
    regexPattern: "^[0-9]{5}$",
  },
  {
    id: "SPATIAL_GEOID",
    canonicalName: "Census FIPS / Tract GEOID",
    description: "Standard 2-state, 5-county, or 11-tract Census geographic identifier",
    dataType: "string",
    regexPattern: "^[0-9]{2,11}$",
  },
  {
    id: "SPATIAL_COORDINATES",
    canonicalName: "Latitude & Longitude Bounding Box",
    description: "WGS84 decimal degree spatial coordinates",
    dataType: "coordinates",
  },
  {
    id: "CORPORATE_CIK",
    canonicalName: "SEC Central Index Key",
    description: "10-digit unique identifier for public corporations and SEC registrants",
    dataType: "string",
    regexPattern: "^[0-9]{10}$",
  },
  {
    id: "CORPORATE_EIN",
    canonicalName: "IRS Employer Identification Number",
    description: "Federal tax identifier for corporate and commercial entities",
    dataType: "string",
    regexPattern: "^[0-9]{2}-[0-9]{7}$",
  },
  {
    id: "CORPORATE_UEI",
    canonicalName: "SAM.gov Unique Entity Identifier",
    description: "12-character alphanumeric identifier for federal contractors and awardees",
    dataType: "string",
    regexPattern: "^[A-Z0-9]{12}$",
  },
  {
    id: "TEMPORAL_DATE",
    canonicalName: "ISO 8601 Calendar Date",
    description: "Daily timestamp formatted as YYYY-MM-DD",
    dataType: "date",
    regexPattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
  },
  {
    id: "TEMPORAL_MONTH",
    canonicalName: "Monthly Period",
    description: "Monthly aggregation formatted as YYYY-MM",
    dataType: "date",
    regexPattern: "^[0-9]{4}-[0-9]{2}$",
  },
  {
    id: "TEMPORAL_QUARTER",
    canonicalName: "Quarterly Financial Period",
    description: "Fiscal quarter formatted as YYYY-Q#",
    dataType: "string",
    regexPattern: "^[0-9]{4}-Q[1-4]$",
  },
  {
    id: "MACRO_SERIES_ID",
    canonicalName: "Macroeconomic Series Identifier",
    description: "FRED, Treasury, or BLS economic time-series identifier",
    dataType: "string",
  },
  {
    id: "INDUSTRY_NAICS",
    canonicalName: "NAICS Industry Code",
    description: "North American Industry Classification System 6-digit classification",
    dataType: "integer",
    regexPattern: "^[0-9]{2,6}$",
  },
  {
    id: "AGRICULTURE_COMMODITY",
    canonicalName: "USDA Agricultural Commodity ID",
    description: "Commodity and crop classification code",
    dataType: "string",
  },
  {
    id: "GOV_AWARD_ID",
    canonicalName: "Federal Award / Contract ID",
    description: "USASpending federal grant, contract, or loan award PIID/FAIN",
    dataType: "string",
  },
  {
    id: "FINANCIAL_CUSIP",
    canonicalName: "CUSIP Security Identifier",
    description: "9-character alphanumeric financial security identifier",
    dataType: "string",
    regexPattern: "^[A-Z0-9]{9}$",
  },
];

export const CANONICAL_CROSSWALKS: CrosswalkEdge[] = [
  {
    id: "crosswalk_zip_to_geoid",
    fromKey: "SPATIAL_ZIP5",
    toKey: "SPATIAL_GEOID",
    name: "HUD-USPS ZIP Code to Census Tract Crosswalk",
    confidence: 0.98,
    transformationFn: "hud_crosswalk_zip_to_tract_v1",
  },
  {
    id: "crosswalk_ein_to_cik",
    fromKey: "CORPORATE_EIN",
    toKey: "CORPORATE_CIK",
    name: "SEC-IRS Corporate Entity Mapping Crosswalk",
    confidence: 0.95,
    transformationFn: "sec_company_tickers_ein_map",
  },
  {
    id: "crosswalk_uei_to_ein",
    fromKey: "CORPORATE_UEI",
    toKey: "CORPORATE_EIN",
    name: "SAM.gov Federal Entity UEI-to-TIN Crosswalk",
    confidence: 0.99,
    transformationFn: "sam_entity_tax_bridge",
  },
  {
    id: "crosswalk_date_to_month",
    fromKey: "TEMPORAL_DATE",
    toKey: "TEMPORAL_MONTH",
    name: "Daily to Monthly Calendar Aggregation",
    confidence: 1.0,
    transformationFn: "date_trunc_month",
  },
  {
    id: "crosswalk_month_to_quarter",
    fromKey: "TEMPORAL_MONTH",
    toKey: "TEMPORAL_QUARTER",
    name: "Monthly to Fiscal Quarter Aggregation",
    confidence: 1.0,
    transformationFn: "date_trunc_quarter",
  },
  {
    id: "crosswalk_coords_to_geoid",
    fromKey: "SPATIAL_COORDINATES",
    toKey: "SPATIAL_GEOID",
    name: "US Census TIGER Reverse Geocoder",
    confidence: 0.99,
    transformationFn: "census_tiger_coords_to_tract",
  },
];

export const FOUNDATIONAL_ENDPOINTS: EndpointNode[] = [
  {
    id: "fred_h8_cre",
    name: "FRED H.8 Commercial Real Estate Loans",
    agency: "Federal Reserve Board",
    url: "https://fred.stlouisfed.org/series/H8B1023NCBC",
    domain: "credit",
    emitsKeys: ["MACRO_SERIES_ID", "TEMPORAL_MONTH", "SPATIAL_GEOID"],
    acceptsKeys: ["MACRO_SERIES_ID", "TEMPORAL_DATE"],
    documentation: "Weekly and monthly bank assets and liabilities for CRE lending by district",
    isNoKeyNeeded: false,
  },
  {
    id: "treasury_debt_penny",
    name: "Treasury Fiscal Data - Debt to the Penny",
    agency: "Department of the Treasury",
    url: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny",
    domain: "macro",
    emitsKeys: ["MACRO_SERIES_ID", "TEMPORAL_DATE"],
    acceptsKeys: ["TEMPORAL_DATE"],
    documentation: "Daily debt subject to legal limit and total public debt outstanding",
    isNoKeyNeeded: true,
  },
  {
    id: "sec_edgar_company_facts",
    name: "SEC EDGAR Financial Statement XBRL Facts",
    agency: "Securities and Exchange Commission",
    url: "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json",
    domain: "corporate",
    emitsKeys: ["CORPORATE_CIK", "TEMPORAL_QUARTER", "SPATIAL_ZIP5"],
    acceptsKeys: ["CORPORATE_CIK"],
    documentation: "Quarterly and annual financial statements, lease liabilities, and defaults",
    isNoKeyNeeded: true,
  },
  {
    id: "usps_dpv_vacancy",
    name: "USPS PostalPro DPV 90-Day Vacancy Sensor",
    agency: "United States Postal Service",
    url: "https://postalpro.usps.com/address-quality/ais",
    domain: "real_estate",
    emitsKeys: ["SPATIAL_ZIP5", "SPATIAL_GEOID", "TEMPORAL_MONTH"],
    acceptsKeys: ["SPATIAL_ZIP5"],
    documentation: "Quarterly 90-day delivery point vacancy indicator for physical property abandonment",
    isNoKeyNeeded: true,
  },
  {
    id: "census_acs_5yr_econ",
    name: "Census American Community Survey (ACS) 5-Year Profile",
    agency: "Bureau of the Census",
    url: "https://api.census.gov/data/2022/acs/acs5/profile",
    domain: "real_estate",
    emitsKeys: ["SPATIAL_GEOID", "SPATIAL_ZIP5", "TEMPORAL_MONTH"],
    acceptsKeys: ["SPATIAL_GEOID"],
    documentation: "Median household income, gross rent percentage, housing vacancies by tract",
    isNoKeyNeeded: true,
  },
  {
    id: "google_cloudsearch_rest",
    name: "Google Cloud Search REST Indexing & Query API",
    agency: "Google Workspace / Enterprise",
    url: "https://cloudsearch.googleapis.com/v1/query/search",
    domain: "procurement",
    emitsKeys: ["GOV_AWARD_ID", "CORPORATE_CIK", "SPATIAL_ZIP5"],
    acceptsKeys: ["SPATIAL_GEOID", "TEMPORAL_DATE"],
    documentation: "Cloud Search enterprise discovery index over structured entity repositories",
    isNoKeyNeeded: false,
  },
];

interface RawYamlAgency {
  name: string;
  apis?: Array<{
    name: string;
    url: string;
  }>;
}

export function parseAllTheXEndpoints(filePath?: string): {
  agencies: AgencyNode[];
  endpoints: EndpointNode[];
} {
  const targetPath =
    filePath ||
    path.join(
      process.env.HOME || "/Users/joewales",
      "API-All-the-X",
      "_data",
      "individual_apis.yml"
    );

  if (!fs.existsSync(targetPath)) {
    return {
      agencies: [
        { id: "agency_fed", name: "Federal Reserve Board" },
        { id: "agency_treasury", name: "Department of the Treasury" },
        { id: "agency_sec", name: "Securities and Exchange Commission" },
        { id: "agency_usps", name: "United States Postal Service" },
      ],
      endpoints: [...FOUNDATIONAL_ENDPOINTS],
    };
  }

  const fileContent = fs.readFileSync(targetPath, "utf-8");
  const rawData = yaml.parse(fileContent) as RawYamlAgency[];

  const agencies: AgencyNode[] = [];
  const endpoints: EndpointNode[] = [...FOUNDATIONAL_ENDPOINTS];
  const seenEndpointIds = new Set<string>(endpoints.map((e) => e.id));

  for (const rawAgency of rawData) {
    if (!rawAgency || !rawAgency.name) continue;
    const agencyName = rawAgency.name.trim();
    const agencyId = agencyName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    agencies.push({
      id: agencyId,
      name: agencyName,
    });

    if (Array.isArray(rawAgency.apis)) {
      for (const api of rawAgency.apis) {
        if (!api || !api.name) continue;
        const apiName = api.name.trim();
        const endpointId = `${agencyId}_${apiName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`.slice(
          0,
          64
        );

        if (seenEndpointIds.has(endpointId)) continue;
        seenEndpointIds.add(endpointId);

        const lowerText = `${agencyName} ${apiName} ${api.url || ""}`.toLowerCase();

        let domain: EndpointNode["domain"] = "general_gov";
        const emitsKeys: JoinKeyType[] = ["TEMPORAL_DATE"];
        const acceptsKeys: JoinKeyType[] = [];

        if (
          lowerText.includes("usaspending") ||
          lowerText.includes("permit") ||
          lowerText.includes("procurement") ||
          lowerText.includes("contract") ||
          lowerText.includes("award")
        ) {
          domain = "procurement";
          emitsKeys.push("GOV_AWARD_ID", "CORPORATE_UEI", "SPATIAL_ZIP5");
          acceptsKeys.push("GOV_AWARD_ID", "CORPORATE_UEI");
        } else if (
          lowerText.includes("farmers") ||
          lowerText.includes("organic") ||
          lowerText.includes("nutrient") ||
          lowerText.includes("agriculture") ||
          lowerText.includes("aphis") ||
          lowerText.includes("crop")
        ) {
          domain = "agriculture";
          emitsKeys.push("AGRICULTURE_COMMODITY", "SPATIAL_GEOID");
          acceptsKeys.push("SPATIAL_GEOID", "AGRICULTURE_COMMODITY");
        } else if (
          lowerText.includes("geospatial") ||
          lowerText.includes("imagery") ||
          lowerText.includes("site finder") ||
          lowerText.includes("forest") ||
          lowerText.includes("park") ||
          lowerText.includes("recreation") ||
          lowerText.includes("ridb")
        ) {
          domain = "real_estate";
          emitsKeys.push("SPATIAL_GEOID", "SPATIAL_COORDINATES");
          acceptsKeys.push("SPATIAL_GEOID");
        } else if (
          lowerText.includes("economic") ||
          lowerText.includes("food dollar") ||
          lowerText.includes("arms") ||
          lowerText.includes("credit") ||
          lowerText.includes("debt") ||
          lowerText.includes("finance")
        ) {
          domain = "credit";
          emitsKeys.push("MACRO_SERIES_ID", "TEMPORAL_QUARTER");
          acceptsKeys.push("MACRO_SERIES_ID");
        } else if (
          lowerText.includes("labor") ||
          lowerText.includes("workforce") ||
          lowerText.includes("osha") ||
          lowerText.includes("industry")
        ) {
          domain = "labor";
          emitsKeys.push("INDUSTRY_NAICS", "SPATIAL_GEOID");
          acceptsKeys.push("INDUSTRY_NAICS");
        } else if (
          lowerText.includes("sec") ||
          lowerText.includes("edgar") ||
          lowerText.includes("corporat")
        ) {
          domain = "corporate";
          emitsKeys.push("CORPORATE_CIK", "CORPORATE_EIN", "TEMPORAL_QUARTER");
          acceptsKeys.push("CORPORATE_CIK");
        }

        endpoints.push({
          id: endpointId,
          name: apiName,
          agency: agencyName,
          url: api.url || "",
          domain,
          emitsKeys: Array.from(new Set(emitsKeys)),
          acceptsKeys: Array.from(new Set(acceptsKeys)),
          isNoKeyNeeded: !api.url || api.url.includes("api.data.gov") ? false : true,
        });
      }
    }
  }

  return { agencies, endpoints };
}
