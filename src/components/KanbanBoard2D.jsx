import React from 'react';
import {
  Layers,
  Activity,
  User,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Archive,
  RotateCcw,
  Trash2,
  Undo2
} from 'lucide-react';

const COLUMNS = [
  { id: 'BACKLOG', title: '01 // BACKLOG', color: 'border-optic-bright/30 text-optic-bright', tag: 'Ready to Plan' },
  { id: 'IN_PROGRESS', title: '02 // IN_PROGRESS', color: 'border-optic-cyan/40 text-optic-cyan', tag: 'Active Execution' },
  { id: 'REVIEW', title: '03 // REVIEW', color: 'border-drift-amber/40 text-drift-amber', tag: 'Gate & Verification' },
  { id: 'DONE', title: '04 // VERIFIED_DONE', color: 'border-wal-emerald/40 text-wal-emerald', tag: 'Landed' }
];

export default function KanbanBoard2D({
  tasks = [],
  projects = [],
  selectedTask,
  onSelectTask = () => {},
  onMoveTask = () => {},
  onArchiveTask = () => {},
  onDeleteTask = () => {},
  onClearFinished = () => {},
  showArchived = false,
  onToggleShowArchived = () => {},
  onResetDefaults = () => {}
}) {
  const visibleTasks = tasks.filter((t) => (showArchived ? !!t.archived : !t.archived));
  const activeCount = tasks.filter((t) => !t.archived).length;
  const archivedCount = tasks.filter((t) => !!t.archived).length;
  const finishedCount = tasks.filter((t) => !t.archived && t.column === 'DONE').length;

  return (
    <div className="w-full h-full p-4 bg-canvas-deep flex flex-col overflow-hidden">
      {/* Board Controls Toolbar */}
      <div className="flex items-center justify-between mb-3 px-1 text-xs font-mono flex-shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 text-[11px]">FILTER:</span>
          <button
            onClick={() => onToggleShowArchived(false)}
            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
              !showArchived
                ? 'bg-optic-cyan/20 text-optic-cyan border border-optic-cyan/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            Active Pipeline ({activeCount})
          </button>
          <button
            onClick={() => onToggleShowArchived(true)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
              showArchived
                ? 'bg-drift-amber/20 text-drift-amber border border-drift-amber/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Archive className="w-3 h-3" />
            <span>Archive ({archivedCount})</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {finishedCount > 0 && !showArchived && (
            <button
              onClick={onClearFinished}
              className="flex items-center space-x-1.5 px-3 py-1 rounded bg-wal-emerald/15 hover:bg-wal-emerald/25 text-wal-emerald border border-wal-emerald/40 text-[11px] font-bold transition-colors"
              title="Archive finished tasks off the board"
            >
              <Archive className="w-3 h-3" />
              <span>Clear Done ({finishedCount})</span>
            </button>
          )}

          <button
            onClick={onResetDefaults}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-canvas-deck hover:bg-canvas-bezel text-slate-400 hover:text-slate-200 border border-canvas-bezel text-[11px] transition-colors"
            title="Reset board to live production tasks (clears old local stubs)"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Demo Tasks</span>
          </button>
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="flex-1 overflow-x-auto">
        <div className="grid grid-cols-4 gap-4 h-full min-w-[960px]">
          {COLUMNS.map((col) => {
            const columnTasks = visibleTasks.filter((t) => {
              const taskCol = t.column || (t.lane === 'READY' ? 'BACKLOG' : 'BACKLOG');
              return taskCol === col.id;
            });

            return (
              <div
                key={col.id}
                className="flex flex-col bg-canvas-base/90 border border-canvas-bezel rounded-lg p-3 h-full shadow-sm"
              >
                {/* Column Header */}
                <div className={`flex items-center justify-between pb-2 mb-3 border-b ${col.color}`}>
                  <div>
                    <h3 className="font-mono text-xs font-bold tracking-wider">{col.title}</h3>
                    <span className="text-[10px] text-slate-400 font-sans block">{col.tag}</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {col.id === 'DONE' && columnTasks.length > 0 && !showArchived && (
                      <button
                        onClick={onClearFinished}
                        className="p-1 rounded bg-wal-emerald/15 hover:bg-wal-emerald/30 text-wal-emerald border border-wal-emerald/40 text-[10px] transition-colors"
                        title="Archive verified done tasks"
                      >
                        <Archive className="w-3 h-3" />
                      </button>
                    )}
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-canvas-deck border border-current opacity-90 font-bold">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                {/* Column Task Cards */}
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {columnTasks.length === 0 ? (
                    <div className="p-4 rounded-md border border-dashed border-canvas-bezel/50 text-center text-slate-500 font-mono text-[11px] my-4">
                      {showArchived ? 'No archived tasks' : 'Empty Lane'}
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const project =
                        projects?.find((p) => p.id === task.projectId) || {
                          name: task.project || 'Discovery Lab',
                          color: '#00E5FF'
                        };
                      const isSelected = selectedTask?.id === task.id;
                      const progress = Number(task.progress) || 0;
                      const assignee = task.assignee || 'Jules + Jev';
                      const patronageColor = project?.color || '#00E5FF';

                      return (
                        <div
                          key={task.id}
                          onClick={() => onSelectTask(task)}
                          className={`group relative p-3 rounded-md transition-all duration-200 cursor-pointer border ${
                            isSelected
                              ? 'bg-canvas-panel border-optic-cyan shadow-[0_0_15px_rgba(0,229,255,0.2)]'
                              : 'bg-canvas-deck hover:bg-canvas-bezel border-canvas-bezel hover:border-optic-bright/40'
                          }`}
                        >
                          {/* Left Accent Bar */}
                          <div
                            className="absolute left-0 top-2 bottom-2 w-1 rounded-r"
                            style={{ backgroundColor: patronageColor }}
                          />

                          {/* Card Top Row: ID, Progress & Archive Action */}
                          <div className="flex items-center justify-between pl-2 mb-1.5 text-xs font-mono">
                            <span className="text-optic-bright font-semibold">{task.id}</span>
                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`text-[11px] font-bold ${
                                  progress === 100 ? 'text-wal-emerald' : 'text-drift-amber'
                                }`}
                              >
                                {progress}%
                              </span>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onArchiveTask(task.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-drift-amber hover:bg-canvas-bezel rounded transition-opacity"
                                title={task.archived ? 'Restore to active board' : 'Archive off board'}
                              >
                                {task.archived ? (
                                  <Undo2 className="w-3 h-3 text-optic-cyan" />
                                ) : (
                                  <Archive className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Task Title */}
                          <h4 className="pl-2 text-sm font-sans font-medium text-slate-100 group-hover:text-optic-cyan transition-colors line-clamp-2 leading-snug">
                            {task.title || 'Untitled Task'}
                          </h4>

                          {/* Progress Mini Bar */}
                          <div className="pl-2 mt-2 w-full">
                            <div className="w-full h-1 bg-canvas-bezel rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.min(100, Math.max(0, progress))}%`,
                                  backgroundColor: progress === 100 ? '#00FF88' : patronageColor
                                }}
                              />
                            </div>
                          </div>

                          {/* Patronage Tag & Assignee */}
                          <div className="pl-2 mt-2.5 pt-2 border-t border-canvas-bezel/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
                            <span className="flex items-center space-x-1 truncate max-w-[120px]">
                              <User className="w-3 h-3 text-optic-bright flex-shrink-0" />
                              <span className="text-slate-300 truncate">{assignee}</span>
                            </span>

                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight truncate max-w-[110px]"
                              style={{
                                backgroundColor: `${patronageColor}20`,
                                color: patronageColor,
                                border: `1px solid ${patronageColor}50`,
                              }}
                            >
                              {project?.name || 'PATRON'}
                            </span>
                          </div>

                          {/* Quick Move Trigger Buttons on Hover */}
                          <div className="mt-2 pl-2 hidden group-hover:flex items-center justify-between pt-1.5 border-t border-canvas-bezel/40 text-[10px] font-mono">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTask(task.id);
                              }}
                              className="flex items-center space-x-1 text-slate-500 hover:text-red-400 px-1 py-0.5 rounded transition-colors"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              <span>Del</span>
                            </button>

                            <div className="flex items-center space-x-1">
                              {col.id !== 'BACKLOG' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const prevCol =
                                      col.id === 'IN_PROGRESS'
                                        ? 'BACKLOG'
                                        : col.id === 'REVIEW'
                                        ? 'IN_PROGRESS'
                                        : 'REVIEW';
                                    onMoveTask(task.id, prevCol);
                                  }}
                                  className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-canvas-bezel hover:bg-canvas-panel text-slate-300 hover:text-white"
                                >
                                  <ArrowLeft className="w-2.5 h-2.5" />
                                  <span>Back</span>
                                </button>
                              )}
                              {col.id !== 'DONE' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextCol =
                                      col.id === 'BACKLOG'
                                        ? 'IN_PROGRESS'
                                        : col.id === 'IN_PROGRESS'
                                        ? 'REVIEW'
                                        : 'DONE';
                                    onMoveTask(task.id, nextCol);
                                  }}
                                  className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-optic-cyan/15 hover:bg-optic-cyan/30 text-optic-cyan border border-optic-cyan/40"
                                >
                                  <span>Advance</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
