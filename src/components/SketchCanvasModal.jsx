import React, { useState, useRef } from 'react';
import { PenTool, Box, Eraser, Download, X, Layers, RefreshCw } from 'lucide-react';

export default function SketchCanvasModal({ isOpen, onClose }) {
  const [sketchMode, setSketchMode] = useState('2D_DIAGRAM'); // 2D_DIAGRAM | 3D_NODES
  const [nodes, setNodes] = useState([
    { id: 1, label: 'Jev.ai Router', x: 120, y: 150, color: '#00FF88' },
    { id: 2, label: 'Jules Execution Harness', x: 380, y: 150, color: '#00E5FF' },
    { id: 3, label: 'WebGL 3D Kanban Canvas', x: 250, y: 320, color: '#FFB020' },
  ]);

  const [activeTool, setActiveTool] = useState('SELECT');

  if (!isOpen) return null;

  const handleAddNode = () => {
    const newNode = {
      id: Date.now(),
      label: `Node Cluster #${nodes.length + 1}`,
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 200,
      color: '#00E5FF'
    };
    setNodes([...nodes, newNode]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-canvas-deep/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl h-[80vh] bg-canvas-deck border border-optic-cyan/30 rounded-xl shadow-[0_0_35px_rgba(0,229,255,0.15)] overflow-hidden font-mono flex flex-col">
        {/* Header */}
        <div className="p-3.5 bg-canvas-bezel border-b border-canvas-bezel flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PenTool className="w-5 h-5 text-optic-cyan" />
            <span className="font-bold text-sm text-slate-100">
              SYSTEM ARCHITECTURE SKETCHING & DIAGRAM CANVAS
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSketchMode(sketchMode === '2D_DIAGRAM' ? '3D_NODES' : '2D_DIAGRAM')}
              className="px-3 py-1 rounded bg-canvas-panel border border-optic-bright/30 text-optic-bright text-xs font-bold hover:bg-canvas-bezel"
            >
              MODE: {sketchMode}
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-2 bg-canvas-base border-b border-canvas-bezel flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleAddNode}
              className="px-3 py-1 bg-optic-cyan text-canvas-deep font-bold rounded hover:bg-optic-bright transition-colors flex items-center space-x-1"
            >
              <Box className="w-3.5 h-3.5" />
              <span>+ ADD NODE</span>
            </button>
            <button
              onClick={() => setNodes([])}
              className="px-3 py-1 bg-canvas-bezel text-slate-300 rounded hover:text-white flex items-center space-x-1"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>CLEAR</span>
            </button>
          </div>

          <span className="text-slate-400 text-[11px]">
            Interactive system topology layout tool for brainstorming architecture with Jev.ai & Jules
          </span>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 bg-canvas-deep relative overflow-hidden p-4">
          {/* Grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(#161F2E_1px,transparent_1px)] [background-size:16px_16px] opacity-60"></div>

          {/* SVG Connection Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line x1={nodes[0]?.x + 80} y1={nodes[0]?.y + 25} x2={nodes[1]?.x + 80} y2={nodes[1]?.y + 25} stroke="#00E5FF" strokeWidth="2" strokeDasharray="4" />
            <line x1={nodes[0]?.x + 80} y1={nodes[0]?.y + 25} x2={nodes[2]?.x + 80} y2={nodes[2]?.y + 25} stroke="#00FF88" strokeWidth="2" />
            <line x1={nodes[1]?.x + 80} y1={nodes[1]?.y + 25} x2={nodes[2]?.x + 80} y2={nodes[2]?.y + 25} stroke="#FFB020" strokeWidth="2" />
          </svg>

          {/* Draggable/Interactive Nodes */}
          {nodes.map((node) => (
            <div
              key={node.id}
              style={{ left: node.x, top: node.y }}
              className="absolute p-3 rounded-lg bg-canvas-panel border border-canvas-bezel hover:border-optic-cyan shadow-lg cursor-move flex flex-col space-y-1 w-44"
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-slate-400">NODE ID #{node.id.toString().slice(-4)}</span>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: node.color }}></span>
              </div>
              <span className="text-xs font-bold text-slate-100">{node.label}</span>
              <div className="pt-1 text-[9px] text-slate-400 border-t border-canvas-bezel flex justify-between">
                <span>IN: 24 TPS</span>
                <span>OUT: 18 TPS</span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 bg-canvas-base border-t border-canvas-bezel flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-optic-cyan text-canvas-deep font-bold rounded hover:bg-optic-bright text-xs"
          >
            SAVE TOPOLOGY TO HARNESS
          </button>
        </div>
      </div>
    </div>
  );
}
