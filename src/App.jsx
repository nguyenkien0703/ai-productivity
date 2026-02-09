import { useState, useEffect } from 'react';
import MetricCard from './components/MetricCard';
import PRChart from './components/PRChart';
import SprintChart from './components/SprintChart';
import TimelineChart from './components/TimelineChart';
import SummarySection from './components/SummarySection';
import { calculatePRStats, getPRsByMonth } from '../shared/github-calculations.js';
import { calculateSprintStats } from '../shared/jira-calculations.js';
import { fetchDashboardData, triggerSync, getSyncStatus } from './services/dashboard';
import { calculateSummary } from './utils/calculations';

// Pivot date: July 1, 2025 (join date)
const PIVOT_DATE = new Date(import.meta.env.VITE_JOIN_DATE || '2025-07-01');
const HOURLY_RATE = 10; // Default hourly rate for cost calculations

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prData, setPrData] = useState([]);
  const [prStats, setPrStats] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [sprintData, setSprintData] = useState([]);
  const [sprintStats, setSprintStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  function processApiData(data) {
    const { pullRequests, sprints, syncStatus: status } = data;

    setSyncStatus(status);

    if (pullRequests.length > 0) {
      setPrData(pullRequests);
      setPrStats(calculatePRStats(pullRequests, PIVOT_DATE));
      setMonthlyData(getPRsByMonth(pullRequests));
    }

    if (sprints.length > 0) {
      const mapped = sprints.map((s) => ({
        ...s,
        startDate: s.start_date,
        endDate: s.end_date,
        completeDate: s.complete_date,
        committedPoints: s.committed_points,
        completedPoints: s.completed_points,
        completionRate: s.completion_rate,
        issueCount: s.issue_count,
      }));
      setSprintData(mapped);
      setSprintStats(calculateSprintStats(mapped, PIVOT_DATE));
    }

    // Return whether DB has data
    return pullRequests.length > 0 || sprints.length > 0;
  }

  // Initial data load
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchDashboardData();
        if (cancelled) return;

        const hasData = processApiData(data);

        // First run: DB empty & never synced → trigger one sync
        if (!hasData && data.syncStatus.github.status === 'never') {
          doSync();
        }
      } catch (err) {
        if (!cancelled) setError('Backend not available. Start server with npm run dev');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  // Calculate summary when stats change
  useEffect(() => {
    if (prStats && sprintStats) {
      setSummary(calculateSummary(prStats, sprintStats, HOURLY_RATE));
    }
  }, [prStats, sprintStats]);

  // Sync + poll + reload
  async function doSync() {
    setSyncing(true);
    try {
      await triggerSync();
    } catch {
      setSyncing(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 90; // 3 minutes max (90 * 2s)
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const status = await getSyncStatus();
        if ((!status.syncing.github && !status.syncing.jira) || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          setSyncing(false);
          // Reload fresh data from DB
          try {
            const data = await fetchDashboardData();
            processApiData(data);
          } catch { /* ignore */ }
        }
      } catch {
        clearInterval(pollInterval);
        setSyncing(false);
      }
    }, 2000);
  }

  function handleRefresh() {
    if (!syncing) doSync();
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
        }}
      >
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
          <style>
            {`@keyframes spin { to { transform: rotate(360deg); } }`}
          </style>
          <p style={{ color: '#6b7280' }}>Loading productivity data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
        }}
      >
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
          }}
        >
          <h2 style={{ color: '#dc2626', margin: '0 0 8px' }}>Error Loading Data</h2>
          <p style={{ color: '#7f1d1d', margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  const lastSyncTime = syncStatus?.github?.lastSyncAt || syncStatus?.jira?.lastSyncAt;

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1
              style={{
                margin: '0 0 8px',
                fontSize: '28px',
                fontWeight: 700,
                color: '#111827',
              }}
            >
              AI Productivity Metrics Dashboard
            </h1>
            <p style={{ margin: 0, color: '#6b7280' }}>
              Comparing team productivity before and after{' '}
              <strong style={{ color: '#3b82f6' }}>
                {PIVOT_DATE.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </strong>
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={syncing}
            style={{
              padding: '10px 20px',
              backgroundColor: syncing ? '#9ca3af' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: syncing ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.2s',
            }}
          >
            {syncing ? (
              <>
                <span style={{
                  display: 'inline-block',
                  width: '16px',
                  height: '16px',
                  border: '2px solid #e5e7eb',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                Syncing...
              </>
            ) : (
              'Refresh Data'
            )}
          </button>
        </header>

        {/* Syncing Banner - shown when syncing with existing data */}
        {syncing && (prStats || sprintStats) && (
          <div style={{
            background: 'linear-gradient(135deg, #eff6ff, #eef2ff)',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '16px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <div style={{
              width: '20px',
              height: '20px',
              border: '3px solid #bfdbfe',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              flexShrink: 0,
            }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: '#1e40af', fontSize: '14px' }}>
                Refreshing data from GitHub & Jira...
              </p>
              <p style={{ margin: '4px 0 0', color: '#3b82f6', fontSize: '13px' }}>
                Showing cached data while updating. This may take a minute.
              </p>
            </div>
          </div>
        )}

        {/* Initial Sync Screen - shown when no data and syncing */}
        {syncing && !prStats && !sprintStats && (
          <div style={{
            background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '60px 40px',
            textAlign: 'center',
            marginBottom: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              border: '4px solid #e2e8f0',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px',
            }} />
            <h2 style={{ margin: '0 0 12px', fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>
              Syncing your data for the first time
            </h2>
            <p style={{ margin: '0 0 32px', color: '#64748b', fontSize: '15px', maxWidth: '480px', marginInline: 'auto' }}>
              Fetching pull requests from GitHub and sprint data from Jira.
              This may take a couple of minutes on the first sync.
            </p>

            {/* Skeleton cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              maxWidth: '900px',
              margin: '0 auto',
            }}>
              {['GitHub PRs', 'Jira Sprints', 'Merge Times', 'Story Points'].map((label) => (
                <div key={label} style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'left',
                }}>
                  <div style={{
                    width: '60%',
                    height: '12px',
                    backgroundColor: '#e2e8f0',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    animation: 'pulse 2s ease-in-out infinite',
                  }} />
                  <div style={{
                    width: '40%',
                    height: '28px',
                    backgroundColor: '#e2e8f0',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    animation: 'pulse 2s ease-in-out infinite',
                    animationDelay: '0.2s',
                  }} />
                  <div style={{
                    width: '80%',
                    height: '10px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '6px',
                    animation: 'pulse 2s ease-in-out infinite',
                    animationDelay: '0.4s',
                  }} />
                  <p style={{ margin: '12px 0 0', color: '#94a3b8', fontSize: '12px' }}>{label}</p>
                </div>
              ))}
            </div>

            <style>
              {`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}
            </style>
          </div>
        )}

        {/* Summary Section */}
        {summary && (
          <SummarySection
            summary={summary}
            prStats={prStats}
            sprintStats={sprintStats}
            hourlyRate={HOURLY_RATE}
          />
        )}

        {/* Metric Cards - Key AI Impact Metrics */}
        {prStats && sprintStats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '20px',
              marginBottom: '24px',
            }}
          >
            <MetricCard
              title="Total PRs Created"
              beforeValue={prStats.prCountBefore}
              afterValue={prStats.prCountAfter}
              improvement={summary?.improvements.prCount || 0}
              icon="📊"
            />
            <MetricCard
              title="PRs Merged"
              beforeValue={prStats.mergedCountBefore}
              afterValue={prStats.mergedCountAfter}
              improvement={
                prStats.mergedCountBefore > 0
                  ? ((prStats.mergedCountAfter - prStats.mergedCountBefore) / prStats.mergedCountBefore) * 100
                  : 100
              }
              icon="✅"
            />
            <MetricCard
              title="Sprints Completed"
              beforeValue={sprintStats.sprintCountBefore}
              afterValue={sprintStats.sprintCountAfter}
              improvement={0}
              icon="🏃"
            />
            <MetricCard
              title="Total Story Points"
              beforeValue={sprintStats.totalPointsBefore}
              afterValue={sprintStats.totalPointsAfter}
              improvement={summary?.improvements.storyPoints || 0}
              icon="📈"
            />
          </div>
        )}

        {/* Charts */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: '24px',
            marginBottom: '24px',
          }}
        >
          {prStats && <PRChart prStats={prStats} />}
          {sprintData.length > 0 && (
            <SprintChart sprintData={sprintData} pivotDate={PIVOT_DATE} />
          )}
        </div>

        {/* Timeline Chart */}
        {monthlyData.length > 0 && (
          <TimelineChart monthlyData={monthlyData} pivotDate={PIVOT_DATE} />
        )}

        {/* Footer */}
        <footer
          style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid #e5e7eb',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '14px',
          }}
        >
          <p>
            Data sources: GitHub (DefikitTeam/lumilink-be, DefikitTeam/lumilink-fe) | Jira
            (AAP)
          </p>
          <p style={{ marginTop: '8px' }}>
            Last synced: {lastSyncTime
              ? new Date(lastSyncTime + 'Z').toLocaleString()
              : 'Never'}
            {syncStatus?.github?.isStale || syncStatus?.jira?.isStale
              ? ' (stale - auto-refreshing)'
              : ''}
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
