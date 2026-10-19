import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Shield,
  Activity,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  ExternalLink,
  Play,
  RotateCcw,
  Zap,
  Globe,
  Compass,
  CheckCircle2,
  Lock,
  Cpu
} from 'lucide-react';

// ── Trace colors per agency sector (Metallic shimmer palette) ──
const SECTOR_COLORS = {
  TREASURY: { col: '#7ab0cc', label: 'US Treasury / Fiscal' },
  FRED:     { col: '#c88848', label: 'Federal Reserve / Macro' },
  BLS:      { col: '#6aa868', label: 'Labor Statistics / Inflation' },
  SEC:      { col: '#c4a038', label: 'SEC EDGAR / Corporate' },
  CENSUS:   { col: '#9080c0', label: 'Census Bureau / Spatial' },
  USDA:     { col: '#808898', label: 'Agriculture / Commodities' },
};

const SECTOR_KEYS = Object.keys(SECTOR_COLORS);

// ── Board Dimensions ──
const W = 1400;
const H = 900;
const CX = 700;
const CY = 440;

// Central Planar Disc Radius
const DISC_R = 145;

// Outer Endpoint Ring Radius
const RING_R = 375;

// Outer Arc ranges (degrees, 0 = right 3 o'clock CW)
const ARC_RANGES = {
  TREASURY: [-155, -95],
  FRED:     [-85,  -25],
  BLS:      [-15,   45],
  SEC:      [ 55,  115],
  CENSUS:   [125,  185],
  USDA:     [195,  255],
};

// 4 Join Key Micro-Chip Positions around planar disc
const JOIN_CHIPS = [
  { id: 'SPATIAL',   name: 'SPATIAL HUB',   keys: 'GEOID · FIPS · ZIP5',  x: 520, y: 280, color: '#38bdf8' },
  { id: 'TEMPORAL',  name: 'TEMPORAL HUB',  keys: 'DATE · MONTH · QTR',   x: 880, y: 280, color: '#fbbf24' },
  { id: 'COMMODITY', name: 'COMMODITY HUB', keys: 'NAICS · HS · CUSIP',   x: 880, y: 600, color: '#a855f7' },
  { id: 'CORPORATE', name: 'CORPORATE HUB', keys: 'CIK · LEI · EIN',      x: 520, y: 600, color: '#34d399' },
];

// Curated Endpoints per Agency (High-impact cross-agency macro endpoints)
const AGENCY_ENDPOINTS = {
  TREASURY: [
    { id: 'treas_debt_penny', name: 'Daily Sovereign Debt to Penny', key: 'TEMPORAL', tag: 'D_1789' },
    { id: 'treas_avg_rates', name: 'Average Interest Rates on Mkt Debt', key: 'TEMPORAL', tag: 'D_RATES' },
    { id: 'treas_yield_curve', name: 'Daily Treasury Par Yield Curve', key: 'TEMPORAL', tag: 'D_YIELD' },
    { id: 'treas_int_expense', name: 'Interest Expense on Public Debt', key: 'TEMPORAL', tag: 'M_EXP' },
    { id: 'treas_tips_spread', name: 'Real TIPS Inflation Breakeven', key: 'TEMPORAL', tag: 'D_TIPS' },
    { id: 'treas_auction_allot', name: 'Treasury Direct Auction Allotments', key: 'CORPORATE', tag: 'AUC_DIR' },
  ],
  FRED: [
    { id: 'fred_dgs10', name: '10-Year Constant Maturity Yield', key: 'TEMPORAL', tag: 'DGS10' },
    { id: 'fred_fedfunds', name: 'Effective Federal Funds Rate', key: 'TEMPORAL', tag: 'EFFR' },
    { id: 'fred_cre_loans', name: 'Real Estate Commercial Bank Loans', key: 'SPATIAL', tag: 'CRE_BK' },
    { id: 'fred_m2_money', name: 'M2 Sovereign Money Stock', key: 'TEMPORAL', tag: 'M2SL' },
    { id: 'fred_sahm_rule', name: 'Sahm Rule Recession Indicator', key: 'TEMPORAL', tag: 'SAHM' },
    { id: 'fred_delinq_rate', name: 'Delinquency on Commercial Mortgages', key: 'SPATIAL', tag: 'DRSFR' },
  ],
  BLS: [
    { id: 'bls_cpi_food', name: 'Consumer Price Index: Food at Home', key: 'COMMODITY', tag: 'CPI_FOOD' },
    { id: 'bls_cpi_shelter', name: 'CPI Urban Consumers: Shelter Index', key: 'SPATIAL', tag: 'CPI_SHEL' },
    { id: 'bls_ppi_diesel', name: 'Producer Price Index: #2 Diesel Fuel', key: 'COMMODITY', tag: 'PPI_ENG' },
    { id: 'bls_ces_employment', name: 'Total Nonfarm Payroll Employment', key: 'CORPORATE', tag: 'CES_EMP' },
    { id: 'bls_import_export', name: 'US Import / Export Price Indexes', key: 'COMMODITY', tag: 'X_IMP' },
    { id: 'bls_jolts_quits', name: 'JOLTS Voluntary Job Quits Rate', key: 'CORPORATE', tag: 'JOLTS' },
  ],
  SEC: [
    { id: 'sec_13f_holdings', name: 'Institutional 13F Asset Portfolios', key: 'CORPORATE', tag: 'FORM_13F' },
    { id: 'sec_form4_insider', name: 'Executive Insider Stock Transactions', key: 'CORPORATE', tag: 'FORM_4' },
    { id: 'sec_10k_risk_factor', name: '10-K Item 1A Risk Disclosures', key: 'CORPORATE', tag: '10K_RISK' },
    { id: 'sec_cor_fin_comment', name: 'Corp Fin SEC Review Letters', key: 'CORPORATE', tag: 'CF_COMM' },
    { id: 'sec_fail_to_deliver', name: 'Reg SHO Aggregate Fails-to-Deliver', key: 'COMMODITY', tag: 'FTD_EQUITY' },
    { id: 'sec_form8k_unsched', name: '8-K Unscheduled Material Events', key: 'CORPORATE', tag: '8K_MAT' },
  ],
  CENSUS: [
    { id: 'census_acs_median_inc', name: 'ACS 5-Yr County Median Income', key: 'SPATIAL', tag: 'ACS_B19013' },
    { id: 'census_building_permits', name: 'New Residential Construction Permits', key: 'SPATIAL', tag: 'B_PERMIT' },
    { id: 'census_trade_goods', name: 'Foreign Trade Merchandise Balance', key: 'COMMODITY', tag: 'FT_GOODS' },
    { id: 'census_pop_est', name: 'Annual Resident Population Estimates', key: 'SPATIAL', tag: 'PEP_POP' },
    { id: 'census_cbp_county', name: 'County Business Patterns Establishments', key: 'SPATIAL', tag: 'CBP_EST' },
    { id: 'census_qfr_finances', name: 'Quarterly Financial Mining & Mfg', key: 'CORPORATE', tag: 'QFR_MFG' },
  ],
  USDA: [
    { id: 'usda_corn_yield', name: 'NASS Monthly Corn Production & Yield', key: 'COMMODITY', tag: 'CORN_BU' },
    { id: 'usda_soy_crush', name: 'Oil crops Soybean Domestic Crush', key: 'COMMODITY', tag: 'SOY_OIL' },
    { id: 'usda_wheat_stocks', name: 'Quarterly Grain Stocks & Silo Reserves', key: 'COMMODITY', tag: 'WHT_STK' },
    { id: 'usda_ers_food_spend', name: 'ERS Food Dollar Consumption Share', key: 'TEMPORAL', tag: 'ERS_DOL' },
    { id: 'usda_fsa_disaster', name: 'FSA Emergency Crop Loss Assistance', key: 'SPATIAL', tag: 'FSA_LOSS' },
    { id: 'usda_fas_export_sales', name: 'FAS Weekly Foreign Export Commitments', key: 'COMMODITY', tag: 'FAS_EXP' },
  ]
};

// Target Reticles plotted on the Planar Sealed Earth Disc
// Math: polar projection r = DISC_R * (90 - lat)/180, angle = lon * pi/180
const SOVEREIGN_NODES = [
  { id: 'node_dc', name: 'DC Federal District', lat: 38.9072, lon: -77.0369, label: 'TREAS / BLS / SEC HQ', code: 'WDC_01' },
  { id: 'node_stl', name: 'St. Louis Federal Reserve', lat: 38.6270, lon: -90.1994, label: 'FRED REPO HUB', code: 'STL_08' },
  { id: 'node_nyc', name: 'New York Financial Core', lat: 40.7128, lon: -74.0060, label: 'NY FED / SEC 13F', code: 'NYC_02' },
  { id: 'node_nc', name: 'ONSC / Mountaindale Geospatial', lat: 35.9120, lon: -79.0123, label: 'PARCEL CAD GEE', code: 'ONSC_18' },
  { id: 'node_chicago', name: 'Chicago Mercantile CBOT', lat: 41.8781, lon: -87.6298, label: 'COMMODITY FUTURES', code: 'CME_07' },
];

function projectPlanar(lat, lon) {
  // Polar Azimuthal Equidistant projection
  const r = DISC_R * ((90 - lat) / 180);
  const ang = (lon * Math.PI) / 180;
  return {
    x: CX + r * Math.sin(ang),
    y: CY - r * Math.cos(ang),
  };
}

export default function DiscoveryJostleCanvas({ onDispatchTask, onClose }) {
  const canvasRef = useRef(null);
  const [hoveredEndpoint, setHoveredEndpoint] = useState(null);
  const [selectedSource, setSelectedSource] = useState(AGENCY_ENDPOINTS.TREASURY[0]);
  const [selectedTarget, setSelectedTarget] = useState(AGENCY_ENDPOINTS.FRED[0]);
  const [isFirmamentActive, setIsFirmamentActive] = useState(true);
  const [rotAngle, setRotAngle] = useState(0);

  // Rotating holographic firmament ring animation
  useEffect(() => {
    let frameId;
    const animateDome = () => {
      setRotAngle((prev) => (prev + 0.15) % 360);
      frameId = requestAnimationFrame(animateDome);
    };
    frameId = requestAnimationFrame(animateDome);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Living Canvas Grid - Ported from Jostle initGrid with mouse-following lerp
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let mx = W / 2;
    let my = H / 2;
    let tx = mx;
    let ty = my;
    let active = false;
    let time = 0;
    let raf = 0;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      tx = ((e.clientX - rect.left) / rect.width) * W;
      ty = ((e.clientY - rect.top) / rect.height) * H;
      active = true;
    };

    const handleMouseLeave = () => {
      active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      time += 0.002;
      if (active) {
        mx += (tx - mx) * 0.022; // smooth organic follow
        my += (ty - my) * 0.022;
      }

      ctx.clearRect(0, 0, W, H);

      // Subtle copper grid lines
      const sp = 48;
      const xc = Math.ceil(W / sp) + 1;
      const yc = Math.ceil(H / sp) + 1;

      for (let xi = 0; xi < xc; xi++) {
        for (let yi = 0; yi < yc; yi++) {
          const nx = Math.sin(time + yi * 0.08) * 6;
          const ny = Math.cos(time + xi * 0.08) * 6;
          const px = xi * sp + nx;
          const py = yi * sp + ny;

          const dc = Math.hypot(px - CX, py - CY);
          // Hollow out center where planar disc sits
          if (dc < DISC_R + 30) continue;

          const base = Math.max(0, 1 - dc / (Math.max(W, H) / 1.6)) * 0.15;
          const dm = Math.hypot(px - mx, py - my);
          const glow = active ? Math.max(0, 1 - dm / 220) * 0.35 : 0;
          const op = Math.min(1, base + glow);

          ctx.fillStyle = `rgba(200, 140, 60, ${op * 0.4})`;
          ctx.fillRect(px, py, 1.2, 1.2);
        }
      }

      raf = requestAnimationFrame(render);
    };

    render();
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Compute ring endpoints and trace paths
  const allEndpoints = useMemo(() => {
    const list = [];
    SECTOR_KEYS.forEach((sec) => {
      const eps = AGENCY_ENDPOINTS[sec];
      const [startDeg, endDeg] = ARC_RANGES[sec];
      const count = eps.length;

      eps.forEach((ep, i) => {
        const t = count > 1 ? i / (count - 1) : 0.5;
        const deg = startDeg + t * (endDeg - startDeg);
        const rad = (deg * Math.PI) / 180;
        const rx = CX + RING_R * Math.cos(rad);
        const ry = CY + RING_R * Math.sin(rad);

        // Find associated Join Chip
        const chip = JOIN_CHIPS.find((c) => c.id === ep.key) || JOIN_CHIPS[0];

        // Cubic bezier control points: fan inward from ring to chip
        const pull = 120;
        const c1x = rx - Math.cos(rad) * pull;
        const c1y = ry - Math.sin(rad) * pull;
        const c2x = chip.x + (rx > CX ? 35 : -35);
        const c2y = chip.y + (ry > CY ? 35 : -35);

        const dPath = `M ${rx} ${ry} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${chip.x} ${chip.y}`;

        list.push({
          ...ep,
          sector: sec,
          rx,
          ry,
          deg,
          chipX: chip.x,
          chipY: chip.y,
          chipId: chip.id,
          dPath,
        });
      });
    });
    return list;
  }, []);

  const activeHypothesis = useMemo(() => {
    return {
      title: `${selectedSource.name} ↔ ${selectedTarget.name}`,
      source: selectedSource,
      target: selectedTarget,
      joinKey: selectedSource.key === selectedTarget.key ? selectedSource.key : 'TEMPORAL_DATE',
      correlationR: 0.782,
      pValue: 0.0034,
      leadDays: 90,
      confidence: 96,
      ddl: `MATCH (m:Endpoint {name: "${selectedSource.name}"})\n  -[:Emits]->(k:JoinKey {canonical_name: "${selectedSource.key}"})\n  -[:BridgesTo]->(k2:JoinKey)\n  <-[:Accepts]-(t:Endpoint {name: "${selectedTarget.name}"})\nRETURN m.name, t.name, correlation_r = 0.782;`,
    };
  }, [selectedSource, selectedTarget]);

  return (
    <div className="relative w-full h-full bg-[#040711] overflow-hidden select-none font-mono text-slate-200">
      {/* ── Background Canvas Living Grid ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-0 opacity-80"
        style={{ width: '100%', height: '100%' }}
      />

      {/* ── SVG Layer for PCB Traces, Vias & Planar Earth System ── */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="absolute inset-0 w-full h-full z-10 pointer-events-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Radial Copper Gradient for Bezel */}
          <radialGradient id="bezelGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e1810" />
            <stop offset="70%" stopColor="#c88848" />
            <stop offset="90%" stopColor="#e8b878" />
            <stop offset="100%" stopColor="#3d2a14" />
          </radialGradient>

          {/* Firmament Glow Filter */}
          <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="copperGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── PCB Outer Motherboard Traces ── */}
        <g id="motherboard-traces">
          {allEndpoints.map((ep) => {
            const isHovered = hoveredEndpoint?.id === ep.id;
            const isSelected = selectedSource?.id === ep.id || selectedTarget?.id === ep.id;
            const sectorColor = SECTOR_COLORS[ep.sector].col;

            return (
              <path
                key={ep.id}
                d={ep.dPath}
                fill="none"
                stroke={isSelected ? '#00f2fe' : isHovered ? '#ffaa44' : sectorColor}
                strokeWidth={isSelected ? 2.5 : isHovered ? 2.0 : 0.85}
                strokeOpacity={isSelected ? 1.0 : isHovered ? 0.9 : 0.25}
                filter={isSelected || isHovered ? 'url(#copperGlow)' : undefined}
                className="transition-all duration-200"
              />
            );
          })}
        </g>

        {/* ── Outer Perimeter Arc Boundaries & Agency Labels ── */}
        {SECTOR_KEYS.map((sec) => {
          const [s, e] = ARC_RANGES[sec];
          const midDeg = (s + e) / 2;
          const rad = (midDeg * Math.PI) / 180;
          const lx = CX + (RING_R + 28) * Math.cos(rad);
          const ly = CY + (RING_R + 28) * Math.sin(rad);

          return (
            <text
              key={sec}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[10px] font-sans font-bold tracking-widest uppercase pointer-events-none"
              fill={SECTOR_COLORS[sec].col}
              opacity={0.8}
            >
              {sec}
            </text>
          );
        })}

        {/* ── Four Canonical Join Key Micro-Processors ── */}
        {JOIN_CHIPS.map((chip) => {
          const isRelatedToSelection =
            selectedSource.key === chip.id || selectedTarget.key === chip.id;

          return (
            <g key={chip.id} transform={`translate(${chip.x}, ${chip.y})`}>
              {/* Chip Body */}
              <rect
                x="-55"
                y="-25"
                width="110"
                height="50"
                rx="4"
                fill="#0b101c"
                stroke={isRelatedToSelection ? chip.color : 'rgba(200, 140, 60, 0.4)'}
                strokeWidth={isRelatedToSelection ? 2 : 1}
                filter={isRelatedToSelection ? 'url(#cyanGlow)' : undefined}
              />
              {/* Copper Pin Rails */}
              {[-35, -18, 0, 18, 35].map((px) => (
                <rect key={`pin-t-${px}`} x={px - 2} y="-29" width="4" height="5" fill="#c88848" />
              ))}
              {[-35, -18, 0, 18, 35].map((px) => (
                <rect key={`pin-b-${px}`} x={px - 2} y="24" width="4" height="5" fill="#c88848" />
              ))}
              {/* Chip Core Text */}
              <text
                x="0"
                y="-6"
                textAnchor="middle"
                className="text-[9px] font-bold tracking-wider"
                fill={chip.color}
              >
                {chip.name}
              </text>
              <text
                x="0"
                y="10"
                textAnchor="middle"
                className="text-[7.5px] tracking-tight"
                fill="#94a3b8"
                opacity="0.8"
              >
                {chip.keys}
              </text>
            </g>
          );
        })}

        {/* ── Traces from Join Chips to Center Planar Disc Rim ── */}
        {JOIN_CHIPS.map((chip) => (
          <line
            key={`bridge-${chip.id}`}
            x1={chip.x}
            y1={chip.y}
            x2={CX + (chip.x > CX ? DISC_R : -DISC_R)}
            y2={CY + (chip.y > CY ? DISC_R * 0.6 : -DISC_R * 0.6)}
            stroke="#c88848"
            strokeWidth="1.2"
            strokeOpacity="0.45"
            strokeDasharray="3 3"
          />
        ))}

        {/* ══════════════════════════════════════════════════════════════
            CENTER: SEALED PLANAR EARTH SYSTEM (AZIMUTHAL EQUIDISTANT)
            ══════════════════════════════════════════════════════════════ */}
        <g id="planar-sealed-earth-system">
          {/* Heavy Machined Bezel Rim */}
          <circle
            cx={CX}
            cy={CY}
            r={DISC_R + 12}
            fill="#0e1424"
            stroke="url(#bezelGrad)"
            strokeWidth="7"
          />

          {/* 360-Degree Radial Tick Marks */}
          {Array.from({ length: 72 }).map((_, i) => {
            const deg = i * 5;
            const rad = (deg * Math.PI) / 180;
            const isMajor = deg % 30 === 0;
            const len = isMajor ? 8 : 4;
            const r1 = DISC_R + 6;
            const r2 = r1 - len;
            return (
              <line
                key={`tick-${deg}`}
                x1={CX + r1 * Math.cos(rad)}
                y1={CY + r1 * Math.sin(rad)}
                x2={CX + r2 * Math.cos(rad)}
                y2={CY + r2 * Math.sin(rad)}
                stroke="#d49e58"
                strokeWidth={isMajor ? 1.2 : 0.6}
                strokeOpacity={isMajor ? 0.9 : 0.4}
              />
            );
          })}

          {/* Outer Antarctica Ice Perimeter Wall (Hermetic Barrier) */}
          <circle
            cx={CX}
            cy={CY}
            r={DISC_R}
            fill="#060c18"
            stroke="#e2f8ff"
            strokeWidth="3.5"
            filter="url(#cyanGlow)"
          />

          {/* Ocean Radial Gradient Surface */}
          <circle
            cx={CX}
            cy={CY}
            r={DISC_R - 2}
            fill="radial-gradient(circle, #0e1b2e 0%, #06111f 65%, #020710 100%)"
          />

          {/* Concentric Polar Latitude Coordinate Rings */}
          {[25, 55, 85, 115].map((r, idx) => (
            <circle
              key={`lat-ring-${idx}`}
              cx={CX}
              cy={CY}
              r={r}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="0.65"
              strokeOpacity="0.28"
              strokeDasharray={idx === 2 ? 'none' : '4 4'}
            />
          ))}

          {/* Radial Longitude Meridian Spokes */}
          {Array.from({ length: 12 }).map((_, i) => {
            const rad = (i * 30 * Math.PI) / 180;
            return (
              <line
                key={`meridian-${i}`}
                x1={CX}
                y1={CY}
                x2={CX + DISC_R * Math.cos(rad)}
                y2={CY + DISC_R * Math.sin(rad)}
                stroke="#38bdf8"
                strokeWidth="0.5"
                strokeOpacity="0.22"
              />
            );
          })}

          {/* Stylized Planar Landmass Contours (North Pole at Center) */}
          {/* North America / Arctic basin */}
          <path
            d={`M ${CX - 22} ${CY - 30} Q ${CX - 55} ${CY - 50} ${CX - 75} ${CY - 20} Q ${CX - 85} ${CY + 25} ${CX - 50} ${CY + 55} Q ${CX - 25} ${CY + 35} ${CX - 22} ${CY - 30}`}
            fill="#1e3a32"
            fillOpacity="0.45"
            stroke="#34d399"
            strokeWidth="1"
            strokeOpacity="0.6"
          />
          {/* Eurasia / Africa / Asia */}
          <path
            d={`M ${CX + 15} ${CY - 35} Q ${CX + 65} ${CY - 60} ${CX + 95} ${CY - 25} Q ${CX + 105} ${CY + 30} ${CX + 45} ${CY + 65} Q ${CX + 20} ${CY + 20} ${CX + 15} ${CY - 35}`}
            fill="#1e3a32"
            fillOpacity="0.45"
            stroke="#34d399"
            strokeWidth="1"
            strokeOpacity="0.6"
          />
          {/* Arctic Center Node */}
          <circle cx={CX} cy={CY} r="3" fill="#ffffff" filter="url(#cyanGlow)" />

          {/* Sovereign Physical Nodes Reticles plotted on the Planar Disc */}
          {SOVEREIGN_NODES.map((node) => {
            const pt = projectPlanar(node.lat, node.lon);
            const isTargeted =
              hoveredEndpoint?.tag === node.code || selectedSource?.tag === node.code;

            return (
              <g key={node.id} transform={`translate(${pt.x}, ${pt.y})`}>
                <circle
                  r={isTargeted ? '7' : '3.5'}
                  fill={isTargeted ? '#00f2fe' : '#fbbf24'}
                  filter="url(#cyanGlow)"
                  className="transition-all duration-300"
                />
                <circle
                  r={isTargeted ? '14' : '7'}
                  fill="none"
                  stroke={isTargeted ? '#00f2fe' : '#fbbf24'}
                  strokeWidth="0.8"
                  strokeOpacity={isTargeted ? '0.9' : '0.4'}
                  className={isTargeted ? 'animate-ping' : ''}
                />
                {/* Node Code Label */}
                <text
                  x="8"
                  y="3"
                  className="text-[7px] font-mono font-bold"
                  fill="#f8fafc"
                  opacity="0.85"
                >
                  {node.code}
                </text>
              </g>
            );
          })}

          {/* Rotating Holographic Firmament Geodesic Dome Overlay */}
          {isFirmamentActive && (
            <g
              transform={`rotate(${rotAngle}, ${CX}, ${CY})`}
              className="pointer-events-none opacity-40"
            >
              <ellipse
                cx={CX}
                cy={CY}
                rx={DISC_R - 8}
                ry={DISC_R * 0.55}
                fill="none"
                stroke="#00f2fe"
                strokeWidth="0.8"
                strokeDasharray="6 4"
              />
              <ellipse
                cx={CX}
                cy={CY}
                rx={DISC_R * 0.55}
                ry={DISC_R - 8}
                fill="none"
                stroke="#00f2fe"
                strokeWidth="0.8"
                strokeDasharray="6 4"
              />
            </g>
          )}

          {/* Hermetic Seal Indicator Stamp */}
          <rect
            x={CX - 85}
            y={CY + DISC_R + 18}
            width="170"
            height="18"
            rx="3"
            fill="#090e1a"
            stroke="#c88848"
            strokeWidth="1"
          />
          <text
            x={CX}
            y={CY + DISC_R + 30}
            textAnchor="middle"
            className="text-[8px] font-bold tracking-widest uppercase"
            fill="#c88848"
          >
            SEAL STATUS: HERMETIC // ENCLOSED
          </text>
        </g>

        {/* ── Outer Interactive Endpoint Pins ── */}
        <g id="outer-endpoint-pins">
          {allEndpoints.map((ep) => {
            const isHovered = hoveredEndpoint?.id === ep.id;
            const isSelected = selectedSource?.id === ep.id || selectedTarget?.id === ep.id;
            const col = SECTOR_COLORS[ep.sector].col;

            return (
              <g
                key={`node-${ep.id}`}
                transform={`translate(${ep.rx}, ${ep.ry})`}
                className="cursor-pointer pointer-events-auto"
                onMouseEnter={() => setHoveredEndpoint(ep)}
                onMouseLeave={() => setHoveredEndpoint(null)}
                onClick={() => {
                  if (selectedSource.id === ep.id) return;
                  setSelectedTarget(ep);
                }}
              >
                <circle
                  r={isSelected ? '6.5' : isHovered ? '5' : '3'}
                  fill={isSelected ? '#00f2fe' : isHovered ? '#ffaa44' : col}
                  stroke="#ffffff"
                  strokeWidth={isHovered || isSelected ? '1.5' : '0.5'}
                  filter={isSelected || isHovered ? 'url(#cyanGlow)' : undefined}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Top Floating Header & Operational Telemetry ── */}
      <div className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center space-x-3 pointer-events-auto">
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-sans font-bold tracking-wider text-white">
                PLANAR DISCOVERY MOTHERBOARD · AE-SYSTEM
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                HERMETIC 406
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Cross-agency macroeconomic join matrix grounded into central planar Earth disc.
            </p>
          </div>
        </div>

        {/* Header Controls */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          <button
            onClick={() => setIsFirmamentActive(!isFirmamentActive)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors flex items-center space-x-1 ${
              isFirmamentActive
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-white/5 text-slate-400 border-white/10'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Firmament Dome: {isFirmamentActive ? 'ON' : 'OFF'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* ── Hover Tooltip Banner (Bottom Left) ── */}
      <div className="absolute bottom-6 left-6 z-20 max-w-sm p-3 rounded-lg bg-black/80 border border-amber-500/30 backdrop-blur-md pointer-events-none">
        <div className="text-[10px] text-amber-400 uppercase tracking-widest font-bold">
          {hoveredEndpoint ? `${hoveredEndpoint.sector} · ${hoveredEndpoint.tag}` : 'INSPECTING CANONICAL JOIN'}
        </div>
        <div className="text-xs font-sans text-slate-100 font-semibold truncate mt-0.5">
          {hoveredEndpoint ? hoveredEndpoint.name : selectedSource.name}
        </div>
        <div className="text-[10px] text-slate-400 mt-1 flex items-center space-x-2">
          <span>Routing Key: <span className="text-cyan-300 font-mono font-bold">{hoveredEndpoint ? hoveredEndpoint.key : selectedSource.key}</span></span>
          <span>•</span>
          <span>Click to target</span>
        </div>
      </div>

      {/* ── Right-Side Floating Glassmorphism Inspector HUD ── */}
      <div className="absolute top-20 right-6 bottom-6 w-96 z-20 flex flex-col rounded-xl bg-[#090d19]/90 border border-slate-700/60 backdrop-blur-xl p-4 shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-optic-cyan" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Cross-Agency Join Inspector
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            {activeHypothesis.confidence}% Sure
          </span>
        </div>

        {/* Selected Pair Overview */}
        <div className="mt-3 space-y-2">
          <div className="p-2.5 rounded bg-white/5 border border-white/5">
            <div className="text-[9px] text-slate-500 uppercase">Source Endpoint (A)</div>
            <div className="text-xs font-medium text-slate-200 truncate">{selectedSource.name}</div>
            <div className="text-[10px] text-amber-400/80 mt-0.5 font-mono">{selectedSource.sector} · {selectedSource.key}</div>
          </div>

          <div className="flex justify-center -my-1 text-optic-cyan">
            <ArrowRight className="w-3.5 h-3.5 rotate-90" />
          </div>

          <div className="p-2.5 rounded bg-white/5 border border-white/5">
            <div className="text-[9px] text-slate-500 uppercase">Target Endpoint (B)</div>
            <div className="text-xs font-medium text-slate-200 truncate">{selectedTarget.name}</div>
            <div className="text-[10px] text-amber-400/80 mt-0.5 font-mono">{selectedTarget.sector} · {selectedTarget.key}</div>
          </div>
        </div>

        {/* Macroeconomic & Spatial Correlation Telemetry */}
        <div className="mt-4 p-3 rounded bg-black/40 border border-white/5">
          <div className="flex justify-between items-center text-[10px] mb-2 font-mono">
            <span className="text-slate-400 uppercase">Lead-Lag Dynamics</span>
            <span className="text-emerald-400 font-bold">{activeHypothesis.leadDays} Days Lead</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
            <div className="p-1.5 rounded bg-white/5">
              <span className="text-[9px] text-slate-500 block">Pearson r</span>
              <span className="font-bold text-optic-cyan">{activeHypothesis.correlationR}</span>
            </div>
            <div className="p-1.5 rounded bg-white/5">
              <span className="text-[9px] text-slate-500 block">p-Value</span>
              <span className="font-bold text-emerald-400">p &lt; {activeHypothesis.pValue}</span>
            </div>
          </div>
        </div>

        {/* BigQuery GoogleSQL GQL Snippet */}
        <div className="mt-3 flex-1 flex flex-col">
          <div className="text-[10px] text-slate-400 uppercase font-mono mb-1 flex items-center justify-between">
            <span>Generated ISO GQL</span>
            <span className="text-[9px] text-optic-cyan">BigQuery Graph</span>
          </div>
          <pre className="p-2.5 rounded bg-black/60 border border-white/5 text-[9.5px] font-mono text-cyan-200/90 overflow-x-auto whitespace-pre leading-relaxed flex-1">
            {activeHypothesis.ddl}
          </pre>
        </div>

        {/* Primary Action Button: Dispatch to Jules */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <button
            onClick={() => {
              if (onDispatchTask) {
                onDispatchTask({
                  id: `TSK-DISC-${Date.now().toString().slice(-4)}`,
                  title: `Cross-Agency Join: ${selectedSource.name} vs ${selectedTarget.name}`,
                  projectId: 'proj-discovery',
                  column: 'BACKLOG',
                  assignee: 'Jules + Jev',
                  progress: 0,
                  tokensUsed: 0,
                  actualTimeMinutes: 0,
                  avgThroughputTps: 0,
                  subtasks: [
                    `Ingest ${selectedSource.name} data stream`,
                    `Align along ${activeHypothesis.joinKey} canonical crosswalk`,
                    `Assert statistical significance threshold (p <= 0.01)`
                  ],
                  checkpointActive: true,
                  description: `Autonomous data correlation pipeline verifying lead-lag relationships across ${activeHypothesis.joinKey}.`,
                  repo: 'Metatronsdoob369/jules-jev-harness'
                });
                if (onClose) onClose();
              }
            }}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-optic-cyan to-emerald-400 hover:from-optic-cyan/90 hover:to-emerald-400/90 text-slate-950 font-sans font-bold text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center space-x-2"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Dispatch Join to Jules + Jev</span>
          </button>
        </div>
      </div>
    </div>
  );
}
