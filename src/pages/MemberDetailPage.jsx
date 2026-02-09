import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MemberContributionHeatmap from '../components/MemberContributionHeatmap';
import CommitsTrendChart from '../components/CommitsTrendChart';

export default function MemberDetailPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [memberData, setMemberData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/data/cached');
        const data = await response.json();
        const member = data.memberStats.find((m) => m.username === username);

        if (!member) {
          throw new Error('Member not found');
        }

        setMemberData(member);
      } catch (err) {
        console.error('Error loading member:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [username]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e5e7eb',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#6b7280' }}>Loading member data...</p>
        </div>
      </div>
    );
  }

  if (!memberData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: '#dc2626' }}>Member not found</h2>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <button
          onClick={() => navigate('/')}
          style={{
            marginBottom: '24px',
            padding: '8px 16px',
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ← Back to Dashboard
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          {memberData.avatar && (
            <img
              src={memberData.avatar}
              alt={memberData.displayName}
              style={{ width: '64px', height: '64px', borderRadius: '50%' }}
            />
          )}
          <div>
            <h1 style={{ margin: 0 }}>{memberData.displayName}</h1>
            <p style={{ margin: 0, color: '#6b7280' }}>@{memberData.username}</p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <MetricCard
            title="Total Commits"
            value={memberData.metrics.commitFrequency.total}
          />
          <MetricCard
            title="Active Days"
            value={memberData.metrics.commitFrequency.activeDays}
          />
          <MetricCard
            title="Current Streak"
            value={`${memberData.metrics.commitFrequency.currentStreak} days`}
          />
          <MetricCard
            title="PRs Created"
            value={memberData.metrics.prMetrics.created}
          />
        </div>

        {/* New Metrics Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <MetricCard
            title="Longest Streak"
            value={`${memberData.metrics.commitFrequency.longestStreak} days`}
            icon="🔥"
          />
          <MetricCard
            title="Commits/Week"
            value={memberData.metrics.commitFrequency.commitsPerWeek}
            icon="📊"
          />
          <MetricCard
            title="Busiest Week"
            value={`${memberData.metrics.commitFrequency.busiestWeek.commits} commits`}
            subtitle={new Date(memberData.metrics.commitFrequency.busiestWeek.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            icon="⚡"
          />
          <MetricCard
            title="Team Rank"
            value={`#${memberData.teamContext.rank} / ${memberData.teamContext.totalMembers}`}
            subtitle={`${memberData.teamContext.percentageOfTeam}% of team`}
            icon="🏆"
          />
        </div>

        {/* Contribution Heatmap */}
        <MemberContributionHeatmap heatmapData={memberData.heatmapData} memberData={memberData} />

        {/* Commits Trend Chart */}
        <div
          style={{
            marginTop: '24px',
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ margin: '0 0 16px' }}>Commits Trend (Weekly)</h3>
          <CommitsTrendChart timelineData={memberData.commitsTimeline} />
        </div>

        {/* Before/After Comparison */}
        <div
          style={{
            marginTop: '24px',
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h3 style={{ margin: '0 0 16px' }}>Performance Comparison (Before/After Jul 2025)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <ComparisonCard
              title="Commits"
              before={memberData.metrics.commitFrequency.before}
              after={memberData.metrics.commitFrequency.after}
            />
            <ComparisonCard
              title="Pull Requests"
              before={memberData.metrics.prMetrics.before}
              after={memberData.metrics.prMetrics.after}
            />
          </div>
        </div>

        {/* Repository Activity */}
        <div
          style={{
            marginTop: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ margin: '0 0 16px' }}>Repository Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {memberData.metrics.repoActivity.map((repo) => {
                const commitsUrl = `https://github.com/${repo.repo}/commits?author=${memberData.username}`;
                const prsUrl = `https://github.com/${repo.repo}/pulls?q=is:pr+author:${memberData.username}`;

                return (
                  <div
                    key={repo.repo}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '6px',
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{repo.repo}</span>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <a
                        href={commitsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '14px',
                          color: '#6b7280',
                          textDecoration: 'none',
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => (e.target.style.color = '#3b82f6')}
                        onMouseLeave={(e) => (e.target.style.color = '#6b7280')}
                      >
                        <span style={{ fontWeight: 600, color: '#3b82f6' }}>{repo.commits}</span> commits
                      </a>
                      <a
                        href={prsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '14px',
                          color: '#6b7280',
                          textDecoration: 'none',
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => (e.target.style.color = '#10b981')}
                        onMouseLeave={(e) => (e.target.style.color = '#6b7280')}
                      >
                        <span style={{ fontWeight: 600, color: '#10b981' }}>{repo.prs}</span> PRs
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PR Metrics */}
        <div
          style={{
            backgroundColor: '#fff',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginTop: '24px',
          }}
        >
          <h3 style={{ margin: '0 0 16px' }}>Pull Request Metrics</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
            }}
          >
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#6b7280' }}>
                PRs Created
              </p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
                {memberData.metrics.prMetrics.created}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#6b7280' }}>
                PRs Merged
              </p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
                {memberData.metrics.prMetrics.merged}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#6b7280' }}>
                Merge Rate
              </p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
                {(memberData.metrics.prMetrics.mergeRate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#6b7280' }}>
                Avg Merge Time
              </p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
                {memberData.metrics.prMetrics.avgMergeTimeHours.toFixed(1)}h
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon }) {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>{title}</p>
        {icon && <span style={{ fontSize: '20px' }}>{icon}</span>}
      </div>
      <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{value}</p>
      {subtitle && (
        <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: '12px' }}>{subtitle}</p>
      )}
    </div>
  );
}

function ComparisonCard({ title, before, after }) {
  const change = after - before;
  const percentChange = before > 0 ? ((change / before) * 100).toFixed(1) : (after > 0 ? 100 : 0);
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
      }}
    >
      <h4 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 600 }}>{title}</h4>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#6b7280' }}>Before</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{before}</p>
        </div>
        <div style={{ fontSize: '24px', color: '#9ca3af' }}>→</div>
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#6b7280' }}>After</p>
          <p style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{after}</p>
        </div>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: isNeutral ? '#f3f4f6' : (isPositive ? '#dcfce7' : '#fee2e2'),
            color: isNeutral ? '#6b7280' : (isPositive ? '#16a34a' : '#dc2626'),
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          {isPositive ? '↑' : (isNeutral ? '=' : '↓')} {Math.abs(percentChange)}%
        </div>
      </div>
    </div>
  );
}
