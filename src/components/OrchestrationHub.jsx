import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Play, Pause, Zap, GitBranch, ShieldCheck, Check, X, ExternalLink } from 'lucide-react';
import { executeGate, gateStatus } from '../gates/gates.js';
import { computeLiveStep } from '../jules/live-step.js';

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
  const [julesMode, setJulesMode] = useState('simulated');
  const [logs, setLogs] = useState([]);
  const [lastGateVerdict, setLastGateVerdict] = useState(null);
  const [approval, setApproval] = useState(null); // { tile, verdict, question, actionType, extra }
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDoneWhen, setNewTaskDoneWhen] = useState('');
  const busy = useRef(false);
  const pollBusy = useRef(false);
  const tasksRef = useRef(tasks);
  const consecutiveErrorsRef = useRef({});

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // ── Talking to the gates ───────────────────────────────────────────────────

  function context(tile, extra = {}) {
    const project = projects.find((p) => p.id === tile.projectId);
    return {
      tile: { id: tile.id, title: tile.title, description: tile.description, subtasks: tile.subtasks },
      project: project && { name: project.name, repo: project.repo, branch: project.branch },
      projects: projects.map((p) => ({ name: p.name })),
      ...extra
    };
  }

  async function gate(name, tile, extra) {
    const v = await executeGate(name, context(tile, extra));
    if (v.mode) setMode(v.mode);
    setLastGateVerdict(v);
    onPatchTask(tile.id, {
      lastGateVerdict: v,
      ...(v.details?.spectral ? { spectral: v.details.spectral } : {}),
    });
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

  function hold(tile, v) {
    onPatchTask(tile.id, { needsYou: v.reason });
  }

  function ask(tile, verdict, question, extra = {}) {
    onPatchTask(tile.id, { needsYou: question });
    setApproval({ tile, verdict, question, ...extra });
    setIsExecuting(false);
  }

  const announced = useRef(false);
  useEffect(() => {
    gateStatus().then((status) => {
      setMode(status.mode);
      if (announced.current) return;
      announced.current = true;
      log(
        'note',
        status.mode === 'offline'
          ? 'Gate server not reachable: every gate hands its decision to you.'
          : `Gates ready (${MODE_LABEL[status.mode]}).`
      );
    });

    // Check Jules mode
    fetch('/api/jules')
      .then((res) => (res.ok ? res.json() : { mode: 'simulated' }))
      .then((data) => {
        setJulesMode(data.mode || 'simulated');
        if (data.mode === 'live') {
          log('note', `Jules ready (LIVE · ${data.repos?.length ?? 0} connected repos).`);
        }
      })
      .catch(() => setJulesMode('simulated'));
  }, []);

  // ── Dispatch Loop (BACKLOG -> IN_PROGRESS via route gate) ───────────────────

  useEffect(() => {
    if (!isExecuting || approval) return;

    const interval = setInterval(async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        // Run simulated tiles only when simulated
        const workingSimulated = tasksRef.current.filter(
          (t) => t.column === 'IN_PROGRESS' && !t.needsYou && t.assignee !== 'Jules'
        );
        if (workingSimulated.length > 0) {
          await advanceSimulated(workingSimulated[Math.floor(Math.random() * workingSimulated.length)]);
          return;
        }

        const next = tasksRef.current.find((t) => t.column === 'BACKLOG' && !t.needsYou);
        if (next) await dispatch(next);
      } finally {
        busy.current = false;
      }
    }, 2800);

    return () => clearInterval(interval);
  }, [isExecuting, approval, projects]);

  // ── Live Jules Polling Loop (10-second timer, debounced) ────────────────────

  useEffect(() => {
    if (!isExecuting || julesMode !== 'live' || approval) return;

    const pollTimer = setInterval(async () => {
      if (pollBusy.current) return;
      pollBusy.current = true;
      try {
        const liveTasks = tasksRef.current.filter(
          (t) => t.column === 'IN_PROGRESS' && t.sessionId && t.assignee === 'Jules'
        );
        for (const tile of liveTasks) {
          await pollJulesTask(tile);
        }
      } finally {
        pollBusy.current = false;
      }
    }, 10000);

    return () => clearInterval(pollTimer);
  }, [isExecuting, julesMode, approval]);

  async function pollJulesTask(tile) {
    if (!tile.sessionId) return;
    try {
      const res = await fetch(`/api/jules/${tile.sessionId}`);
      if (!res.ok) {
        throw new Error(`Session poll failed (${res.status})`);
      }
      consecutiveErrorsRef.current[tile.id] = 0;
      const sView = await res.json();

      onUpdateTaskProgress(tile.id, sView.progress);
      onPatchTask(tile.id, {
        plan: sView.plan,
        lastStep: sView.lastStep,
        report: sView.report,
      });

      // Gates evaluation based on session state
      let windowGateVerdict = null;
      let doneGateVerdict = null;
      let riskyGateVerdict = null;

      if (sView.state === 'IN_PROGRESS' && tile.checkpointActive && sView.lastStep) {
        windowGateVerdict = await gate('window', tile, {
          atWindow: true,
          lastStep: sView.lastStep.title,
        });
      }

      if (sView.state === 'COMPLETED') {
        doneGateVerdict = await gate('done', tile, { report: sView.report });
        if (doneGateVerdict.action === 'done') {
          riskyGateVerdict = await gate('risky', tile, {
            pending: {
              kind: 'merge',
              detail: `Merge ${sView.report?.prUrl || ''}: ${sView.report?.summary || ''}`,
              diff: tile.diff || sView.report?.summary || undefined,
            },
          });
        }
      }

      const step = computeLiveStep({
        tile,
        sessionView: sView,
        windowGateVerdict,
        doneGateVerdict,
        riskyGateVerdict,
      });

      if (step.type === 'ask_plan') {
        ask(tile, { gate: 'jules_plan', action: 'approve' }, step.question, { askedFor: step.askedFor });
      } else if (step.type === 'needs_feedback') {
        onPatchTask(tile.id, { needsYou: step.message, askedFor: step.askedFor });
      } else if (step.type === 'ask_window_open') {
        ask(tile, { gate: 'window_open', action: 'open', sessionUrl: step.sessionUrl }, step.question, {
          askedFor: step.askedFor,
        });
      } else if (step.type === 'ask_done') {
        ask(tile, { gate: 'done_confirm', action: 'done' }, step.question, { askedFor: step.askedFor });
      } else if (step.type === 'ask_send_back') {
        ask(
          tile,
          { gate: 'done_send_back', action: 'send_back', missingItems: step.missingItems },
          step.question,
          { askedFor: step.askedFor }
        );
      } else if (step.type === 'ask_open_pr') {
        ask(tile, { gate: 'risky_open_pr', action: 'run', prUrl: step.prUrl }, step.question, {
          askedFor: step.askedFor,
        });
      } else if (step.type === 'flag') {
        onPatchTask(tile.id, { needsYou: step.reason, askedFor: step.askedFor });
      } else if (step.type === 'clear_needs_you') {
        onPatchTask(tile.id, { needsYou: null });
      }
    } catch (err) {
      const errCount = (consecutiveErrorsRef.current[tile.id] || 0) + 1;
      consecutiveErrorsRef.current[tile.id] = errCount;
      if (errCount >= 2) {
        onPatchTask(tile.id, {
          needsYou: `Jules API poll error: ${err instanceof Error ? err.message : 'Connection failed'}`,
        });
      }
    }
  }

  // ── Dispatch: Route Gate Routing ───────────────────────────────────────────

  async function dispatch(tile) {
    const v = await gate('route', tile);
    const isJulesRoute = v.action === 'jules';
    const isWriterRoute = v.action === 'writer';

    if (isJulesRoute) {
      if (julesMode === 'live') {
        // In live mode, every real dispatch asks the person first
        return ask(tile, v, `Start a Jules session for ${tile.id}?`, { actionType: 'jules_dispatch' });
      }
      if (v.verdict === 'act') return start(tile, 'jules');
      if (v.verdict === 'confirm') return ask(tile, v, `Send ${tile.id} to Jules?`, { actionType: 'route' });
    }

    if (isWriterRoute) {
      if (v.verdict === 'act') return start(tile, 'writer');
      if (v.verdict === 'confirm') return ask(tile, v, `Send ${tile.id} to writer?`, { actionType: 'route' });
    }

    hold(tile, v);
  }

  function start(tile, owner) {
    onPatchTask(tile.id, { assignee: owner === 'jules' ? 'Jules (simulated)' : 'Writer model (simulated)' });
    onMoveTask(tile.id, 'IN_PROGRESS');
  }

  async function startRealJules(tile) {
    const project = projects.find((p) => p.id === tile.projectId);
    try {
      const res = await fetch('/api/jules/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tile, project }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Dispatch error (${res.status})`);
      }
      const data = await res.json();
      onPatchTask(tile.id, {
        sessionId: data.sessionId,
        sessionUrl: data.url,
        assignee: 'Jules',
        needsYou: null,
      });
      onMoveTask(tile.id, 'IN_PROGRESS');
      log('act', `Jules session started for ${tile.id}: ${data.url}`);
    } catch (err) {
      onPatchTask(tile.id, { needsYou: err instanceof Error ? err.message : 'Dispatch failed' });
    }
  }

  // ── Simulated Tile Progression ─────────────────────────────────────────────

  async function advanceSimulated(tile) {
    const steps = Math.max(1, tile.subtasks?.length ?? 1);
    const from = tile.progress ?? 0;
    const to = Math.min(100, from + 10 + Math.floor(Math.random() * 20));
    const finished = (p) => Math.floor((p / 100) * steps);
    onUpdateTaskProgress(tile.id, to);

    if (tile.checkpointActive && to < 100 && finished(to) > finished(from)) {
      const step = tile.subtasks[finished(to) - 1];
      const v = await gate('window', tile, { atWindow: true, lastStep: `Finished: ${step}` });
      if (v.action === 'open' && v.verdict !== 'escalate') {
        return ask(tile, v, `Bring in a ${v.details?.role ?? 'reviewer'} on ${tile.id} now?`, { actionType: 'window' });
      }
      if (v.verdict === 'escalate') hold(tile, v);
      return;
    }

    if (to >= 100) {
      const report = {
        summary: `Completed: ${(tile.subtasks ?? []).join('; ')}.`,
        prUrl: `sim://${tile.id}`,
        testsPassed: true,
      };
      const v = await gate('done', tile, { report });
      if (v.action === 'done' && v.verdict === 'act') return onMoveTask(tile.id, 'REVIEW');
      if (v.action === 'done' && v.verdict === 'confirm') return ask(tile, v, `Mark ${tile.id} done?`, { actionType: 'done' });
      if (v.action === 'send_back' && v.verdict === 'act') return sendBack(tile);
      hold(tile, v);
    }
  }

  function sendBack(tile) {
    const steps = Math.max(1, tile.subtasks?.length ?? 1);
    onUpdateTaskProgress(tile.id, Math.round((100 * (steps - 1)) / steps));
  }

  // ── Human Answer Resolution ────────────────────────────────────────────────

  async function answer(yes) {
    const { tile, verdict, actionType, askedFor } = approval;
    onPatchTask(tile.id, { needsYou: null, askedFor });

    if (actionType === 'jules_dispatch') {
      if (yes) {
        await startRealJules(tile);
      } else {
        onPatchTask(tile.id, { needsYou: 'Jules dispatch declined' });
      }
    } else if (verdict.gate === 'jules_plan') {
      if (yes) {
        await fetch(`/api/jules/${tile.sessionId}/approve`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        log('act', `Approved plan for ${tile.id}`);
      } else {
        onPatchTask(tile.id, { needsYou: 'Plan rejected - enter feedback in drawer' });
      }
    } else if (verdict.gate === 'window_open') {
      if (yes && verdict.sessionUrl) {
        window.open(verdict.sessionUrl, '_blank');
      }
    } else if (verdict.gate === 'done_confirm') {
      if (yes) {
        onMoveTask(tile.id, 'REVIEW');
      } else {
        sendBack(tile);
      }
    } else if (verdict.gate === 'done_send_back') {
      if (yes && tile.sessionId) {
        await fetch(`/api/jules/${tile.sessionId}/message`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: `Please finish: ${verdict.missingItems || 'remaining items'}` }),
        });
        log('act', `Requested Jules to finish missing items for ${tile.id}`);
      } else {
        onPatchTask(tile.id, { needsYou: 'Returned to backlog' });
      }
    } else if (verdict.gate === 'risky_open_pr') {
      if (yes) {
        if (verdict.prUrl) window.open(verdict.prUrl, '_blank');
        onMoveTask(tile.id, 'REVIEW');
      } else {
        onPatchTask(tile.id, { needsYou: 'PR open declined' });
      }
    } else if (verdict.gate === 'route') {
      if (yes) start(tile, verdict.action);
      else onPatchTask(tile.id, { needsYou: 'Routing declined: assign it by hand' });
    } else if (verdict.gate === 'window') {
      const role = verdict.details?.role ?? 'reviewer';
      log('note', yes ? `Window on ${tile.id}: a ${role} joins.` : `Window on ${tile.id}: kept going.`);
    } else if (verdict.gate === 'done') {
      if (yes) onMoveTask(tile.id, 'REVIEW');
      else sendBack(tile);
    }

    setApproval(null);
    setIsExecuting(true);
  }

  // ── Quick Task Creation via Intake Gate ────────────────────────────────────

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
      description: doneWhen ? `${title}. Done when: ${doneWhen}` : title,
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
          <span
            className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${
              julesMode === 'live'
                ? 'text-wal-emerald border-wal-emerald/40 bg-wal-emerald/10'
                : 'text-slate-400 border-slate-600 bg-slate-800/40'
            }`}
          >
            JULES: {julesMode.toUpperCase()}
          </span>
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
            {approval.verdict?.reason && (
              <span className="text-slate-400 text-[10px]">({approval.verdict.reason})</span>
            )}
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
              <span>
                SURENESS: <strong className="text-optic-cyan">{lastGateVerdict.sureness}</strong>
              </span>
              <span>
                VERDICT:{' '}
                <strong
                  className={lastGateVerdict.verdict === 'act' ? 'text-wal-emerald' : 'text-drift-amber'}
                >
                  {lastGateVerdict.verdict.toUpperCase()}
                </strong>
              </span>
              <span className="text-slate-500">
                {lastGateVerdict.source === 'jev' && lastGateVerdict.mode === 'stand-in'
                  ? 'stand-in'
                  : lastGateVerdict.source}{' '}
                · {lastGateVerdict.ms}ms
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
              <span className="text-[9px] px-1 bg-optic-cyan/20 rounded">
                {julesMode === 'live' ? 'REAL SESSIONS' : 'SIMULATED RUNS'}
              </span>
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
