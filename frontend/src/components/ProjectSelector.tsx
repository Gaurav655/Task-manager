import React, { useState } from 'react';
import { api, type Project } from '../api';
import GlassCard from './GlassCard';

interface ProjectSelectorProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onProjectCreated: (newProject: Project) => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onProjectCreated,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const newProj = await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      // Format project output to match lists format
      const formattedProj: Project = {
        ...newProj,
        userRole: 'ADMIN',
        tasksCount: 0,
        members: [],
        tasks: [],
      };
      onProjectCreated(formattedProj);
      setName('');
      setDescription('');
      setShowModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px 0', padding: '0 12px' }}>
        <span className="sidebar-heading" style={{ margin: 0, padding: 0 }}>Projects</span>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'hsl(var(--secondary))',
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 'bold',
            padding: '4px',
            lineHeight: 1
          }}
          title="New Project"
        >
          ＋
        </button>
      </div>

      <div className="sidebar-menu" style={{ padding: '0 12px', flex: 1, overflowY: 'auto' }}>
        {projects.length === 0 ? (
          <div style={{ padding: '16px 8px', color: 'hsl(var(--text-muted))', fontSize: '12px', textAlign: 'center' }}>
            No projects. Create one above!
          </div>
        ) : (
          projects.map((proj) => (
            <div
              key={proj.id}
              className={`project-item ${activeProjectId === proj.id ? 'active' : ''}`}
              onClick={() => onSelectProject(proj.id)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, paddingRight: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {proj.name}
                </span>
                <span style={{ fontSize: '10px', opacity: 0.6 }}>
                  Role: {proj.userRole}
                </span>
              </div>
              <span className="project-badge">{proj.tasksCount}</span>
            </div>
          ))
        )}
      </div>

      {/* Project Creation Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <GlassCard>
              <div className="modal-header">
                <h3 className="modal-title">Create New Project</h3>
                <button
                  className="btn-icon-only"
                  onClick={() => setShowModal(false)}
                  style={{ border: 'none', background: 'none' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                {error && <div className="alert alert-danger">{error}</div>}

                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Project Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Website Redesign"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description (Optional)</label>
                    <textarea
                      className="form-control"
                      placeholder="Brief details about the project..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      disabled={loading}
                      style={{ resize: 'none' }}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading || !name.trim()}
                  >
                    {loading ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </GlassCard>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectSelector;
