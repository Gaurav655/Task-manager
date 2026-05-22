import React, { useState, useEffect, useRef } from 'react';
import { api, type Project, type User } from '../api';
import GlassCard from './GlassCard';

interface ProjectMembersProps {
  project: Project;
  onMemberAdded: (newMember: any) => void;
  onMemberRemoved: (userId: string) => void;
}

export const ProjectMembers: React.FC<ProjectMembersProps> = ({
  project,
  onMemberAdded,
  onMemberRemoved,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = project.userRole === 'ADMIN';

  // Fetch search results on query change
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 1) {
        try {
          const results = await api.searchUsers(searchQuery);
          // Filter out users who are already members of this project
          const memberIds = project.members.map((m) => m.id);
          const filteredResults = results.filter((u) => !memberIds.includes(u.id));
          setSearchResults(filteredResults);
          setShowDropdown(true);
        } catch (err) {
          console.error(err);
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, project.members]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = async (user: User) => {
    setLoading(true);
    setError('');
    setSearchQuery('');
    setShowDropdown(false);

    try {
      const added = await api.addProjectMember(project.id, {
        email: user.email,
        role: inviteRole,
      });
      onMemberAdded(added);
    } catch (err: any) {
      setError(err.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this member from the project?')) {
      return;
    }
    setError('');
    try {
      await api.removeProjectMember(project.id, userId);
      onMemberRemoved(userId);
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  return (
    <GlassCard className="animate-fade-in" style={{ height: '100%' }}>
      <h3 style={{ marginBottom: '16px', color: 'white', fontSize: '18px' }}>Project Team</h3>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Admin Invite Controls */}
      {isAdmin && (
        <div ref={dropdownRef} className="relative-container" style={{ marginBottom: '24px' }}>
          <div className="form-group" style={{ marginBottom: '8px' }}>
            <label className="form-label">Add Team Member</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1 }}
                disabled={loading}
              />
              <select
                className="form-control"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MEMBER')}
                style={{ width: '110px' }}
                disabled={loading}
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>

          {/* Search Dropdown Results */}
          {showDropdown && searchResults.length > 0 && (
            <div className="search-results-box">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="search-result-item"
                  onClick={() => handleSelectUser(user)}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '13px' }}>{user.name}</div>
                    <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>{user.email}</div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'hsl(var(--primary))', fontWeight: 500 }}>
                    + Add
                  </span>
                </div>
              ))}
            </div>
          )}

          {showDropdown && searchResults.length === 0 && searchQuery.length > 1 && (
            <div className="search-results-box" style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'hsl(var(--text-muted))' }}>
              No non-member users found
            </div>
          )}
        </div>
      )}

      {/* Member List */}
      <div className="member-list">
        {project.members.map((member) => (
          <div key={member.id} className="member-row">
            <div className="member-info">
              <div
                className="avatar"
                style={{
                  width: '32px',
                  height: '32px',
                  fontSize: '12px',
                  background: member.role === 'ADMIN' ? 'hsla(var(--primary) / 0.15)' : 'rgba(255,255,255,0.05)',
                  borderColor: member.role === 'ADMIN' ? 'hsla(var(--primary) / 0.3)' : 'rgba(255,255,255,0.08)'
                }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="member-name">{member.name}</span>
                <div className="member-email">{member.email}</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={`member-role-badge ${member.role.toLowerCase()}`}>
                {member.role}
              </span>

              {isAdmin && project.members.length > 1 && (
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'hsl(var(--danger))',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '0 4px',
                    opacity: 0.7
                  }}
                  title="Remove Member"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

export default ProjectMembers;
