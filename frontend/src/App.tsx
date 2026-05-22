import React, { useState, useEffect } from 'react';
import { api, type User, type Project, type Task } from './api';
import GlassCard from './components/GlassCard';
import DashboardStats from './components/DashboardStats';
import TaskBoard from './components/TaskBoard';
import ProjectMembers from './components/ProjectMembers';
import ProjectSelector from './components/ProjectSelector';

export const App: React.FC = () => {
  // Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('ethara_token'));
  const [user, setUser] = useState<User | null>(null);
  const [authView, setAuthView] = useState<'LOGIN' | 'SIGNUP'>('LOGIN');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // App Workspace State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);


  // Modals & Task Editing State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>('');
  const [taskError, setTaskError] = useState('');
  const [taskLoading, setTaskLoading] = useState(false);

  // Load user data on startup if token exists
  useEffect(() => {
    if (token) {
      api.getMe()
        .then((res) => {
          setUser(res);
          loadProjects();
        })
        .catch(() => {
          handleLogout();
        });
    }
  }, [token]);

  // Load project details if active project changes
  const loadActiveProjectDetails = async (projectId: string) => {
    try {
      const details = await api.getProjectById(projectId);
      setActiveProject(details);
    } catch (err) {
      console.error('Failed to load project details', err);
    }
  };

  const loadProjects = async () => {
    try {
      const list = await api.getProjects();
      setProjects(list);
      
      // If there are projects and we want to select first, or if active project is null
      if (list.length > 0) {
        const idToSelect = activeProject?.id || list[0].id;
        await loadActiveProjectDetails(idToSelect);
      } else {
        setActiveProject(null);
      }
    } catch (err) {
      console.error('Failed to fetch projects list', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ethara_token');
    setToken(null);
    setUser(null);
    setProjects([]);
    setActiveProject(null);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      if (authView === 'LOGIN') {
        const res = await api.login({ email, password });
        localStorage.setItem('ethara_token', res.token);
        setToken(res.token);
      } else {
        const res = await api.signup({ name, email, password });
        localStorage.setItem('ethara_token', res.token);
        setToken(res.token);
      }
      // Reset forms
      setEmail('');
      setPassword('');
      setName('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // Select project
  const handleSelectProject = (projectId: string) => {
    loadActiveProjectDetails(projectId);
  };

  // Add Project helper
  const handleProjectCreated = (newProj: Project) => {
    setProjects((prev) => [newProj, ...prev]);
    loadActiveProjectDetails(newProj.id);
  };

  // Update task status from Kanban Board
  const handleUpdateTaskStatus = async (taskId: string, status: Task['status']) => {
    try {
      const updated = await api.updateTask(taskId, { status });
      if (activeProject) {
        setActiveProject({
          ...activeProject,
          tasks: activeProject.tasks.map((t) => (t.id === taskId ? updated : t)),
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };

  // Edit task trigger
  const handleEditTaskClick = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDesc(task.description || '');
    setTaskPriority(task.priority);
    // Format date to YYYY-MM-DD for date input
    const dateObj = new Date(task.dueDate);
    const dateStr = dateObj.toISOString().split('T')[0];
    setTaskDueDate(dateStr);
    setTaskAssigneeId(task.assignee?.id || '');
    setTaskError('');
    setShowTaskModal(true);
  };

  // Create task trigger
  const handleCreateTaskClick = () => {
    setEditingTask(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('MEDIUM');
    // Set default due date to 3 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 3);
    setTaskDueDate(defaultDate.toISOString().split('T')[0]);
    setTaskAssigneeId('');
    setTaskError('');
    setShowTaskModal(true);
  };

  // Task creation/update submission handler
  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !activeProject) return;

    setTaskLoading(true);
    setTaskError('');

    try {
      const payload = {
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        priority: taskPriority,
        dueDate: taskDueDate,
        assigneeId: taskAssigneeId || null,
      };

      if (editingTask) {
        // Update existing task
        const updated = await api.updateTask(editingTask.id, payload);
        setActiveProject({
          ...activeProject,
          tasks: activeProject.tasks.map((t) => (t.id === editingTask.id ? updated : t)),
        });
      } else {
        // Create new task
        const created = await api.createTask(activeProject.id, payload);
        setActiveProject({
          ...activeProject,
          tasks: [...activeProject.tasks, created],
        });
        
        // Update project list task count
        setProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, tasksCount: p.tasksCount + 1 } : p));
      }
      setShowTaskModal(false);
    } catch (err: any) {
      setTaskError(err.message || 'Operation failed');
    } finally {
      setTaskLoading(false);
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(taskId);
      if (activeProject) {
        setActiveProject({
          ...activeProject,
          tasks: activeProject.tasks.filter((t) => t.id !== taskId),
        });
        setProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, tasksCount: Math.max(0, p.tasksCount - 1) } : p));
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete task');
    }
  };

  // Members dynamic update callbacks
  const handleMemberAdded = (newMember: any) => {
    if (activeProject) {
      setActiveProject({
        ...activeProject,
        members: [...activeProject.members, newMember],
      });
    }
  };

  const handleMemberRemoved = (userId: string) => {
    if (activeProject) {
      setActiveProject({
        ...activeProject,
        members: activeProject.members.filter((m) => m.id !== userId),
      });
    }
  };

  // Render Loading state
  const isInitializing = token && !user;

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'hsl(var(--bg-dark))' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="logo-icon" style={{ width: '48px', height: '48px', margin: '0 auto 16px auto', fontSize: '24px' }}>E</div>
          <p style={{ color: 'hsl(var(--text-secondary))' }}>Verifying session...</p>
        </div>
      </div>
    );
  }

  // Render Authentication pages
  if (!user) {
    return (
      <div className="auth-page">
        <div className="glow-orb glow-orb-purple"></div>
        <div className="glow-orb glow-orb-cyan"></div>
        
        <GlassCard className="auth-card">
          <div className="auth-header">
            <div className="logo-icon" style={{ width: '48px', height: '48px', margin: '0 auto 16px auto', fontSize: '24px' }}>T</div>
            <h2>Task Manager</h2>
            <p>{authView === 'LOGIN' ? 'Access your workspace dashboard' : 'Create an account to start collaborating'}</p>
          </div>

          <form onSubmit={handleAuthSubmit}>
            {authError && <div className="alert alert-danger">{authError}</div>}

            {authView === 'SIGNUP' && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={authLoading}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={authLoading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={authLoading}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={authLoading}>
              {authLoading ? 'Verifying...' : authView === 'LOGIN' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="auth-redirect">
            {authView === 'LOGIN' ? (
              <>
                New to Task Manager? <span onClick={() => { setAuthView('SIGNUP'); setAuthError(''); }}>Create an account</span>
              </>
            ) : (
              <>
                Already have an account? <span onClick={() => { setAuthView('LOGIN'); setAuthError(''); }}>Sign in</span>
              </>
            )}
          </div>
        </GlassCard>
      </div>
    );
  }

  // Main Dashboard Workspace View
  return (
    <div className="app-container">
      <div className="glow-orb glow-orb-purple"></div>
      <div className="glow-orb glow-orb-cyan"></div>

      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon">T</div>
          <span className="logo-text">Task Manager</span>
        </div>

        {/* Project Selector Component */}
        <ProjectSelector
          projects={projects}
          activeProjectId={activeProject?.id || null}
          onSelectProject={handleSelectProject}
          onProjectCreated={handleProjectCreated}
        />

        <div className="sidebar-footer">
          <div className="user-profile-bar">
            <div className="avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <div className="user-name">{user.name}</div>
              <div className="user-email">{user.email}</div>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogout}>
            🚪 Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        {activeProject ? (
          <div className="animate-fade-in">
            {/* Header */}
            <div className="header-bar">
              <div className="header-title-group">
                <h1>{activeProject.name}</h1>
                <p>{activeProject.description || 'No project description provided'}</p>
              </div>

              {activeProject.userRole === 'ADMIN' && (
                <button className="btn btn-primary" onClick={handleCreateTaskClick}>
                  ＋ Create Task
                </button>
              )}
            </div>

            {/* Dashboard Stats */}
            <DashboardStats tasks={activeProject.tasks} />

            {/* Grid for Board and Team Members */}
            <div className="content-grid" style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h3 style={{ color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📋 Task Board
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 'normal',
                    padding: '2px 8px',
                    background: activeProject.userRole === 'ADMIN' ? 'hsla(var(--primary) / 0.15)' : 'rgba(255,255,255,0.05)',
                    color: activeProject.userRole === 'ADMIN' ? 'hsl(var(--primary))' : 'hsl(var(--text-secondary))',
                    border: '1px solid',
                    borderColor: activeProject.userRole === 'ADMIN' ? 'hsla(var(--primary) / 0.25)' : 'transparent',
                    borderRadius: '10px'
                  }}>
                    Role: {activeProject.userRole}
                  </span>
                </h3>
                <TaskBoard
                  tasks={activeProject.tasks}
                  userRole={activeProject.userRole}
                  onUpdateStatus={handleUpdateTaskStatus}
                  onEdit={handleEditTaskClick}
                  onDelete={handleDeleteTask}
                />
              </div>

              <div>
                <ProjectMembers
                  project={activeProject}
                  onMemberAdded={handleMemberAdded}
                  onMemberRemoved={handleMemberRemoved}
                />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <GlassCard className="empty-state animate-scale-in" style={{ maxWidth: '480px' }}>
              <div className="empty-icon">📁</div>
              <h2 style={{ color: 'white' }}>No Project Selected</h2>
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '14px' }}>
                Create a new project or select an existing one from the sidebar list to start managing your team and tracking tasks.
              </p>
            </GlassCard>
          </div>
        )}
      </main>

      {/* Task Creation & Edit Modal */}
      {showTaskModal && activeProject && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-in">
            <GlassCard>
              <div className="modal-header">
                <h3 className="modal-title">{editingTask ? 'Edit Task' : 'Create New Task'}</h3>
                <button className="btn-icon-only" onClick={() => setShowTaskModal(false)} style={{ border: 'none', background: 'none' }}>
                  ✕
                </button>
              </div>

              <form onSubmit={handleTaskSubmit}>
                {taskError && <div className="alert alert-danger">{taskError}</div>}

                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Task Title</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Design Login Page"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      required
                      disabled={taskLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description (Optional)</label>
                    <textarea
                      className="form-control"
                      placeholder="Enter task details..."
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      rows={3}
                      disabled={taskLoading}
                      style={{ resize: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Priority</label>
                      <select
                        className="form-control"
                        value={taskPriority}
                        onChange={(e) => setTaskPriority(e.target.value as any)}
                        disabled={taskLoading}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Due Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        required
                        disabled={taskLoading}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assignee (Optional)</label>
                    <select
                      className="form-control"
                      value={taskAssigneeId}
                      onChange={(e) => setTaskAssigneeId(e.target.value)}
                      disabled={taskLoading}
                    >
                      <option value="">Unassigned</option>
                      {activeProject.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} ({member.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)} disabled={taskLoading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={taskLoading || !taskTitle.trim()}>
                    {taskLoading ? 'Saving...' : editingTask ? 'Save Changes' : 'Create Task'}
                  </button>
                </div>
              </form>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
