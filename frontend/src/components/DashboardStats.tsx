import React from 'react';
import type { Task } from '../api';
import GlassCard from './GlassCard';

interface DashboardStatsProps {
  tasks: Task[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ tasks }) => {
  const totalTasks = tasks.length;
  
  const completedTasks = tasks.filter(t => t.status === 'DONE').length;
  
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'REVIEW').length;
  
  const now = new Date();
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'DONE') return false;
    const dueDate = new Date(t.dueDate);
    return dueDate < now;
  }).length;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="animate-fade-in">
      <div className="stats-grid">
        <GlassCard className="stat-card total">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <span className="stat-value">{totalTasks}</span>
            <span className="stat-label">Total Tasks</span>
          </div>
        </GlassCard>

        <GlassCard className="stat-card progress">
          <div className="stat-icon">⚡</div>
          <div className="stat-info">
            <span className="stat-value">{inProgressTasks}</span>
            <span className="stat-label">Active Tasks</span>
          </div>
        </GlassCard>

        <GlassCard className="stat-card completed">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <span className="stat-value">{completedTasks}</span>
            <span className="stat-label">Completed ({completionRate}%)</span>
          </div>
        </GlassCard>

        <GlassCard className="stat-card overdue">
          <div className="stat-icon">🚨</div>
          <div className="stat-info">
            <span className="stat-value">{overdueTasks}</span>
            <span className="stat-label">Overdue Tasks</span>
          </div>
        </GlassCard>
      </div>

      {/* Overdue Tasks Alert Section */}
      {overdueTasks > 0 && (
        <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚠️</span>
          <span>
            <strong>Attention Needed:</strong> You have {overdueTasks} task{overdueTasks > 1 ? 's' : ''} overdue. Check the board to review and update their schedule.
          </span>
        </div>
      )}
    </div>
  );
};

export default DashboardStats;
