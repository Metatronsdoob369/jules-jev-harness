import React, { useState } from 'react';
import { Globe, Search, RefreshCw, X, ExternalLink, ShieldCheck } from 'lucide-react';

export default function ResearchBrowserModal({ isOpen, onClose }) {
  const [url, setUrl] = useState('https://docs.jev.ai/orchestration-spec');
  const [query, setQuery] = useState('Three.js InstancedMesh performance benchmarks');
  const [results, setResults] = useState([
    {
      title: 'Three.js InstancedMesh Matrix Buffer Optimization Guide',
      url: 'https://threejs.org/docs/#api/en/objects/InstancedMesh',
      snippet: 'InstancedMesh allows rendering thousands of similar 3D objects with a single draw call, drastically reducing CPU overhead in complex WebGL scenes.'
    },
    {
      title: 'Jev.ai Traffic Control & DAG Task Routing Patterns',
      url: 'https://docs.jev.ai/routing-topology',
      snippet: 'Sub-agent Jev routes task dependencies using non-blocking asynchronous event emitters, allowing Jules to stream code generation.'
    },
    {
      title: 'Tailwind CSS Industrial Dark Mode Telemetry UI Design System',
      url: 'https://tailwindcss.com/docs/custom-colors',
      snippet: 'Establishing high-density dark mode interfaces with Space Grotesk typography and optic cyan laser accents.'
    }
  ]);

  if (!isOpen) return null;

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const newResult = {
      title: `Search Query Results: ${query}`,
      url: `https://search.internal/query?q=${encodeURIComponent(query)}`,
      snippet: `Extracted live Web research parameters for "${query}" to assist Jules & Jev.ai during brainstorming.`
    };
    setResults([newResult, ...results]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-canvas-deep/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[80vh] bg-canvas-deck border border-optic-cyan/30 rounded-xl shadow-[0_0_35px_rgba(0,229,255,0.15)] overflow-hidden font-mono flex flex-col">
        {/* Header Bar */}
        <div className="p-3 bg-canvas-bezel border-b border-canvas-bezel flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-optic-cyan" />
            <span className="font-bold text-sm text-slate-100">
              INTEGRATED RESEARCH BROWSER & BRAINSTORMING TOOL
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Address & Search Bar */}
        <form onSubmit={handleSearch} className="p-2.5 bg-canvas-base border-b border-canvas-bezel flex items-center space-x-2">
          <div className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-slate-500 absolute left-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Web, documentation, or technical benchmarks..."
              className="w-full bg-canvas-bezel border border-canvas-bezel focus:border-optic-cyan rounded pl-9 pr-3 py-1.5 text-xs text-slate-200 outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-1.5 bg-optic-cyan text-canvas-deep font-bold rounded hover:bg-optic-bright transition-colors text-xs"
          >
            RESEARCH
          </button>
        </form>

        {/* Content Area */}
        <div className="flex-1 bg-canvas-deep overflow-y-auto p-5 space-y-4">
          <div className="p-3 rounded bg-canvas-bezel/50 border border-optic-cyan/20 flex items-center justify-between text-xs text-optic-bright">
            <span className="flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-wal-emerald" />
              <span>LIVE HARNESS SEARCH ACTIVE: Querying context for Jev.ai & Jules</span>
            </span>
            <span className="text-slate-400">3 Results</span>
          </div>

          <div className="space-y-3">
            {results.map((res, i) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-canvas-base border border-canvas-bezel hover:border-optic-bright/40 transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-optic-cyan hover:underline cursor-pointer flex items-center space-x-1.5">
                    <span>{res.title}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </h4>
                </div>
                <div className="text-[11px] text-wal-emerald font-mono">{res.url}</div>
                <p className="text-xs text-slate-300 leading-relaxed">{res.snippet}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-canvas-base border-t border-canvas-bezel flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-canvas-bezel text-slate-300 rounded hover:text-white text-xs"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
