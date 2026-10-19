// repo: the GitHub repo each project's work lands in. The route gate holds any task
// without one (no repo, no dispatch). Replace the placeholder with your real repo.
export const INITIAL_PROJECTS = [
  { id: 'proj-01', name: 'AeroSwarm Kernel', color: '#00E5FF', patronage: 'USAF Cyber Command', repo: 'your-org/harness' },
  { id: 'proj-02', name: 'Jev.ai Orchestrator', color: '#00FF88', patronage: 'Autonomous Intelligence Inc.', repo: 'your-org/harness' },
  { id: 'proj-03', name: 'Quantum CAD Bridge', color: '#FFB020', patronage: 'Lockheed Tech Labs', repo: 'your-org/harness' },
  { id: 'proj-04', name: 'Neural Memory Engine', color: '#A855F7', patronage: 'Deep Mind Robotics', repo: 'your-org/harness' },
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
    id: 'TSK-101',
    title: 'Multi-Agent Sub-Task Topology Decomposition',
    projectId: 'proj-02',
    column: 'BACKLOG',
    assignee: 'Jev.ai',
    progress: 0,
    tokensUsed: 14200,
    actualTimeMinutes: 0,
    avgThroughputTps: 84.2,
    subtasks: ['Parse user intent', 'Decompose DAG dependencies', 'Assign worker roles'],
    checkpointActive: false,
    description: 'Decompose parent requirement into deterministic worker threads managed via Jev sub-agent traffic controller.'
  },
  {
    id: 'TSK-102',
    title: 'WebGL Shader Optimization for 10k Render Nodes',
    projectId: 'proj-01',
    column: 'BACKLOG',
    assignee: 'Jules',
    progress: 15,
    tokensUsed: 28400,
    actualTimeMinutes: 12,
    avgThroughputTps: 112.5,
    subtasks: ['Instanced Mesh matrix buffers', 'Custom GLSL fragment noise', 'Frustum culling optimization'],
    checkpointActive: true,
    description: 'Accelerate Kanban 3D card rendering using InstancedMesh matrix packing to ensure 60fps on desktop.'
  },
  
  // IN PROGRESS COLUMN
  {
    id: 'TSK-201',
    title: 'Jev.ai Sub-Agent Traffic Router & Skill Circuit Wire',
    projectId: 'proj-02',
    column: 'IN_PROGRESS',
    assignee: 'Jev.ai + Jules',
    progress: 68,
    tokensUsed: 89400,
    actualTimeMinutes: 45,
    avgThroughputTps: 142.8,
    subtasks: ['Hook event emitter', 'Register memory buffers', 'Inject context instructions'],
    checkpointActive: false,
    description: 'Wire Jev.ai as the all-star do-it-all teammates for task breakdown, traffic control, and execution alignment.'
  },
  {
    id: 'TSK-202',
    title: 'LM Pre-Plan Interruption Checkpoint Interceptor',
    projectId: 'proj-03',
    column: 'IN_PROGRESS',
    assignee: 'Jules',
    progress: 42,
    tokensUsed: 53100,
    actualTimeMinutes: 28,
    avgThroughputTps: 98.4,
    subtasks: ['Build pre-plan pause trap', 'Hook user secret keys', 'Allow mid-flight model swapping'],
    checkpointActive: true,
    description: 'Predefined pause breaks at each project phase where user selected LMs can step in to critique or approve.'
  },

  // REVIEW COLUMN
  {
    id: 'TSK-301',
    title: 'High-Density Spec Panel & Micro-Telemetry Readouts',
    projectId: 'proj-04',
    column: 'REVIEW',
    assignee: 'Jev.ai',
    progress: 90,
    tokensUsed: 112900,
    actualTimeMinutes: 62,
    avgThroughputTps: 165.2,
    subtasks: ['Render token decay graph', 'Expose actual time vs estimate', 'Calculate average throughput TPS'],
    checkpointActive: true,
    description: 'Hover and click drawer specs that display precise numbers, token stats, and execution health metrics.',
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
  },

  // DONE COLUMN
  {
    id: 'TSK-401',
    title: 'Stealth Black Industrial Canvas & Grid Initialization',
    projectId: 'proj-01',
    column: 'DONE',
    assignee: 'Jules',
    progress: 100,
    tokensUsed: 44200,
    actualTimeMinutes: 30,
    avgThroughputTps: 130.0,
    subtasks: ['Configure Space Grotesk & JetBrains Mono', 'Setup cyan/emerald HUD glow', 'Establish 3D coordinate plane'],
    checkpointActive: false,
    description: 'Established the low-illumination aerospace mission deck base canvas with grid matrix lines.'
  }
];

export const INITIAL_CHECKPOINTS = [
  { id: 'chk-1', stage: 'Planning & Intent Analysis', enabled: true, trigger: 'Prior to task breakdown', description: 'Requires Jev.ai to present DAG decomposition before code generation starts.' },
  { id: 'chk-2', stage: 'Architecture Design & Sketch', enabled: true, trigger: 'After visual sketch generation', description: 'Pauses pipeline to allow external LM critique of 2D/3D system architecture diagrams.' },
  { id: 'chk-3', stage: 'Code Synthesis & Verification', enabled: false, trigger: 'Post unit test pass', description: 'Pauses before git commit to allow secondary model code auditing.' },
  { id: 'chk-4', stage: 'Deployment & Render Build', enabled: true, trigger: 'Pre-flight deployment', description: 'Verifies environment variables and security tokens before cloud deploy.' }
];
