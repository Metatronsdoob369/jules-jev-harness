import React from 'react';
import { X, Activity, Clock, Cpu, Zap, Shield, CheckSquare, Layers, BarChart2, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function SpecTelemetryDrawer({ task, project, activeModel, onClose, onUpdateProgress, onMoveTask }) {
  const [replyText, setReplyText] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [replyStatus, setReplyStatus] = React.useState(null);

  if (!task) {
    return (
      <div className="w-80 h-full bg-canvas-deck border-l border-canvas-bezel p-4 font-mono text-xs flex flex-col justify-center items-center text-center text-slate-500 space-y-2">
        <Activity className="w-8 h-8 text-canvas-bezel animate-pulse" />
        <p className="font-bold text-slate-400">NO TASK SELECTED</p>
        <p className="text-[11px] leading-relaxed">
          Select any 3D/2D task tile on the board to disclose high-density token, sureness confidence, and decision gate specs.
        </p>
      </div>
    );
  }

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!replyText.trim() || !task.sessionId || isSending) return;
    setIsSending(true);
    setReplyStatus(null);
    try {
      const res = await fetch(`/api/jules/${task.sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: replyText.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setReplyText('');
      setReplyStatus({ type: 'success', message: 'Message sent to Jules' });
    } catch (err) {
      setReplyStatus({ type: 'error', message: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const handleApprovePlan = async () => {
    if (!task.sessionId || isSending) return;
    setIsSending(true);
    setReplyStatus(null);
    try {
      const res = await fetch(`/api/jules/${task.sessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setReplyStatus({ type: 'success', message: 'Plan approved' });
    } catch (err) {
      setReplyStatus({ type: 'error', message: err.message });
    } finally {
      setIsSending(false);
    }
  };

  const patronageColor = project?.color || '#00E5FF';
  // Only real verdicts show here: a tile no gate has judged says so.
  const gateVerdict = task.lastGateVerdict || null;
  const sourceLabel = gateVerdict?.source === 'jev' && gateVerdict?.mode === 'stand-in' ? 'stand-in' : gateVerdict?.source;

  return (
    <div className="w-88 h-full bg-canvas-deck border-l border-canvas-bezel p-4 font-mono text-xs flex flex-col space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-canvas-bezel pb-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-sm text-optic-cyan">{task.id}</span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{
                backgroundColor: `${patronageColor}20`,
                color: patronageColor,
                border: `1px solid ${patronageColor}50`
              }}
            >
              {project?.name || 'PATRON'}
            </span>
            {(task.sessionUrl || task.sessionId) && (
              <a
                href={task.sessionUrl || `https://jules.google.com/session/${task.sessionId}`}
                target="_blank"
                rel="noreferrer"
                className="text-optic-cyan hover:underline flex items-center gap-1 text-[10px]"
              >
                Open in Jules ↗
              </a>
            )}
          </div>
          <h3 className="font-sans font-bold text-slate-100 text-sm leading-snug">{task.title}</h3>
        </div>

        <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded hover:bg-canvas-panel">
          <X className="w-4 h-4" />
        </button>
      </div>

      {task.needsYou && (
        <div className="p-2.5 rounded bg-drift-amber/10 border border-drift-amber/40 text-[11px] text-drift-amber space-y-1">
          <div><span className="font-bold">NEEDS YOU:</span> {task.needsYou}</div>
          {!task.sessionId && (
            <span className="block text-[10px] text-slate-400 mt-0.5">Move the tile with Stage Control to decide.</span>
          )}
        </div>
      )}

      {task.prUrl && (
        <div className="p-2.5 rounded bg-wal-emerald/10 border border-wal-emerald/40 text-[11px] flex items-center justify-between">
          <span className="text-wal-emerald font-bold">PULL REQUEST OPEN</span>
          <a
            href={task.prUrl}
            target="_blank"
            rel="noreferrer"
            className="text-optic-cyan hover:underline font-bold"
          >
            View PR ↗
          </a>
        </div>
      )}

      {!gateVerdict && (
        <div className="p-3 rounded-lg bg-canvas-base border border-canvas-bezel text-[11px] text-slate-500">
          No gate has judged this tile yet.
        </div>
      )}

      {/* Jev Decision Gate Approval Card */}
      {gateVerdict && (
      <div className="p-3 rounded-lg bg-canvas-base border border-optic-cyan/40 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center space-x-1.5 font-bold text-optic-cyan">
            <ShieldCheck className="w-4 h-4 text-wal-emerald" />
            <span className="uppercase">JEV GATE: {gateVerdict.gate}</span>
          </span>

          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              gateVerdict.verdict === 'act'
                ? 'bg-wal-emerald/20 text-wal-emerald border border-wal-emerald/40'
                : gateVerdict.verdict === 'confirm'
                ? 'bg-optic-cyan/20 text-optic-cyan border border-optic-cyan/40'
                : 'bg-drift-amber/20 text-drift-amber border border-drift-amber/40'
            }`}
          >
            {gateVerdict.verdict}
          </span>
        </div>

        <div className="text-slate-300 text-[11px] leading-relaxed">
          {gateVerdict.reason}
        </div>

        <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-canvas-bezel text-[10px]">
          <div>
            <span className="text-slate-500 block">SURENESS</span>
            <span className="font-bold text-wal-emerald">{gateVerdict.sureness}</span>
          </div>
          <div>
            <span className="text-slate-500 block">SOURCE</span>
            <span className="font-bold text-optic-cyan uppercase">{sourceLabel}</span>
          </div>
          <div>
            <span className="text-slate-500 block">LATENCY</span>
            <span className="font-bold text-slate-300">{gateVerdict.ms}ms</span>
          </div>
        </div>
        {gateVerdict.source === 'jev' && (
          <div className="text-[10px] text-slate-500">
            {gateVerdict.tokens} input tokens · {gateVerdict.model}
          </div>
        )}
      </div>
      )}

      {/* Jules Session Interaction Card */}
      {task.sessionId && (
        <div className="p-3 rounded-lg bg-canvas-base border border-optic-cyan/30 space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-optic-cyan flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-optic-cyan" />
              <span>JULES SESSION</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]" title={task.sessionId}>
              {task.sessionId}
            </span>
          </div>

          {(task.needsYou?.toLowerCase().includes('plan') || task.lastGateVerdict?.reason?.toLowerCase().includes('plan')) && (
            <div className="p-2 rounded bg-canvas-deck border border-wal-emerald/40 flex items-center justify-between">
              <span className="text-[11px] text-slate-300 font-medium">Plan waiting for review</span>
              <button
                type="button"
                onClick={handleApprovePlan}
                disabled={isSending}
                className="px-2.5 py-1 rounded bg-wal-emerald/20 text-wal-emerald border border-wal-emerald/40 hover:bg-wal-emerald/30 font-bold text-[10px] disabled:opacity-50 transition-colors"
              >
                {isSending ? 'Approving...' : 'Approve Plan'}
              </button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="space-y-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Send instruction or reply to Jules..."
              rows={2}
              className="w-full bg-canvas-deck border border-canvas-bezel rounded p-2 text-slate-200 placeholder-slate-500 text-[11px] font-mono focus:outline-none focus:border-optic-cyan resize-none"
            />
            <div className="flex items-center justify-between">
              {replyStatus ? (
                <span className={`text-[10px] ${replyStatus.type === 'error' ? 'text-rose-400' : 'text-wal-emerald'}`}>
                  {replyStatus.message}
                </span>
              ) : <span />}
              <button
                type="submit"
                disabled={isSending || !replyText.trim()}
                className="px-2.5 py-1 rounded bg-optic-cyan/20 text-optic-cyan border border-optic-cyan/40 hover:bg-optic-cyan/30 font-bold text-[10px] disabled:opacity-50 transition-colors"
              >
                {isSending ? 'Sending...' : 'Send to Jules'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Progress & Stage Control */}
      <div className="p-3 rounded-lg bg-canvas-base border border-canvas-bezel space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px]">COLUMN STATUS:</span>
          <span className="font-bold text-optic-bright">{task.column}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px]">COMPLETION:</span>
          <span className={`font-bold ${task.progress === 100 ? 'text-wal-emerald' : 'text-drift-amber'}`}>
            {task.progress}%
          </span>
        </div>

        <div className="w-full bg-canvas-bezel h-2 rounded overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${task.progress}%`,
              backgroundColor: task.progress === 100 ? '#00FF88' : patronageColor
            }}
          />
        </div>

        <div className="pt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">STAGE CONTROL:</span>
          <div className="flex space-x-1">
            {['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'DONE'].map((col) => (
              <button
                key={col}
                onClick={() => onMoveTask(task.id, col)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  task.column === col
                    ? 'bg-optic-cyan text-canvas-deep'
                    : 'bg-canvas-bezel text-slate-400 hover:text-white'
                }`}
              >
                {col.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Telemetry Metrics */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
          <BarChart2 className="w-3.5 h-3.5 text-optic-cyan" />
          <span>TELEMETRY SPECS · SIMULATED</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded bg-canvas-base border border-canvas-bezel space-y-1">
            <span className="text-[10px] text-slate-400 block">TOKENS USED</span>
            <span className="text-sm font-bold text-optic-cyan block">{task.tokensUsed.toLocaleString()}</span>
            <span className="text-[9px] text-slate-500">Token decay nominal</span>
          </div>

          <div className="p-2.5 rounded bg-canvas-base border border-canvas-bezel space-y-1">
            <span className="text-[10px] text-slate-400 block">ACTUAL TIME</span>
            <span className="text-sm font-bold text-wal-emerald block">{task.actualTimeMinutes} MINS</span>
            <span className="text-[9px] text-slate-500">Execution elapsed</span>
          </div>

          <div className="p-2.5 rounded bg-canvas-base border border-canvas-bezel space-y-1">
            <span className="text-[10px] text-slate-400 block">AVG THROUGHPUT</span>
            <span className="text-sm font-bold text-drift-amber block">{task.avgThroughputTps} TPS</span>
            <span className="text-[9px] text-slate-500">Tokens / Sec</span>
          </div>

          <div className="p-2.5 rounded bg-canvas-base border border-canvas-bezel space-y-1">
            <span className="text-[10px] text-slate-400 block">ACTIVE ENGINE</span>
            <span className="text-xs font-bold text-slate-200 truncate block">{activeModel.name}</span>
            <span className="text-[9px] text-wal-emerald">{activeModel.latency}</span>
          </div>
        </div>
      </div>

      {/* Subtasks */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
          <CheckSquare className="w-3.5 h-3.5 text-wal-emerald" />
          <span>JEV-GATES ACCEPTANCE SUB-ITEMS</span>
        </div>

        <div className="space-y-1.5 bg-canvas-base p-2.5 rounded border border-canvas-bezel">
          {task.subtasks.map((st, i) => {
            const isCompleted = task.sessionId
              ? (task.progress === 100 || task.column === 'DONE')
              : (task.progress > (i + 1) * 30);
            return (
              <div key={i} className="flex items-center space-x-2 text-slate-300 text-[11px]">
                <span className={`w-3 h-3 rounded-sm flex items-center justify-center border text-[9px] ${
                  isCompleted
                    ? 'bg-wal-emerald/20 border-wal-emerald text-wal-emerald'
                    : 'border-canvas-bezel text-transparent'
                }`}>
                  ✓
                </span>
                <span className={isCompleted ? 'line-through text-slate-500' : ''}>{st}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
