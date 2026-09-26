import React from 'react';
import { Layers, Activity, User, CheckCircle2, Clock, Cpu, ExternalLink } from 'lucide-react';

const COLUMNS = [
  { id: 'BACKLOG', title: '01 // BACKLOG', color: 'border-optic-bright/30 text-optic-bright' },
  { id: 'IN_PROGRESS', title: '02 // IN_PROGRESS', color: 'border-optic-cyan/40 text-optic-cyan' },
  { id: 'REVIEW', title: '03 // REVIEW', color: 'border-drift-amber/40 text-drift-amber' },
  { id: 'DONE', title: '04 // VERIFIED_DONE', color: 'border-wal-emerald/40 text-wal-emerald' }
];

export default function KanbanBoard2D({ tasks, projects, selectedTask, onSelectTask, onMoveTask }) {
  return (
    <div className="w-full h-full p-4 grid grid-cols-4 gap-4 overflow-x-auto bg-canvas-deep">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.column === col.id);

        return (
          <div key={col.id} className="flex flex-col bg-canvas-base/80 border border-canvas-bezel rounded-lg p-3 min-w-[280px]">
            {/* Column Header */}
            <div className={`flex items-center justify-between pb-2 mb-3 border-b ${col.color}`}>
              <h3 className="font-mono text-xs font-bold tracking-wider">{col.title}</h3>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-canvas-deck border border-current opacity-80">
                {columnTasks.length}
              </span>
            </div>

            {/* Column Task Cards */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {columnTasks.map((task) => {
                const project = projects.find((p) => p.id === task.projectId);
                const isSelected = selectedTask?.id === task.id;

                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className={`group relative p-3 rounded-md transition-all duration-200 cursor-pointer border ${
                      isSelected
                        ? 'bg-canvas-panel border-optic-cyan shadow-[0_0_15px_rgba(0,229,255,0.15)]'
                        : 'bg-canvas-deck hover:bg-canvas-bezel border-canvas-bezel hover:border-optic-bright/40'
                    }`}
                  >
                    {/* Left Accent Bar */}
                    <div
                      className="absolute left-0 top-2 bottom-2 w-1 rounded-r"
                      style={{ backgroundColor: project?.color || '#00E5FF' }}
                    />

                    {/* Card Top Row: ID & Progress */}
                    <div className="flex items-center justify-between pl-2 mb-1.5 text-xs font-mono">
                      <span className="text-optic-bright/90 font-medium">{task.id}</span>
                      <span
                        className={`text-[11px] font-semibold ${
                          task.progress === 100 ? 'text-wal-emerald' : 'text-drift-amber'
                        }`}
                      >
                        {task.progress}%
                      </span>
                    </div>

                    {/* Task Title */}
                    <h4 className="pl-2 text-sm font-sans font-medium text-slate-100 group-hover:text-optic-cyan transition-colors line-clamp-2 leading-snug">
                      {task.title}
                    </h4>

                    {/* Patronage Tag & Assignee */}
                    <div className="pl-2 mt-2.5 pt-2 border-t border-canvas-bezel/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span className="flex items-center space-x-1">
                        <User className="w-3 h-3 text-optic-bright" />
                        <span className="text-slate-300">{task.assignee}</span>
                      </span>

                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight truncate max-w-[110px]"
                        style={{
                          backgroundColor: `${project?.color || '#00E5FF'}15`,
                          color: project?.color || '#00E5FF',
                          border: `1px solid ${project?.color || '#00E5FF'}40`,
                        }}
                      >
                        {project?.name || 'PATRON'}
                      </span>
                    </div>

                    {/* Quick Move Trigger Buttons on Hover */}
                    <div className="mt-2 pl-2 hidden group-hover:flex items-center justify-end space-x-1 pt-1.5 border-t border-canvas-bezel/40 text-[10px] font-mono">
                      {col.id !== 'BACKLOG' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const prevCol =
                              col.id === 'IN_PROGRESS' ? 'BACKLOG' : col.id === 'REVIEW' ? 'IN_PROGRESS' : 'REVIEW';
                            onMoveTask(task.id, prevCol);
                          }}
                          className="px-1.5 py-0.5 rounded bg-canvas-bezel hover:bg-canvas-panel text-slate-300 hover:text-white"
                        >
                          &lt; MOVE
                        </button>
                      )}
                      {col.id !== 'DONE' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextCol =
                              col.id === 'BACKLOG' ? 'IN_PROGRESS' : col.id === 'IN_PROGRESS' ? 'REVIEW' : 'DONE';
                            onMoveTask(task.id, nextCol);
                          }}
                          className="px-1.5 py-0.5 rounded bg-optic-cyan/10 hover:bg-optic-cyan/20 text-optic-cyan"
                        >
                          MOVE &gt;
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
