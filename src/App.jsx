import React, { useState } from 'react';
import {
  INITIAL_PROJECTS,
  INITIAL_LM_MODELS,
  INITIAL_TASKS,
  INITIAL_CHECKPOINTS
} from './data/initialData';

import KanbanCanvas3D from './components/KanbanCanvas3D';
import KanbanBoard2D from './components/KanbanBoard2D';
import OrchestrationHub from './components/OrchestrationHub';
import SpecTelemetryDrawer from './components/SpecTelemetryDrawer';
import LmSelectorModal from './components/LmSelectorModal';
import ChatDrawer from './components/ChatDrawer';
import SketchCanvasModal from './components/SketchCanvasModal';
import ResearchBrowserModal from './components/ResearchBrowserModal';
import DiscoveryGraphModal from './components/DiscoveryGraphModal';

import {
  Layers,
  Cpu,
  PenTool,
  Globe,
  MessageSquare,
  Sliders,
  Play,
  Pause,
  Box,
  LayoutGrid,
  Shield,
  Activity,
  Network
} from 'lucide-react';

export default function App() {
  // Application State
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [projects] = useState(INITIAL_PROJECTS);
  const [models] = useState(INITIAL_LM_MODELS);
  const [checkpoints, setCheckpoints] = useState(INITIAL_CHECKPOINTS);
  
  const [selectedTask, setSelectedTask] = useState(INITIAL_TASKS[1]); // Default selected task
  const [activeModel, setActiveModel] = useState(INITIAL_LM_MODELS[0]);
  const [isExecuting, setIsExecuting] = useState(true);
  const [viewMode, setViewMode] = useState('3D'); // '3D' | '2D'

  // Modal / Drawer Toggles
  const [isLmModalOpen, setIsLmModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSketchOpen, setIsSketchOpen] = useState(false);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState({});

  // Handlers
  const handleSelectTask = (task) => {
    setSelectedTask(task);
  };

  const handleDispatchDiscoveryTask = (task) => {
    setTasks((prev) => [task, ...prev]);
    setSelectedTask(task);
    setViewMode('2D');
  };

  const handleUpdateTaskProgress = (taskId, newProgress) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, progress: newProgress } : t))
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => ({ ...prev, progress: newProgress }));
    }
  };

  // Moving a tile, by hand or by a gate, clears any "needs you" flag on it.
  const handleMoveTask = (taskId, newColumn) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, column: newColumn, needsYou: null } : t))
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => ({ ...prev, column: newColumn, needsYou: null }));
    }
  };

  // Gates write their verdicts (and any "needs you" flag) onto the tile.
  const handlePatchTask = (taskId, patch) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
    setSelectedTask((prev) => (prev?.id === taskId ? { ...prev, ...patch } : prev));
  };

  const handleAddTask = (newTask) => {
    setTasks((prev) => [newTask, ...prev]);
    setSelectedTask(newTask);
  };

  const handleToggleCheckpoint = (chkId) => {
    setCheckpoints((prev) =>
      prev.map((c) => (c.id === chkId ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleSaveApiKey = (provider, key) => {
    setApiKeys((prev) => ({ ...prev, [provider]: key }));
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-canvas-deep text-slate-100 font-sans overflow-hidden">
      {/* Top Dock Navigation & Vitals Deck */}
      <header className="h-12 bg-canvas-base border-b border-canvas-bezel px-4 flex items-center justify-between font-mono text-xs z-20">
        {/* Brand & Swarm Status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-optic-cyan shadow-[0_0_8px_#00E5FF]"></div>
            <span className="font-bold text-sm tracking-wider text-slate-100">
              JULES + JEV.AI HARNESS COCKPIT
            </span>
          </div>

          <span className="text-slate-600">|</span>

          <div className="flex items-center space-x-2 text-slate-300">
            <span className="text-slate-500">ACTIVE LM:</span>
            <button
              onClick={() => setIsLmModalOpen(true)}
              className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-canvas-deck border border-optic-cyan/40 text-optic-cyan font-bold hover:bg-canvas-bezel transition-colors"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{activeModel.name}</span>
            </button>
          </div>
        </div>

        {/* Global Toolbar & View Swapper */}
        <div className="flex items-center space-x-3">
          {/* View Toggle (3D WebGL vs 2D Board) */}
          <div className="flex bg-canvas-deck p-0.5 rounded border border-canvas-bezel">
            <button
              onClick={() => setViewMode('3D')}
              className={`px-2.5 py-1 rounded flex items-center space-x-1.5 font-bold transition-all ${
                viewMode === '3D'
                  ? 'bg-optic-cyan text-canvas-deep shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D WEBGL</span>
            </button>
            <button
              onClick={() => setViewMode('2D')}
              className={`px-2.5 py-1 rounded flex items-center space-x-1.5 font-bold transition-all ${
                viewMode === '2D'
                  ? 'bg-optic-cyan text-canvas-deep shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>2D BOARD</span>
            </button>
          </div>

          <span className="text-slate-600">|</span>

          {/* UX Touchpoints Triggers */}
          <button
            onClick={() => setIsSketchOpen(true)}
            className="p-1.5 rounded bg-canvas-deck border border-canvas-bezel hover:border-optic-cyan text-slate-300 hover:text-optic-cyan transition-colors"
            title="Open Architecture Sketch Canvas"
          >
            <PenTool className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsBrowserOpen(true)}
            className="p-1.5 rounded bg-canvas-deck border border-canvas-bezel hover:border-optic-cyan text-slate-300 hover:text-optic-cyan transition-colors"
            title="Open Research Browser"
          >
            <Globe className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsLmModalOpen(true)}
            className="p-1.5 rounded bg-canvas-deck border border-canvas-bezel hover:border-optic-cyan text-slate-300 hover:text-optic-cyan transition-colors"
            title="Configure Models & Checkpoints"
          >
            <Sliders className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsDiscoveryOpen(true)}
            className="px-2.5 py-1 rounded bg-canvas-deck border border-canvas-bezel hover:border-optic-cyan text-slate-300 hover:text-optic-cyan flex items-center space-x-1.5 font-bold transition-all"
            title="Open BigQuery Graph Discovery Engine"
          >
            <Network className="w-3.5 h-3.5 text-optic-cyan" />
            <span>DISCOVERY GRAPH</span>
          </button>

          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`px-2.5 py-1 rounded flex items-center space-x-1.5 font-bold border transition-all ${
              isChatOpen
                ? 'bg-wal-emerald/20 text-wal-emerald border-wal-emerald'
                : 'bg-canvas-deck text-slate-300 border-canvas-bezel hover:border-optic-cyan'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>CHAT COCKPIT</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Center Work Area: Canvas + Orchestration Dock */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Main Visual Kanban Canvas (3D or 2D) */}
          <div className="flex-1 relative">
            {viewMode === '3D' ? (
              <KanbanCanvas3D
                tasks={tasks}
                projects={projects}
                selectedTask={selectedTask}
                onSelectTask={handleSelectTask}
              />
            ) : (
              <KanbanBoard2D
                tasks={tasks}
                projects={projects}
                selectedTask={selectedTask}
                onSelectTask={handleSelectTask}
                onMoveTask={handleMoveTask}
              />
            )}
          </div>

          {/* Bottom Dock: Traffic Controller & Swarm Orchestrator */}
          <div className="p-3 bg-canvas-base border-t border-canvas-bezel z-10">
            <OrchestrationHub
              tasks={tasks}
              projects={projects}
              selectedTask={selectedTask}
              activeModel={activeModel}
              onUpdateTaskProgress={handleUpdateTaskProgress}
              onMoveTask={handleMoveTask}
              onAddTask={handleAddTask}
              onPatchTask={handlePatchTask}
              isExecuting={isExecuting}
              setIsExecuting={setIsExecuting}
            />
          </div>
        </div>

        {/* Right Rail: High-Density Telemetry Spec Drawer */}
        <SpecTelemetryDrawer
          task={selectedTask}
          project={projects.find((p) => p.id === selectedTask?.projectId)}
          activeModel={activeModel}
          onClose={() => setSelectedTask(null)}
          onUpdateProgress={handleUpdateTaskProgress}
          onMoveTask={handleMoveTask}
          onPatchTask={handlePatchTask}
        />
      </div>

      {/* Modals & Floating UX Elements */}
      <LmSelectorModal
        isOpen={isLmModalOpen}
        onClose={() => setIsLmModalOpen(false)}
        models={models}
        activeModel={activeModel}
        onSelectModel={(m) => {
          setActiveModel(m);
          setIsLmModalOpen(false);
        }}
        checkpoints={checkpoints}
        onToggleCheckpoint={handleToggleCheckpoint}
        apiKeys={apiKeys}
        onSaveApiKey={handleSaveApiKey}
      />

      <SketchCanvasModal
        isOpen={isSketchOpen}
        onClose={() => setIsSketchOpen(false)}
      />

      <ResearchBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
      />

      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        activeModel={activeModel}
      />

      <DiscoveryGraphModal
        isOpen={isDiscoveryOpen}
        onClose={() => setIsDiscoveryOpen(false)}
        onDispatchTask={handleDispatchDiscoveryTask}
      />
    </div>
  );
}
