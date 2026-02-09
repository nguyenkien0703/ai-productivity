import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export default function MemberLeaderboard({ members }) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('commits');

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (sortBy === 'commits') {
        return b.metrics.commitFrequency.total - a.metrics.commitFrequency.total;
      } else if (sortBy === 'prs') {
        return b.metrics.prMetrics.created - a.metrics.prMetrics.created;
      }
      return 0;
    });
  }, [members, sortBy]);

  return (
    <div
      style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px',
      }}
    >
      <h2 style={{ margin: '0 0 16px' }}>Team Member Leaderboard</h2>

      <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setSortBy('commits')}
          style={{
            padding: '8px 16px',
            backgroundColor: sortBy === 'commits' ? '#3b82f6' : '#e5e7eb',
            color: sortBy === 'commits' ? '#fff' : '#374151',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
          }}
        >
          Sort by Commits
        </button>
        <button
          onClick={() => setSortBy('prs')}
          style={{
            padding: '8px 16px',
            backgroundColor: sortBy === 'prs' ? '#3b82f6' : '#e5e7eb',
            color: sortBy === 'prs' ? '#fff' : '#374151',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
            fontSize: '14px',
          }}
        >
          Sort by PRs
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
            <th style={{ padding: '12px' }}>Rank</th>
            <th style={{ padding: '12px' }}>Member</th>
            <th style={{ padding: '12px' }}>Commits</th>
            <th style={{ padding: '12px' }}>PRs</th>
            <th style={{ padding: '12px' }}>Active Days</th>
            <th style={{ padding: '12px' }}>Streak</th>
            <th style={{ padding: '12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedMembers.map((member, index) => (
            <tr key={member.username} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px', fontWeight: 'bold' }}>#{index + 1}</td>
              <td style={{ padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {member.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.displayName}
                      style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: '#e5e7eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#6b7280',
                      }}
                    >
                      {member.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>{member.displayName}</span>
                </div>
              </td>
              <td style={{ padding: '12px' }}>{member.metrics.commitFrequency.total}</td>
              <td style={{ padding: '12px' }}>{member.metrics.prMetrics.created}</td>
              <td style={{ padding: '12px' }}>{member.metrics.commitFrequency.activeDays}</td>
              <td style={{ padding: '12px' }}>
                {member.metrics.commitFrequency.currentStreak} days
              </td>
              <td style={{ padding: '12px' }}>
                <button
                  onClick={() => navigate(`/member/${member.username}`)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  View Details →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
