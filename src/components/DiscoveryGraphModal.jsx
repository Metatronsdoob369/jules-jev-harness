import React, { useState, useEffect } from 'react';
import DiscoveryJostleCanvas from './DiscoveryJostleCanvas';
import {
  Network,
  Share2,
  Database,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Code2,
  CheckCircle2,
  X,
  Play,
  Layers,
  Compass,
  AlertCircle,
  Cpu
} from 'lucide-react';

export default function DiscoveryGraphModal({ isOpen, onClose, onDispatchTask }) {
  const [activeTab, setActiveTab] = useState('motherboard'); // 'motherboard' | 'hypotheses' | 'gql' | 'registry'
  const [stats, setStats] = useState(null);
  const [hypotheses, setHypotheses] = useState([]);
  const [gqlDdl, setGqlDdl] = useState('');
  const [loading, setLoading] = useState(false);
  const [dispatchingId, setDispatchingId] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadDiscoveryData();
  }, [isOpen]);

  async function loadDiscoveryData() {
    setLoading(true);
    try {
      const [statsRes, hypRes, gqlRes] = await Promise.all([
        fetch('/api/discovery/stats').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/discovery/hypotheses').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/discovery/gql').then((r) => (r.ok ? r.json() : null)),
      ]);

      if (statsRes) setStats(statsRes);
      if (hypRes?.hypotheses) setHypotheses(hypRes.hypotheses);
      if (gqlRes?.ddl) setGqlDdl(gqlRes.ddl);
    } catch (err) {
      console.error('Failed to load discovery graph telemetry:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSynthesizeFresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/discovery/hypotheses/synthesize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setHypotheses(data.hypotheses || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Synthesis failed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDispatch(hyp) {
    setDispatchingId(hyp.id);
    try {
      const res = await fetch('/api/discovery/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hypothesisId: hyp.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.task && onDispatchTask) {
          onDispatchTask(data.task);
          onClose();
        }
      }
    } catch (err) {
      console.error('Dispatch failed:', err);
    } finally {
      setDispatchingId(null);
    }
  }

  function handleCopyGql() {
    navigator.clipboard.writeText(gqlDdl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className={`bg-canvas-deck border border-canvas-bezel rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200 transition-all duration-300 ${activeTab === 'motherboard' ? 'w-[98vw] max-w-[1460px] h-[96vh]' : 'w-full max-w-5xl h-[88vh]'}`}>
        {/* Modal Header */}
        <div className="px-6 py-3 border-b border-canvas-bezel flex items-center justify-between bg-canvas-deep shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded bg-optic-cyan/10 border border-optic-cyan/30 text-optic-cyan">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  DATA DISCOVERY ENGINE · PROPERTY GRAPH
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-wal-emerald/10 text-wal-emerald border border-wal-emerald/30 font-mono">
                  ISO GQL / BigQuery Graph
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono">
                  Sealed Planar Motherboard
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-variable topology over 1,200 federal APIs, join-key crosswalks, and autonomous backtest briefs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Telemetry Counter Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-6 py-2 bg-canvas-surface/60 border-b border-canvas-bezel text-xs font-mono shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase">Indexed Endpoints</span>
            <span className="text-sm font-bold text-optic-cyan">
              {stats?.totalEndpoints ?? '406'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase">Agencies / Rooms</span>
            <span className="text-sm font-bold text-slate-200">
              {stats?.totalAgencies ?? '6'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase">Canonical Join Keys</span>
            <span className="text-sm font-bold text-amber-400">
              {stats?.totalJoinKeys ?? '6'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase">Crosswalk Bridges</span>
            <span className="text-sm font-bold text-wal-emerald">
              {stats?.totalCrosswalkBridges ?? '4'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase">Proven Correlations</span>
            <span className="text-sm font-bold text-purple-400">
              {stats?.totalDiscoveredCorrelations ?? '12'}
            </span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center space-x-2 px-6 pt-2.5 border-b border-canvas-bezel bg-canvas-deep text-xs font-bold shrink-0">
          <button
            onClick={() => setActiveTab('motherboard')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'motherboard'
                ? 'border-optic-cyan text-optic-cyan shadow-[0_2px_8px_rgba(0,229,255,0.2)]'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
            <span>PLANAR MOTHERBOARD (JOSTLE)</span>
          </button>

          <button
            onClick={() => setActiveTab('hypotheses')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'hypotheses'
                ? 'border-optic-cyan text-optic-cyan'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>HYPOTHESIS SYNTHESIZER ({hypotheses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('gql')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'gql'
                ? 'border-optic-cyan text-optic-cyan'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>BIGQUERY GQL DDL</span>
          </button>

          <button
            onClick={() => setActiveTab('registry')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'registry'
                ? 'border-optic-cyan text-optic-cyan'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>JOIN-KEY REGISTRY</span>
          </button>

          <div className="flex-1" />

          {activeTab === 'hypotheses' && (
            <button
              onClick={handleSynthesizeFresh}
              disabled={loading}
              className="mb-2 px-2.5 py-1 rounded bg-optic-cyan/10 hover:bg-optic-cyan/20 border border-optic-cyan/30 text-optic-cyan text-xs font-mono transition-all disabled:opacity-50"
            >
              {loading ? 'Traversing Graph...' : '⚡ Resynthesize GQL Paths'}
            </button>
          )}

          {activeTab === 'gql' && (
            <button
              onClick={handleCopyGql}
              className="mb-2 px-2.5 py-1 rounded bg-wal-emerald/10 hover:bg-wal-emerald/20 border border-wal-emerald/30 text-wal-emerald text-xs font-mono transition-all flex items-center space-x-1.5"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy BigQuery DDL'}</span>
            </button>
          )}
        </div>

        {/* Tab Body */}
        <div className={`flex-1 ${activeTab === 'motherboard' ? 'p-0 relative overflow-hidden' : 'overflow-y-auto p-6 space-y-4'}`}>
          {activeTab === 'motherboard' && (
            <DiscoveryJostleCanvas
              onDispatchTask={(task) => {
                if (onDispatchTask) onDispatchTask(task);
                onClose();
              }}
              onClose={onClose}
            />
          )}

          {activeTab === 'hypotheses' && (
            <div className="space-y-3">
              {hypotheses.map((hyp) => (
                <div
                  key={hyp.id}
                  className="p-4 rounded-lg bg-canvas-surface border border-canvas-bezel hover:border-optic-cyan/40 transition-all flex flex-col space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {hyp.sourceEndpoint.domain.toUpperCase()} ➔ {hyp.targetEndpoint.domain.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Lead: ~{hyp.estimatedLeadTimeDays}d
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-optic-cyan/10 text-optic-cyan border border-optic-cyan/20">
                          Confidence: {(hyp.confidenceScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{hyp.title}</h3>
                    </div>

                    <button
                      onClick={() => handleDispatch(hyp)}
                      disabled={dispatchingId === hyp.id}
                      className="px-3 py-1.5 rounded bg-optic-cyan text-canvas-deep hover:bg-optic-cyan/90 font-bold text-xs flex items-center space-x-1.5 transition-all shadow-[0_0_12px_rgba(0,229,255,0.25)] shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{dispatchingId === hyp.id ? 'Dispatching...' : 'Dispatch to Jules'}</span>
                    </button>
                  </div>

                  {/* Join Topology Path Diagram */}
                  <div className="p-2.5 rounded bg-canvas-deep border border-canvas-bezel/60 flex items-center space-x-2 text-xs font-mono text-slate-300 overflow-x-auto">
                    <span className="text-optic-cyan font-bold truncate max-w-[200px]">
                      {hyp.sourceEndpoint.name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-amber-300 shrink-0">
                      [{hyp.joinPath.fromKey}]
                    </span>
                    {hyp.joinPath.viaCrosswalk && (
                      <>
                        <span className="text-[10px] text-slate-400 italic shrink-0">
                          via {hyp.joinPath.viaCrosswalk}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-wal-emerald shrink-0">
                          [{hyp.joinPath.toKey}]
                        </span>
                      </>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-wal-emerald font-bold truncate max-w-[200px]">
                      {hyp.targetEndpoint.name}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{hyp.rationale}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'gql' && (
            <div className="space-y-3">
              <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 flex items-start space-x-2.5 text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  This DDL definition strictly conforms to BigQuery GoogleSQL's ISO GQL Property Graph standard.
                  Execute directly in BigQuery Studio to stand up petabyte-scale graph analytics over public datasets.
                </p>
              </div>

              <pre className="p-4 rounded-lg bg-canvas-deep border border-canvas-bezel text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed select-all">
                {gqlDdl}
              </pre>
            </div>
          )}

          {activeTab === 'registry' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Canonical Spatial & Corporate Join Keys
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {[
                    { id: 'SPATIAL_ZIP5', name: '5-Digit Postal ZIP', type: 'string', desc: 'USPS delivery zone' },
                    { id: 'SPATIAL_GEOID', name: 'Census FIPS / Tract', type: 'string', desc: '11-digit tract identifier' },
                    { id: 'CORPORATE_CIK', name: 'SEC Central Index Key', type: 'string', desc: '10-digit registrant' },
                    { id: 'CORPORATE_EIN', name: 'IRS Employer ID (EIN)', type: 'string', desc: 'Federal tax number' },
                    { id: 'TEMPORAL_DATE', name: 'ISO 8601 Calendar Day', type: 'date', desc: 'YYYY-MM-DD timestamp' },
                    { id: 'MACRO_SERIES_ID', name: 'FRED / BLS Series ID', type: 'string', desc: 'Economic time-series' },
                  ].map((k) => (
                    <div key={k.id} className="p-3 rounded bg-canvas-surface border border-canvas-bezel">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-optic-cyan font-mono">{k.id}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{k.type}</span>
                      </div>
                      <div className="text-xs text-slate-200">{k.name}</div>
                      <div className="text-[11px] text-slate-400">{k.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Active Crosswalk Transformation Bridges
                </h4>
                <div className="space-y-2">
                  {[
                    {
                      name: 'HUD-USPS ZIP-to-Census Tract Crosswalk',
                      from: 'SPATIAL_ZIP5',
                      to: 'SPATIAL_GEOID',
                      conf: '98%',
                      fn: 'hud_crosswalk_zip_to_tract_v1',
                    },
                    {
                      name: 'SEC-IRS Corporate Entity Mapping Crosswalk',
                      from: 'CORPORATE_EIN',
                      to: 'CORPORATE_CIK',
                      conf: '95%',
                      fn: 'sec_company_tickers_ein_map',
                    },
                    {
                      name: 'Daily to Monthly Calendar Aggregation',
                      from: 'TEMPORAL_DATE',
                      to: 'TEMPORAL_MONTH',
                      conf: '100%',
                      fn: 'date_trunc_month',
                    },
                  ].map((c) => (
                    <div
                      key={c.name}
                      className="p-3 rounded bg-canvas-surface border border-canvas-bezel flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{c.name}</span>
                        <div className="text-[11px] font-mono text-slate-400">
                          {c.from} ➔ {c.to} | Function: <span className="text-optic-cyan">{c.fn}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-wal-emerald/10 text-wal-emerald border border-wal-emerald/20 font-mono text-xs">
                        {c.conf} Conf
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
