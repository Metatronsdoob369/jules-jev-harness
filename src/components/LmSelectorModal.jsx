import React, { useState } from 'react';
import { Key, ShieldCheck, Cpu, Sliders, AlertTriangle, X, Check } from 'lucide-react';

export default function LmSelectorModal({
  isOpen,
  onClose,
  models,
  activeModel,
  onSelectModel,
  checkpoints,
  onToggleCheckpoint,
  apiKeys,
  onSaveApiKey
}) {
  const [activeTab, setActiveTab] = useState('MODELS'); // MODELS | CHECKPOINTS | KEYS
  const [keyInputs, setKeyInputs] = useState(apiKeys || {});

  if (!isOpen) return null;

  const handleKeyChange = (provider, value) => {
    setKeyInputs((prev) => ({ ...prev, [provider]: value }));
  };

  const handleSaveKeys = (e) => {
    e.preventDefault();
    Object.entries(keyInputs).forEach(([provider, val]) => {
      onSaveApiKey(provider, val);
    });
    alert('API Key secrets updated in memory harness.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-canvas-deep/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-canvas-deck border border-optic-cyan/30 rounded-xl shadow-[0_0_30px_rgba(0,229,255,0.15)] overflow-hidden font-mono flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-canvas-bezel border-b border-canvas-bezel/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-optic-cyan" />
            <span className="font-bold text-sm tracking-wider text-slate-100">
              ORCHESTRATION CONFIG & LM SELECTION CONTROL
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-canvas-panel transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-canvas-bezel bg-canvas-base px-5">
          <button
            onClick={() => setActiveTab('MODELS')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'MODELS'
                ? 'border-optic-cyan text-optic-cyan'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            01 // ACTIVE LM MODEL
          </button>
          <button
            onClick={() => setActiveTab('CHECKPOINTS')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'CHECKPOINTS'
                ? 'border-optic-cyan text-optic-cyan'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            02 // WORKFLOW CHECKPOINTS
          </button>
          <button
            onClick={() => setActiveTab('KEYS')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'KEYS'
                ? 'border-optic-cyan text-optic-cyan'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            03 // SECRET KEYS & TOKENS
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: MODELS */}
          {activeTab === 'MODELS' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Select the primary large model for Jules & Jev.ai orchestration. Models can be selected prior to project start or swapped mid-flight at predefined pause breaks.
              </p>

              <div className="grid grid-cols-1 gap-2.5">
                {models.map((m) => {
                  const isSelected = activeModel.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => onSelectModel(m)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-canvas-panel border-optic-cyan shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                          : 'bg-canvas-base border-canvas-bezel hover:border-optic-bright/40'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-100">{m.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-canvas-deck text-optic-bright border border-optic-bright/30">
                            {m.provider}
                          </span>
                          <span className="text-[10px] text-slate-400">({m.tier})</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center space-x-4">
                          <span>LATENCY: {m.latency}</span>
                          <span>COST/1K: {m.costPer1k}</span>
                          <span className="text-wal-emerald">STATUS: {m.status}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isSelected ? (
                          <span className="flex items-center space-x-1 px-2.5 py-1 rounded bg-optic-cyan/20 text-optic-cyan border border-optic-cyan/40 text-xs font-bold">
                            <Check className="w-3.5 h-3.5" />
                            <span>SELECTED</span>
                          </span>
                        ) : (
                          <button className="px-2.5 py-1 rounded bg-canvas-bezel text-slate-300 text-xs hover:text-white">
                            SELECT
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CHECKPOINTS */}
          {activeTab === 'CHECKPOINTS' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Configure predefined workflow break points. When enabled, execution pauses at the specified stage allowing user-selected LMs to review, critique, or approve plans.
              </p>

              <div className="space-y-2.5">
                {checkpoints.map((chk) => (
                  <div
                    key={chk.id}
                    className="p-3.5 rounded-lg bg-canvas-base border border-canvas-bezel flex items-center justify-between"
                  >
                    <div className="space-y-1 max-w-lg">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-100 text-xs">{chk.stage}</span>
                        <span className="text-[10px] text-drift-amber bg-drift-amber/10 px-1.5 py-0.5 rounded border border-drift-amber/30">
                          {chk.trigger}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{chk.description}</p>
                    </div>

                    <button
                      onClick={() => onToggleCheckpoint(chk.id)}
                      className={`px-3 py-1.5 rounded text-xs font-bold flex items-center space-x-1.5 transition-all ${
                        chk.enabled
                          ? 'bg-wal-emerald/20 text-wal-emerald border border-wal-emerald/40'
                          : 'bg-canvas-bezel text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{chk.enabled ? 'BREAK ACTIVE' : 'PASSTHROUGH'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: KEYS */}
          {activeTab === 'KEYS' && (
            <form onSubmit={handleSaveKeys} className="space-y-4">
              <p className="text-xs text-slate-300">
                Provide custom provider API secret keys. Keys are maintained strictly in memory harness and never saved externally.
              </p>

              <div className="space-y-3">
                {['Google AI (Gemini)', 'Anthropic (Claude)', 'OpenAI (GPT-4o)', 'DeepSeek AI'].map((prov) => (
                  <div key={prov} className="space-y-1">
                    <label className="text-[11px] text-slate-400 block">{prov} API Key Secret</label>
                    <div className="relative">
                      <input
                        type="password"
                        value={keyInputs[prov] || ''}
                        onChange={(e) => handleKeyChange(prov, e.target.value)}
                        placeholder={`sk-proj-... (${prov})`}
                        className="w-full bg-canvas-base border border-canvas-bezel focus:border-optic-cyan rounded px-3 py-2 text-xs text-slate-200 font-mono outline-none"
                      />
                      <Key className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-optic-cyan text-canvas-deep font-bold rounded hover:bg-optic-bright transition-colors text-xs"
                >
                  SAVE SECRET KEYS
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-canvas-base border-t border-canvas-bezel flex items-center justify-between text-[11px] text-slate-400">
          <span>ACTIVE ENGINE: {activeModel.name}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-canvas-bezel text-slate-200 rounded hover:bg-canvas-panel"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
