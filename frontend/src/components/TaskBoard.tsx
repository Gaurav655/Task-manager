import React from 'react';
import type { Task } from '../api';

interface TaskBoardProps {
  tasks: Task[];
  userRole: 'ADMIN' | 'MEMBER';
  onUpdateStatus: (taskId: string, newStatus: Task['status']) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

const COLUMNS: { id: Task['status']; title: string; class: string }[] = [
  { id: 'TODO', title: 'To Do', class: 'todo-col' },
  { id: 'IN_PROGRESS', title: 'In Progress', class: 'progress-col' },
  { id: 'REVIEW', title: 'In Review', class: 'review-col' },
  { id: 'DONE', title: 'Completed', class: 'done-col' },
];

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  userRole,
  onUpdateStatus,
  onEdit,
  onDelete,
}) => {
  const getPrevStatus = (current: Task['status']): Task['status'] => {
    const list: Task['status'][] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    const idx = list.indexOf(current);
    return idx > 0 ? list[idx - 1] : current;
  };

  const getNextStatus = (current: Task['status']): Task['status'] => {
    const list: Task['status'][] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    const idx = list.indexOf(current);
    return idx < list.length - 1 ? list[idx + 1] : current;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isOverdue = (dateStr: string, status: Task['status']) => {
    if (status === 'DONE') return false;
    return new Date(dateStr) < new Date();
  };

  return (
    <div className="board-container animate-fade-in">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.id);

        return (
          <div key={col.id} className={`board-column ${col.class}`}>
            <div className="column-header">
              <span className="column-title">
                <span className="column-indicator"></span>
                {col.title}
              </span>
              <span className="column-count">{columnTasks.length}</span>
            </div>

            <div className="task-list">
              {columnTasks.length === 0 ? (
                <div style={{
                  padding: '24px 16px',
                  color: 'hsl(var(--text-muted))',
                  textAlign: 'center',
                  fontSize: '12px',
                  border: '1px dashed rgba(255,255,255,0.03)',
                  borderRadius: '8px'
                }}>
                  No tasks
                </div>
              ) : (
                columnTasks.map((task) => {
                  const overdue = isOverdue(task.dueDate, task.status);

                  return (
                    <div key={task.id} className="task-card animate-scale-in">
                      <div className="task-card-header">
                        <span className={`priority-badge ${task.priority.toLowerCase()}`}>
                          {task.priority}
                        </span>
                        
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {userRole === 'ADMIN' && (
                            <>
                              <button
                                className="btn-icon-only"
                                title="Edit Task"
                                onClick={() => onEdit(task)}
                                style={{ padding: 0 }}
                              >
                                ✏️
                              </button>
                              <button
                                className="btn-icon-only"
                                title="Delete Task"
                                onClick={() => onDelete(task.id)}
                                style={{ padding: 0, color: 'hsl(var(--danger))' }}
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <h4 className="task-title">{task.title}</h4>
                      {task.description && <p className="task-desc">{task.description}</p>}

                      <div className="task-card-footer">
                        <span className={`task-due ${overdue ? 'overdue' : ''}`}>
                          📅 {overdue ? 'Overdue: ' : ''}{formatDate(task.dueDate)}
                        </span>

                        {task.assignee ? (
                          <div className="task-assignee-badge" title={`Assigned to ${task.assignee.name}`}>
                            <div className="task-assignee-avatar">
                              {task.assignee.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="task-assignee-name">{task.assignee.name}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'hsl(var(--text-muted))' }}>Unassigned</span>
                        )}
                      </div>

                      {/* Shift buttons at the very bottom */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '12px',
                        paddingTop: '8px',
                        borderTop: '1px solid rgba(255,255,255,0.03)'
                      }}>
                        {task.status !== 'TODO' ? (
                          <button
                            className="btn-icon-only btn-sm"
                            title="Move back"
                            onClick={() => onUpdateStatus(task.id, getPrevStatus(task.status))}
                            style={{ padding: '2px 8px', fontSize: '10px' }}
                          >
                            ◀ Back
                          </button>
                        ) : <div />}

                        {task.status !== 'DONE' ? (
                          <button
                            className="btn-icon-only btn-sm"
                            title="Move forward"
                            onClick={() => onUpdateStatus(task.id, getNextStatus(task.status))}
                            style={{ padding: '2px 8px', fontSize: '10px', color: 'hsl(var(--secondary))' }}
                          >
                            Next ▶
                          </button>
                        ) : <div />}
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
  );
};

export default TaskBoard;
