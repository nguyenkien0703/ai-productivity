import { useState, useEffect, useRef } from 'react';
import MetricCard from './components/MetricCard';
import PRChart from './components/PRChart';
import SprintChart from './components/SprintChart';
import TimelineChart from './components/TimelineChart';
import SummarySection from './components/SummarySection';
import { calculatePRStats, getPRsByMonth } from './services/github';
import { calculateSprintStats } from './services/jira';
import { calculateSummary } from './utils/calculations';

// Pivot date: July 1, 2025 (join date)
const PIVOT_DATE = new Date(import.meta.env.VITE_JOIN_DATE || '2025-07-01');
const HOURLY_RATE = 10; // Default hourly rate for cost calculations

function formatTimeAgo(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prData, setPrData] = useState([]);
  const [prStats, setPrStats] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [sprintData, setSprintData] = useState([]);
  const [sprintStats, setSprintStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [toasts, setToasts] = useState([]);

  function processData(githubPRs, jiraSprints, syncMeta) {
    // Process GitHub data
    if (githubPRs && githubPRs.length > 0) {
      setPrData(githubPRs);
      setPrStats(calculatePRStats(githubPRs, PIVOT_DATE));
      setMonthlyData(getPRsByMonth(githubPRs));
    }

    // Process Jira data
    if (jiraSprints && jiraSprints.length > 0) {
      setSprintData(jiraSprints);
      setSprintStats(calculateSprintStats(jiraSprints, PIVOT_DATE));
    }

    if (syncMeta?.lastSyncAt) {
      setLastSyncAt(syncMeta.lastSyncAt);
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/data/cached');
        if (!response.ok) {
          throw new Error(`Failed to load cached data: ${response.status}`);
        }

        const { githubPRs, jiraSprints, syncMeta } = await response.json();
        processData(githubPRs, jiraSprints, syncMeta);
      } catch (err) {
        console.error('Load error:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Calculate summary when stats are available
  useEffect(() => {
    if (prStats && sprintStats) {
      const summaryData = calculateSummary(prStats, sprintStats, HOURLY_RATE);
      setSummary(summaryData);
    }
  }, [prStats, sprintStats]);

  const toastIdRef = useRef(0);
  function addToast(message, type = 'info', duration = 4000) {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }

  function removeToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSync() {
    setSyncing(true);
    const progressToastId = addToast('Starting sync...', 'loading', 0);

    const es = new EventSource('/api/data/sync/stream');

    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setToasts((prev) =>
        prev.map((t) =>
          t.id === progressToastId ? { ...t, message: data.message } : t
        )
      );
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      es.close();
      removeToast(progressToastId);

      processData(data.githubPRs, data.jiraSprints, data.syncMeta);
      setSyncing(false);

      if (data.status === 'success') {
        addToast(
          `Sync completed! ${data.githubPRs.length} PRs, ${data.jiraSprints.length} sprints`,
          'success'
        );
      } else {
        const errMsgs = data.errors.map((e) => e.source).join(', ');
        addToast(`Sync partially completed. Errors: ${errMsgs}`, 'warning', 6000);
      }
    });

    es.addEventListener('error', () => {
      es.close();
      removeToast(progressToastId);
      setSyncing(false);
      addToast('Sync failed. Please try again.', 'error', 5000);
    });
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

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        padding: '24px',
      }}
    >
      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxWidth: '400px',
          }}
        >
          {toasts.map((toast) => {
            const colors = {
              info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
              loading: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
              success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
              warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
              error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
            };
            const c = colors[toast.type] || colors.info;
            return (
              <div
                key={toast.id}
                style={{
                  padding: '12px 16px',
                  backgroundColor: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: '8px',
                  color: c.text,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  animation: 'slideIn 0.3s ease-out',
                }}
              >
                {toast.type === 'loading' && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '16px',
                      height: '16px',
                      border: '2px solid #bfdbfe',
                      borderTopColor: '#3b82f6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      flexShrink: 0,
                    }}
                  />
                )}
                {toast.type === 'success' && <span style={{ flexShrink: 0 }}>&#10003;</span>}
                {toast.type === 'error' && <span style={{ flexShrink: 0 }}>&#10007;</span>}
                {toast.type === 'warning' && <span style={{ flexShrink: 0 }}>&#9888;</span>}
                <span style={{ flex: 1 }}>{toast.message}</span>
                <button
                  onClick={() => removeToast(toast.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: c.text,
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '0 2px',
                    opacity: 0.6,
                    flexShrink: 0,
                  }}
                >
                  &#10005;
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style>
        {`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}
      </style>

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

          {/* Sync Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>
              Last synced: {formatTimeAgo(lastSyncAt)}
            </span>
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: syncing ? '#9ca3af' : '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: syncing ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {syncing ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  Syncing...
                </>
              ) : (
                <>
                  <span style={{ fontSize: '16px' }}>&#x21bb;</span>
                  Sync Now
                </>
              )}
            </button>
          </div>
        </header>

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
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
