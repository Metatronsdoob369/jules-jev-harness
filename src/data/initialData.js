// Real production harness projects and telemetry profiles
export const INITIAL_PROJECTS = [
  {
    id: 'proj-discovery',
    name: 'Discovery Lab (Cross-Agency GQL)',
    color: '#00E5FF',
    patronage: 'Open Data Intelligence',
    repo: 'Metatronsdoob369/jules-jev-harness'
  },
  {
    id: 'proj-jules',
    name: 'Jules Autonomous Agent',
    color: '#00FF88',
    patronage: 'Google DeepMind / Jules',
    repo: 'Metatronsdoob369/jules-jev-harness'
  },
  {
    id: 'proj-jev',
    name: 'Jev-Gates Decision Mesh',
    color: '#FFB020',
    patronage: 'Deterministic Governance',
    repo: 'Metatronsdoob369/jules-jev-harness'
  },
  {
    id: 'proj-spectral',
    name: '5-D Spectral Resonance Engine',
    color: '#A855F7',
    patronage: 'Structural Code Integrity',
    repo: 'Metatronsdoob369/jules-jev-harness'
  }
];

export const INITIAL_LM_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', provider: 'Google AI', tier: 'Primary Default', status: 'ACTIVE', latency: '120ms', costPer1k: '$0.00015' },
  { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', tier: 'Deep Reasoning', status: 'READY', latency: '240ms', costPer1k: '$0.00300' },
  { id: 'gpt-4o', name: 'GPT-4o Omnimodal', provider: 'OpenAI', tier: 'High Throughput', status: 'READY', latency: '180ms', costPer1k: '$0.00250' },
  { id: 'deepseek-r1', name: 'DeepSeek R1 Distill', provider: 'DeepSeek', tier: 'Logic & Verification', status: 'READY', latency: '310ms', costPer1k: '$0.00055' },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B Instruct', provider: 'Meta AI / Local', tier: 'Air-Gapped Local', status: 'STANDBY', latency: '95ms', costPer1k: '$0.00000' }
];

export const INITIAL_TASKS = [
  // BACKLOG COLUMN
  {
    id: 'TSK-JULES-01',
    title: 'Automated GitHub PR Branching on Gate Confirmation',
    projectId: 'proj-jules',
    column: 'BACKLOG',
    assignee: 'Jules',
    progress: 0,
    tokensUsed: 12400,
    actualTimeMinutes: 0,
    avgThroughputTps: 92.4,
    subtasks: [
      'Authenticate with GitHub App installation',
      'Create ephemeral worktree branch from main',
      'Commit signed code diffs and open draft pull request'
    ],
    checkpointActive: true,
    description: 'Autonomous Git workflow executing remote pull request branching once Jev verification gates clear.',
    repo: 'Metatronsdoob369/jules-jev-harness'
  },
  {
    id: 'TSK-DISC-03',
    title: 'Cross-Agency Graph Discovery: USDA Crops vs BLS Food CPI',
    projectId: 'proj-discovery',
    column: 'BACKLOG',
    assignee: 'Jev.ai + Jules',
    progress: 10,
    tokensUsed: 18200,
    actualTimeMinutes: 5,
    avgThroughputTps: 108.0,
    subtasks: [
      'Ingest USDA QuickStats monthly corn/soy yields',
      'Join on TEMPORAL_MONTH with BLS Consumer Price Index',
      'Calculate 90-day lead-lag correlation matrix'
    ],
    checkpointActive: false,
    description: 'Autonomous crosswalk join linking agricultural supply shifts to downstream urban retail food inflation.',
    repo: 'Metatronsdoob369/jules-jev-harness'
  },

  // IN PROGRESS COLUMN
  {
    id: 'TSK-DISC-02',
    title: 'Time-Series Join Bridge: Treasury Debt vs FRED 10Y Yields',
    projectId: 'proj-discovery',
    column: 'IN_PROGRESS',
    assignee: 'Jules + Jev',
    progress: 65,
    tokensUsed: 42100,
    actualTimeMinutes: 24,
    avgThroughputTps: 135.5,
    subtasks: [
      'Stream daily Treasury Fiscal Data public debt issuance',
      'Align on TEMPORAL_DATE with FRED DGS10 benchmark series',
      'Assert statistical significance threshold (p <= 0.01)'
    ],
    checkpointActive: true,
    description: 'Empirical cross-agency macro correlation pipeline testing lead-indicator shifts between sovereign issuance and market yields.',
    repo: 'Metatronsdoob369/jules-jev-harness'
  },
  {
    id: 'TSK-JEV-01',
    title: '5-Gate Deterministic Verification Mesh & Live Streamer',
    projectId: 'proj-jev',
    column: 'IN_PROGRESS',
    assignee: 'Jev.ai',
    progress: 82,
    tokensUsed: 68400,
    actualTimeMinutes: 38,
    avgThroughputTps: 148.2,
    subtasks: [
      'Intake clarity & anti-ambiguity gate',
      'Window state & pre-execution confirmation trap',
      'Zero-hallucination deterministic rule evaluation'
    ],
    checkpointActive: false,
    description: 'Multi-tiered safety harness evaluating code proposals against strict non-vacuity and confidence policies.',
    repo: 'Metatronsdoob369/jules-jev-harness'
  },

  // REVIEW COLUMN
  {
    id: 'TSK-SPEC-01',
    title: '5-D Spectral Resonance Pre-Flight on Risky Diff Gate',
    projectId: 'proj-spectral',
    column: 'REVIEW',
    assignee: 'Jev.ai',
    progress: 92,
    tokensUsed: 54100,
    actualTimeMinutes: 31,
    avgThroughputTps: 162.0,
    subtasks: [
      'Compute 5-D unit fingerprint (size, complexity, structure, density, coupling)',
      'Calculate shatter displacement against baseline anchor',
      'Block high-fracture diffs (shatter > 0.15) before human review'
    ],
    checkpointActive: true,
    description: 'Sub-millisecond structural diff radar safeguarding pull request boundaries from catastrophic code drift.',
    spectral: {
      vector: [0.8241, 0.0612, 0.4012, 0.3128, 0.2541],
      dimensions: {
        size: 0.8241,
        complexityHash: 0.0612,
        structureLines: 0.4012,
        defDensity: 0.3128,
        couplingImports: 0.2541,
      },
      heat: 0.3707,
      shatter: 0.0184,
      coldDistance: 0.1742,
      recommendation: 'ANCHOR',
      failureProximity: false,
      verdict: 'pass',
      receipt: 'Canonical anchor: Δshatter 0.0184 within safe harbor (<0.05)',
      computeTimeMs: 0.384,
    },
    repo: 'Metatronsdoob369/jules-jev-harness'
  },

  // DONE COLUMN
  {
    id: 'TSK-DISC-01',
    title: 'API-All-the-X Catalog & BigQuery ISO GQL DDL Export',
    projectId: 'proj-discovery',
    column: 'DONE',
    assignee: 'Jules + Jev',
    progress: 100,
    tokensUsed: 88500,
    actualTimeMinutes: 42,
    avgThroughputTps: 154.0,
    subtasks: [
      'Index 14 canonical join keys (SPATIAL, CORPORATE, TEMPORAL)',
      'Parse 9 cross-agency federal & financial registries',
      'Generate compliant CREATE OR REPLACE PROPERTY GRAPH DDL'
    ],
    checkpointActive: false,
    description: 'Completed baseline discovery engine cataloging disparate public data endpoints and join topology.',
    repo: 'Metatronsdoob369/jules-jev-harness'
  }
];

export const INITIAL_CHECKPOINTS = [
  { id: 'chk-1', stage: 'Planning & Intent Analysis', enabled: true, trigger: 'Prior to task breakdown', description: 'Requires Jev.ai to present DAG decomposition before code generation starts.' },
  { id: 'chk-2', stage: 'Architecture Design & Join Path', enabled: true, trigger: 'After join path synthesis', description: 'Pauses pipeline to verify crosswalk bridges between disparate agency endpoints.' },
  { id: 'chk-3', stage: '5-D Spectral Pre-Flight Scan', enabled: true, trigger: 'Post code synthesis', description: 'Scores diff shatter and cold-map failure proximity before human review.' },
  { id: 'chk-4', stage: 'Production Merge & PR Dispatch', enabled: true, trigger: 'Pre-flight merge', description: 'Verifies verified acceptance sub-items and test suite assertions before merge.' }
];
