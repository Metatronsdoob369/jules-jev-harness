import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Play, Pause, Zap, GitBranch, ShieldCheck, Check, X } from 'lucide-react';
import { executeGate, gateStatus } from '../gates/gates.js';

const MODE_LABEL = { live: 'JEV LIVE', 'stand-in': 'JEV STAND-IN', offline: 'GATES OFFLINE' };
const MODE_STYLE = {
  live: 'text-wal-emerald border-wal-emerald/40 bg-wal-emerald/10',
  'stand-in': 'text-drift-amber border-drift-amber/40 bg-drift-amber/10',
  offline: 'text-red-400 border-red-400/40 bg-red-400/10',
};

export default function OrchestrationHub({
  tasks,
  projects,
  selectedTask,
  activeModel,
  onUpdateTaskProgress,
  onMoveTask,
  onAddTask,
  onPatchTask,
  isExecuting,
  setIsExecuting
}) {
  const [mode, setMode] = useState(null);
  const [logs, setLogs] = useState([]);
  const [lastGateVerdict, setLastGateVerdict] = useState(null);
  const [approval, setApproval] = useState(null); // { tile, verdict, question }
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDoneWhen, setNewTaskDoneWhen] = useState('');
  const busy = useRef(false);

  // ── Talking to the gates ───────────────────────────────────────────────────

  function context(tile, extra = {}) {
    const project = projects.find((p) => p.id === tile.projectId);
    return {
      tile: { id: tile.id, title: tile.title, description: tile.description, subtasks: tile.subtasks },
      project: project && { name: project.name, repo: project.repo },
      projects: projects.map((p) => ({ name: p.name })),
      ...extra
    };
  }

  async function gate(name, tile, extra) {
    const v = await executeGate(name, context(tile, extra));
    if (v.mode) setMode(v.mode);
    setLastGateVerdict(v);
    onPatchTask(tile.id, { lastGateVerdict: v });
    log(v.verdict, `${name} · ${tile.id}: ${v.action} (${v.reason}) [${describe(v)}]`);
    return v;
  }

  function describe(v) {
    if (v.source !== 'jev') return `${v.source}, ${v.ms}ms`;
    return `${Math.round(v.sureness * 100)}% sure, ${v.ms}ms${v.mode === 'stand-in' ? ', stand-in' : ''}`;
  }

  function log(verdict, message) {
    const entry = { id: `${Date.now()}-${Math.random()}`, timestamp: new Date().toLocaleTimeString(), verdict, message };
    setLogs((prev) => [entry, ...prev].slice(0, 30));
  }

  // A verdict that isn't "act" waits for you.
  function hold(tile, v) {
    onPatchTask(tile.id, { needsYou: v.reason });
  }

  function ask(tile, v, question) {
    onPatchTask(tile.id, { needsYou: question });
    setApproval({ tile, verdict: v, question });
    setIsExecuting(false);
  }

  const announced = useRef(false);
  useEffect(() => {
    gateStatus().then((status) => {
      setMode(status.mode);
      if (announced.current) return; // React dev mode runs effects twice
      announced.current = true;
      log(
        'note',
        status.mode === 'offline'
          ? 'Gate server not reachable: every gate hands its decision to you.'
          : `Gates ready (${MODE_LABEL[status.mode]}).`
      );
    });
  }, []);

  // ── The loop: simulated agents do the work, the gates judge every moment ──

  useEffect(() => {
    if (!isExecuting || approval) return;

    const interval = setInterval(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const working = tasks.filter((t) => t.column === 'IN_PROGRESS' && !t.needsYou);
        if (working.length > 0) {
          await advance(working[Math.floor(Math.random() * working.length)]);
          return;
        }
        const next = tasks.find((t) => t.column === 'BACKLOG' && !t.needsYou);
        if (next) await dispatch(next);
      } finally {
        busy.current = false;
      }
    }, 2800);

    return () => clearInterval(interval);
  }, [isExecuting, approval, tasks, projects]);

  // BACKLOG → IN_PROGRESS goes through the route gate.
  async function dispatch(tile) {
    const v = await gate('route', tile);
    const takes = v.action === 'jules' || v.action === 'writer';
    if (takes && v.verdict === 'act') return start(tile, v.action);
    if (takes && v.verdict === 'confirm') return ask(tile, v, `Send ${tile.id} to ${v.action}?`);
    hold(tile, v); // a person, a split, or no repo: it waits for you in the backlog
  }

  function start(tile, owner) {
    onPatchTask(tile.id, { assignee: owner === 'jules' ? 'Jules' : 'Writer model' });
    onMoveTask(tile.id, 'IN_PROGRESS');
  }

  async function advance(tile) {
    const steps = Math.max(1, tile.subtasks?.length ?? 1);
    const from = tile.progress ?? 0;
    const to = Math.min(100, from + 10 + Math.floor(Math.random() * 20));
    const finished = (p) => Math.floor((p / 100) * steps);
    onUpdateTaskProgress(tile.id, to);

    // Finishing a plan step opens a window, if this tile has checkpoints.
    if (tile.checkpointActive && to < 100 && finished(to) > finished(from)) {
      const step = tile.subtasks[finished(to) - 1];
      const v = await gate('window', tile, { atWindow: true, lastStep: `Finished: ${step}` });
      if (v.action === 'open' && v.verdict !== 'escalate') {
        return ask(tile, v, `Bring in a ${v.details?.role ?? 'reviewer'} on ${tile.id} now?`);
      }
      if (v.verdict === 'escalate') hold(tile, v);
      return;
    }

    if (to >= 100) {
      const report = {
        summary: `Completed: ${(tile.subtasks ?? []).join('; ')}.`,
        prUrl: `sim://${tile.id}`, // simulated agents open simulated PRs
        testsPassed: true
      };
      const v = await gate('done', tile, { report });
      if (v.action === 'done' && v.verdict === 'act') return onMoveTask(tile.id, 'REVIEW');
      if (v.action === 'done' && v.verdict === 'confirm') return ask(tile, v, `Mark ${tile.id} done?`);
      if (v.action === 'send_back' && v.verdict === 'act') return sendBack(tile);
      hold(tile, v);
    }
  }

  function sendBack(tile) {
    const steps = Math.max(1, tile.subtasks?.length ?? 1);
    onUpdateTaskProgress(tile.id, Math.round((100 * (steps - 1)) / steps));
  }

  // Your yes or no on a "confirm" verdict.
  function answer(yes) {
    const { tile, verdict } = approval;
    onPatchTask(tile.id, { needsYou: null });
    if (verdict.gate === 'route') {
      if (yes) start(tile, verdict.action);
      else onPatchTask(tile.id, { needsYou: 'Routing declined: assign it by hand' });
    }
    if (verdict.gate === 'window') {
      const role = verdict.details?.role ?? 'reviewer';
      log('note', yes
        ? `Window on ${tile.id}: a ${role} joins (pick the model in LM settings).`
        : `Window on ${tile.id}: kept going without another model.`);
    }
    if (verdict.gate === 'done') {
      if (yes) onMoveTask(tile.id, 'REVIEW');
      else sendBack(tile);
    }
    setApproval(null);
    setIsExecuting(true);
  }

  // New tasks go through the intake gate, which also picks their project.
  const handleCreateQuickTask = async (e) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    const doneWhen = newTaskDoneWhen.trim();
    const tile = {
      id: `TSK-${Math.floor(100 + Math.random() * 900)}`,
      title,
      projectId: projects[0]?.id,
      column: 'BACKLOG',
      assignee: 'Unassigned',
      progress: 0,
      tokensUsed: 0,
      actualTimeMinutes: 0,
      avgThroughputTps: 0,
      subtasks: doneWhen ? [doneWhen] : [title],
      checkpointActive: true,
      description: doneWhen ? `${title}. Done when: ${doneWhen}` : title
    };
    setNewTaskTitle('');
    setNewTaskDoneWhen('');

    const v = await executeGate('intake', context(tile));
    if (v.mode) setMode(v.mode);
    setLastGateVerdict(v);
    const picked = projects.find((p) => p.name === v.details?.project);
    let needsYou = null;
    if (v.action === 'clarify') needsYou = 'Say what done looks like';
    else if (v.verdict === 'escalate') needsYou = v.reason;
    else if (!picked && v.source === 'jev') needsYou = 'Pick a project for this task';
    onAddTask({ ...tile, projectId: picked?.id ?? tile.projectId, lastGateVerdict: v, needsYou });
    log(v.verdict, `intake · ${tile.id}: ${v.action} (${v.reason}) [${describe(v)}]`);
  };

  return (
    <div className="bg-canvas-deck border border-canvas-bezel rounded-lg p-3 text-xs font-mono space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-canvas-bezel pb-2">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Cpu className="w-4 h-4 text-optic-cyan" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-wal-emerald rounded-full animate-ping"></span>
          </div>
          <span className="font-bold text-slate-100 tracking-wider">
            JEV-GATES DECISION ENGINE & TRAFFIC HARNESS
          </span>
          {mode && (
            <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${MODE_STYLE[mode]}`}>
              {MODE_LABEL[mode]}
            </span>
          )}
        </div>

        <button
          onClick={() => setIsExecuting(!isExecuting)}
          disabled={Boolean(approval)}
          className={`px-3 py-1 rounded flex items-center space-x-1.5 font-bold transition-all disabled:opacity-40 ${
            isExecuting
              ? 'bg-drift-amber/20 text-drift-amber border border-drift-amber/40 hover:bg-drift-amber/30'
              : 'bg-wal-emerald/20 text-wal-emerald border border-wal-emerald/40 hover:bg-wal-emerald/30'
          }`}
        >
          {isExecuting ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          <span>{isExecuting ? 'PAUSE GATES' : 'RUN HARNESS'}</span>
        </button>
      </div>

      {/* Your call: a "confirm" verdict waits here for a yes or no */}
      {approval && (
        <div className="p-2 rounded bg-optic-cyan/10 border border-optic-cyan/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-optic-cyan" />
            <span className="font-bold text-slate-100">YOUR CALL:</span>
            <span className="text-slate-200">{approval.question}</span>
            <span className="text-slate-400 text-[10px]">({approval.verdict.reason})</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => answer(true)}
              className="px-2.5 py-1 rounded bg-wal-emerald/20 text-wal-emerald border border-wal-emerald/40 font-bold flex items-center space-x-1 hover:bg-wal-emerald/30"
            >
              <Check className="w-3 h-3" />
              <span>YES</span>
            </button>
            <button
              onClick={() => answer(false)}
              className="px-2.5 py-1 rounded bg-drift-amber/20 text-drift-amber border border-drift-amber/40 font-bold flex items-center space-x-1 hover:bg-drift-amber/30"
            >
              <X className="w-3 h-3" />
              <span>NO</span>
            </button>
          </div>
        </div>
      )}

      {/* Latest Decision Gate Telemetry Bar */}
      <div className="p-2 rounded bg-canvas-base border border-optic-cyan/30 flex items-center justify-between">
        {lastGateVerdict ? (
          <>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-optic-cyan" />
              <span className="font-bold text-slate-200 uppercase">{lastGateVerdict.gate} GATE:</span>
              <span className="text-wal-emerald font-bold">{lastGateVerdict.action}</span>
              <span className="text-slate-400 text-[10px]">({lastGateVerdict.reason})</span>
            </div>

            <div className="flex items-center space-x-3 text-[11px]">
              <span>SURENESS: <strong className="text-optic-cyan">{lastGateVerdict.sureness}</strong></span>
              <span>VERDICT: <strong className={lastGateVerdict.verdict === 'act' ? 'text-wal-emerald' : 'text-drift-amber'}>{lastGateVerdict.verdict.toUpperCase()}</strong></span>
              <span className="text-slate-500">
                {lastGateVerdict.source === 'jev' && lastGateVerdict.mode === 'stand-in' ? 'stand-in' : lastGateVerdict.source} · {lastGateVerdict.ms}ms
              </span>
            </div>
          </>
        ) : (
          <span className="text-slate-500">No gate has run yet. Press RUN HARNESS or add a task.</span>
        )}
      </div>

      {/* Roles & Gates Matrix */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded bg-canvas-bezel/60 border border-optic-bright/20 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400">PRIMARY CODE ENGINEER</div>
            <div className="text-optic-cyan font-bold flex items-center space-x-1">
              <span>JULES</span>
              <span className="text-[9px] px-1 bg-optic-cyan/20 rounded">SIMULATED RUNS</span>
            </div>
          </div>
          <Zap className="w-4 h-4 text-optic-cyan" />
        </div>

        <div className="p-2 rounded bg-canvas-bezel/60 border border-wal-emerald/20 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400">JEV DECISION ENGINE</div>
            <div className="text-wal-emerald font-bold flex items-center space-x-1">
              <span>JEV-GATES</span>
              <span className="text-[9px] px-1 bg-wal-emerald/20 rounded">TYPED CALLS</span>
            </div>
          </div>
          <GitBranch className="w-4 h-4 text-wal-emerald" />
        </div>
      </div>

      {/* Inject Task Form */}
      <form onSubmit={handleCreateQuickTask} className="flex items-center space-x-2">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="New task..."
          className="flex-1 bg-canvas-base border border-canvas-bezel focus:border-optic-cyan rounded px-2.5 py-1.5 text-slate-200 outline-none text-xs"
        />
        <input
          type="text"
          value={newTaskDoneWhen}
          onChange={(e) => setNewTaskDoneWhen(e.target.value)}
          placeholder="Done when..."
          className="flex-1 bg-canvas-base border border-canvas-bezel focus:border-optic-cyan rounded px-2.5 py-1.5 text-slate-200 outline-none text-xs"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-optic-cyan text-canvas-deep font-bold rounded hover:bg-optic-bright transition-colors"
        >
          EVALUATE GATE
        </button>
      </form>

      {/* Decision Gate Logs */}
      <div className="bg-canvas-base rounded p-2 border border-canvas-bezel h-28 overflow-y-auto space-y-1 text-[11px]">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start space-x-2 text-slate-300">
            <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
            <span
              className={`font-bold shrink-0 ${
                log.verdict === 'act'
                  ? 'text-wal-emerald'
                  : log.verdict === 'confirm'
                  ? 'text-optic-cyan'
                  : log.verdict === 'note'
                  ? 'text-slate-500'
                  : 'text-drift-amber'
              }`}
            >
              [{log.verdict?.toUpperCase() || 'ACT'}]:
            </span>
            <span className="truncate">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
