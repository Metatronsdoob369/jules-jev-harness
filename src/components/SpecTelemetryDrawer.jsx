import React, { useState } from 'react';
import { X, Activity, Clock, Cpu, Zap, Shield, CheckSquare, Layers, BarChart2, ShieldCheck, AlertTriangle, ExternalLink, Send } from 'lucide-react';

export default function SpecTelemetryDrawer({ task, project, activeModel, onClose, onUpdateProgress, onMoveTask, onPatchTask }) {
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(null);

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

  const patronageColor = project?.color || '#00E5FF';
  const gateVerdict = task.lastGateVerdict || null;
  const sourceLabel = gateVerdict?.source === 'jev' && gateVerdict?.mode === 'stand-in' ? 'stand-in' : gateVerdict?.source;
  const isJulesTile = Boolean(task.sessionId);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() || !task.sessionId) return;
    setIsSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/jules/${task.sessionId}/message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: messageText.trim() }),
      });
      if (!res.ok) {
        let errMessage = 'Failed to send message';
        try {
          const body = await res.json();
          if (body?.error) errMessage = body.error;
        } catch {}
        setSendError(errMessage);
      } else {
        setMessageText('');
        if (onPatchTask) {
          onPatchTask(task.id, { needsYou: null });
        }
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Network error sending message');
    } finally {
      setIsSending(false);
    }
  };

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
          </div>
          <h3 className="font-sans font-bold text-slate-100 text-sm leading-snug">{task.title}</h3>
        </div>

        <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded hover:bg-canvas-panel">
          <X className="w-4 h-4" />
        </button>
      </div>

      {task.needsYou && (
        <div className="p-2 rounded bg-drift-amber/10 border border-drift-amber/40 text-[11px] text-drift-amber">
          <span className="font-bold">NEEDS YOU:</span> {task.needsYou}
          {!isJulesTile && (
            <span className="block text-[10px] text-slate-400 mt-0.5">Move the tile with Stage Control to decide.</span>
          )}
        </div>
      )}

      {/* Jules Session Link, Plan & Reply Box */}
      {(task.sessionId || task.sessionUrl) && (
        <div className="p-3 rounded-lg bg-canvas-base border border-optic-cyan/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-optic-cyan flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5" />
              <span>JULES SESSION</span>
            </span>
            {task.sessionUrl && (
              <a
                href={task.sessionUrl}
                target="_blank"
                rel="noreferrer"
                className="text-wal-emerald hover:underline flex items-center space-x-1 text-[11px] font-bold"
              >
                <span>OPEN SESSION</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="text-[10px] text-slate-400">
            ID: <span className="text-slate-200">{task.sessionId}</span>
          </div>
          {task.lastStep && (
            <div className="text-[11px] text-slate-300 bg-canvas-deck p-2 rounded border border-canvas-bezel space-y-0.5">
              <span className="text-[10px] text-slate-500 block font-bold">NEWEST STEP</span>
              <div className="font-bold text-wal-emerald">{task.lastStep.title}</div>
              {task.lastStep.description && (
                <div className="text-slate-400 text-[10px]">{task.lastStep.description}</div>
              )}
            </div>
          )}
          {Array.isArray(task.plan) && task.plan.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="text-[10px] text-slate-400 font-bold block">PLAN STEPS:</span>
              <div className="space-y-1">
                {task.plan.map((step, idx) => (
                  <div key={idx} className="text-[10px] text-slate-300 flex items-start space-x-1.5">
                    <span className="text-optic-cyan shrink-0">{idx + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reply Box for sending feedback / instructions to Jules */}
          <div className="pt-2 border-t border-canvas-bezel space-y-1.5">
            <span className="text-[10px] text-slate-400 font-bold block">REPLY TO JULES:</span>
            <form onSubmit={handleSendMessage} className="flex flex-col space-y-1.5">
              <textarea
                rows={2}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message or plan feedback for Jules..."
                className="w-full bg-canvas-deck border border-canvas-bezel focus:border-optic-cyan rounded p-1.5 text-slate-200 outline-none text-[11px] resize-none"
              />
              {sendError && (
                <div className="text-[10px] text-red-400">{sendError}</div>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSending || !messageText.trim()}
                  className="px-2.5 py-1 bg-optic-cyan text-canvas-deep font-bold rounded flex items-center space-x-1 hover:bg-optic-bright transition-colors disabled:opacity-40 text-[10px]"
                >
                  <Send className="w-3 h-3" />
                  <span>{isSending ? 'SENDING...' : 'SEND'}</span>
                </button>
              </div>
            </form>
          </div>
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
            const isChecked = !isJulesTile && task.progress > (i + 1) * 30;
            return (
              <div key={i} className="flex items-center space-x-2 text-slate-300 text-[11px]">
                <span className={`w-3 h-3 rounded-sm flex items-center justify-center border text-[9px] ${
                  isChecked
                    ? 'bg-wal-emerald/20 border-wal-emerald text-wal-emerald'
                    : 'border-canvas-bezel text-transparent'
                }`}>
                  ✓
                </span>
                <span className={isChecked ? 'line-through text-slate-500' : ''}>{st}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
