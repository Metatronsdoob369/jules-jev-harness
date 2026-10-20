import React, { useState } from 'react';
import {
  X,
  Search,
  Building2,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Sparkles,
  RefreshCw,
  FileText,
  AlertCircle
} from 'lucide-react';

export default function CrisTransferAgentModal({ isOpen, onClose, onAddTask }) {
  const [address, setAddress] = useState('3501 Clayton Place, Vestavia, AL 35216');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchedTask, setDispatchedTask] = useState(null);

  if (!isOpen) return null;

  const handleReconcile = async (addrToUse) => {
    const targetAddr = addrToUse || address;
    if (!targetAddr.trim()) return;
    setLoading(true);
    setError(null);
    setDispatchedTask(null);

    try {
      const res = await fetch('/api/reconcile/cris-to-ta1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: targetAddr }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err?.message || 'Failed to reconcile address.');
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchToJules = async () => {
    if (!result) return;
    setDispatching(true);
    try {
      const res = await fetch('/api/discovery/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hypothesisId: 'hyp_census_geocoder_oneline_sec_edgar_ta1_transf',
        }),
      });

      if (!res.ok) throw new Error('Dispatch failed');
      const data = await res.json();
      if (data.task && onAddTask) {
        onAddTask(data.task);
        setDispatchedTask(data.task);
      }
    } catch (err) {
      alert(`Dispatch error: ${err?.message || err}`);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="bg-canvas-base border border-optic-cyan/50 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(0,229,255,0.2)] overflow-hidden font-mono">
        
        {/* Header */}
        <div className="h-14 border-b border-canvas-bezel px-6 flex items-center justify-between bg-canvas-deep">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-optic-cyan/20 border border-optic-cyan flex items-center justify-center text-optic-cyan">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <span>CRIS UTILITY ➔ SEC TRANSFER AGENT RECONCILER</span>
                <span className="text-[10px] bg-wal-emerald/20 text-wal-emerald border border-wal-emerald/40 px-2 py-0.5 rounded-full font-normal">
                  LIVE CENSUS + SEC TA-1
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-sans">
                Converts physical landline utility subscriber records into DTCC FINS numbers & custodian accounts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-canvas-bezel transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Address Input Deck */}
          <div className="bg-canvas-deep border border-canvas-bezel rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-optic-cyan" />
                <span>CRIS Operational Landline / Utility Address</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const sample = '3501 Clayton Place, Vestavia, AL 35216';
                  setAddress(sample);
                  handleReconcile(sample);
                }}
                className="text-[10px] text-optic-cyan hover:underline flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Quick-Fill Sample (Vestavia, AL)</span>
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReconcile()}
                  placeholder="e.g. 3501 Clayton Place, Vestavia, AL 35216"
                  className="w-full bg-canvas-base border border-canvas-bezel rounded-lg px-4 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-optic-cyan text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => handleReconcile()}
                disabled={loading}
                className="px-5 py-2.5 rounded-lg bg-optic-cyan text-canvas-deep font-bold hover:brightness-110 flex items-center space-x-2 transition-all shadow-[0_0_15px_rgba(0,229,255,0.4)] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>QUERYING FEDERAL APIS...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>RECONCILE NOW</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Results Grid (4-Stage Pipeline Output) */}
          {result && (
            <div className="space-y-4 animate-fadeIn">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-wal-emerald" />
                <span>EVIDENCE CHAIN: 4-STAGE STATUTORY RECONCILIATION</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Stage 1: CRIS Record */}
                <div className="bg-canvas-deep border border-canvas-bezel rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-canvas-bezel pb-2">
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">STAGE 1 // RAW SUBSCRIBER ANCHOR</span>
                    <span className="text-[9px] bg-canvas-deck px-2 py-0.5 rounded text-slate-400">CRIS Database</span>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Standardized Street Address:</div>
                    <div className="text-slate-100 font-bold text-sm">{result.matchedAddress}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-500">Record Type:</span>
                      <div className="text-slate-300">BellSouth Landline</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Account Classification:</span>
                      <div className="text-wal-emerald">Minor UTMA (1983–2002)</div>
                    </div>
                  </div>
                </div>

                {/* Stage 2: Federal Geocoder */}
                <div className="bg-canvas-deep border border-canvas-bezel rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-canvas-bezel pb-2">
                    <span className="text-[10px] text-optic-cyan uppercase tracking-widest font-bold">STAGE 2 // U.S. CENSUS BOUNDARY</span>
                    <span className="text-[9px] bg-optic-cyan/10 text-optic-cyan border border-optic-cyan/30 px-2 py-0.5 rounded">REST JSON</span>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">11-Digit Federal Census GEOID:</div>
                    <div className="text-optic-cyan font-bold text-base tracking-wider">{result.federalBoundary.geoid}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-500">State FIPS:</span>
                      <div className="text-slate-200">{result.federalBoundary.stateFips} ({result.federalBoundary.stateName})</div>
                    </div>
                    <div>
                      <span className="text-slate-500">County FIPS:</span>
                      <div className="text-slate-200">{result.federalBoundary.countyFips} ({result.federalBoundary.countyName})</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Tract:</span>
                      <div className="text-slate-200">{result.federalBoundary.tract}</div>
                    </div>
                  </div>
                </div>

                {/* Stage 3: SEC Form TA-1 Transfer Agent */}
                <div className="bg-canvas-deep border border-wal-emerald/40 rounded-xl p-4 space-y-2 bg-wal-emerald/5">
                  <div className="flex items-center justify-between border-b border-canvas-bezel pb-2">
                    <span className="text-[10px] text-wal-emerald uppercase tracking-widest font-bold">STAGE 3 // SEC TA-1 MASTER JOIN</span>
                    <span className="text-[9px] bg-wal-emerald/20 text-wal-emerald border border-wal-emerald/40 px-2 py-0.5 rounded font-bold">DTCC MATCH</span>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Registered Transfer Agent Entity:</div>
                    <div className="text-slate-100 font-bold text-sm tracking-wide">{result.transferAgent.entityName}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-slate-500">DTCC FINS Number:</span>
                      <div className="text-amber-400 font-bold text-sm">#{result.transferAgent.finsNumber}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Reg. Agency:</span>
                      <div className="text-slate-300">{result.transferAgent.regulatoryAgency}</div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">SEC Accession Number:</span>
                      <div className="text-slate-400 font-mono text-[10px]">{result.transferAgent.accessionNumber}</div>
                    </div>
                  </div>
                </div>

                {/* Stage 4: Rule 17Ad-17 Audit */}
                <div className="bg-canvas-deep border border-canvas-bezel rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between border-b border-canvas-bezel pb-2">
                    <span className="text-[10px] text-amber-400 uppercase tracking-widest font-bold">STAGE 4 // RULE 17Ad-17 & LINEAGE</span>
                    <span className="text-[9px] bg-amber-400/10 text-amber-400 border border-amber-400/30 px-2 py-0.5 rounded">COMPLIANCE</span>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Successor Custodian (Post-Merger):</div>
                    <div className="text-slate-200 font-bold text-xs">{result.transferAgent.successorEntity?.name || 'Direct Custodian'}</div>
                    {result.transferAgent.successorEntity && (
                      <div className="text-[10px] text-slate-500">
                        Successor FINS: #{result.transferAgent.successorEntity.finsNumber} | CIK: {result.transferAgent.successorEntity.cik}
                      </div>
                    )}
                  </div>
                  <div className="pt-1 text-[11px] border-t border-canvas-bezel mt-2">
                    <span className="text-slate-500">Audit Status:</span>
                    <div className="text-wal-emerald font-bold">{result.transferAgent.rule17Ad17Audit.status}</div>
                    <div className="text-[10px] text-slate-500">
                      Authority: {result.transferAgent.rule17Ad17Audit.statutoryAuthority} | Search verified
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Banner */}
              <div className="bg-gradient-to-r from-canvas-deck to-canvas-base border border-optic-cyan/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-slate-100 font-bold text-xs flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-wal-emerald" />
                    <span>Reconciliation Anchored Across Both Federal Systems</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans">
                    Dispatch Google Jules to write the Python ingestion script, execute backtests on branch <code className="text-optic-cyan">exp/cris-ta1-reconciliation</code>, and verify under Jev gates.
                  </p>
                </div>
                
                {dispatchedTask ? (
                  <div className="px-4 py-2 rounded-lg bg-wal-emerald/20 border border-wal-emerald text-wal-emerald font-bold text-xs flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>TASK CREATED: {dispatchedTask.id}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleDispatchToJules}
                    disabled={dispatching}
                    className="px-5 py-2.5 rounded-lg bg-wal-emerald text-canvas-deep font-bold hover:brightness-110 flex items-center space-x-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex-shrink-0"
                  >
                    {dispatching ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>DISPATCHING...</span>
                      </>
                    ) : (
                      <>
                        <span>DISPATCH TO JULES + JEV</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="h-10 border-t border-canvas-bezel px-6 flex items-center justify-between bg-canvas-deep text-[11px] text-slate-500 font-sans">
          <span>Sources: geocoding.geo.census.gov & sec.gov/edgar/searchedgar/transferagent</span>
          <span>FRE 902 Self-Authenticating Public Record Anchor</span>
        </div>

      </div>
    </div>
  );
}
