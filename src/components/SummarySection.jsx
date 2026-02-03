import { formatHours, formatCurrency, formatPercentage } from '../utils/calculations';

/**
 * Summary section showing overall improvements and savings
 */
export default function SummarySection({ summary, prStats, sprintStats, hourlyRate = 10 }) {
  const { improvements, timeSaved, costSavings } = summary;

  // Calculate AI productivity metrics
  const prIncrease = improvements.prCount;
  const sprintImprovement = improvements.completionRate;
  const storyPointsImprovement = improvements.storyPoints;

  // Estimate time saved per PR with AI (assume 2 hours saved per PR)
  const estimatedHoursSavedPerPR = 2;
  // Use PR INCREASE (difference), not total PRs after
  const prIncreaseCount = (prStats?.prCountAfter || 0) - (prStats?.prCountBefore || 0);
  const estimatedTotalHoursSaved = prIncreaseCount * estimatedHoursSavedPerPR;
  const estimatedCostSavings = estimatedTotalHoursSaved * hourlyRate;

  // Time saved percentage (based on PR throughput increase)
  const timeSavedPercentage = prIncrease > 0 ? Math.min(prIncrease, 100) : 0;

  const summaryItems = [
    {
      label: 'PR Volume Increase',
      value: formatPercentage(prIncrease),
      color: prIncrease > 0 ? '#10b981' : '#ef4444',
      icon: '📈',
      subtext: `${prStats?.prCountBefore || 0} → ${prStats?.prCountAfter || 0} PRs`,
      description: 'Số PR tăng kể từ khi apply AI',
    },
    {
      label: 'Estimated Time Saved',
      value: `${estimatedTotalHoursSaved.toLocaleString()} hrs`,
      color: '#3b82f6',
      icon: '⏱️',
      subtext: `~${(estimatedTotalHoursSaved / 8).toFixed(0)} work days`,
      description: `Ước tính ${estimatedHoursSavedPerPR}h/PR`,
    },
    {
      label: 'Cost Savings',
      value: formatCurrency(estimatedCostSavings),
      color: '#8b5cf6',
      icon: '💰',
      subtext: `at ${formatCurrency(hourlyRate)}/hr`,
      description: 'Chi phí nhân lực tiết kiệm',
    },
  ];

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%)',
        borderRadius: '16px',
        padding: '32px',
        color: 'white',
        marginBottom: '24px',
      }}
    >
      <h2
        style={{
          margin: '0 0 8px 0',
          fontSize: '20px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        🎯 AI Productivity Impact
      </h2>
      <p style={{ margin: '0 0 24px 0', opacity: 0.8, fontSize: '14px' }}>
        Đo lường hiệu quả sau khi áp dụng AI vào quy trình phát triển
      </p>

      {/* Main Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {summaryItems.map((item, index) => (
          <div
            key={index}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '20px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '8px',
              }}
            >
              <span style={{ fontSize: '20px' }}>{item.icon}</span>
              <span
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  opacity: 0.8,
                }}
              >
                {item.label}
              </span>
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>
              {item.value}
            </div>
            {item.subtext && (
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                {item.subtext}
              </div>
            )}
            {item.description && (
              <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '8px', fontStyle: 'italic' }}>
                {item.description}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Key Metrics Grid */}
      <div
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.2)',
          paddingTop: '24px',
        }}
      >
        <h3
          style={{
            margin: '0 0 16px 0',
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            opacity: 0.8,
          }}
        >
          Các chỉ số cải thiện
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
          }}
        >
          {/* PR Volume */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '16px',
              borderRadius: '8px',
              borderLeft: '4px solid #10b981',
            }}
          >
            <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
              📊 PR Volume (After AI)
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>
              {formatPercentage(prIncrease)}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>
              Tăng {prStats?.prCountAfter - prStats?.prCountBefore} PRs
            </div>
          </div>

          {/* Sprint Completion */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '16px',
              borderRadius: '8px',
              borderLeft: `4px solid ${sprintImprovement > 0 ? '#10b981' : '#f59e0b'}`,
            }}
          >
            <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
              🎯 Sprint Completion Rate
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>
              {sprintStats?.avgCompletionAfter?.toFixed(1) || 0}%
            </div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>
              {sprintStats?.sprintCountAfter || 0} sprints completed
            </div>
          </div>

          {/* Story Points */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '16px',
              borderRadius: '8px',
              borderLeft: `4px solid ${storyPointsImprovement > 0 ? '#10b981' : '#f59e0b'}`,
            }}
          >
            <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
              📈 Avg Story Points/Sprint
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>
              {sprintStats?.avgPointsAfter?.toFixed(1) || 0}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>
              Total: {sprintStats?.totalPointsAfter || 0} points
            </div>
          </div>

          {/* Time Efficiency */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '16px',
              borderRadius: '8px',
              borderLeft: '4px solid #3b82f6',
            }}
          >
            <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '4px' }}>
              ⚡ Productivity Boost
            </div>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>
              {prIncrease > 100 ? `${(prIncrease / 100).toFixed(1)}x` : formatPercentage(prIncrease)}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>
              Output increase with AI
            </div>
          </div>
        </div>
      </div>

      {/* AI Impact Note */}
      <div
        style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          borderRadius: '8px',
          fontSize: '13px',
        }}
      >
        <strong>💡 Key Insight:</strong> Với AI assistance, team đã tăng output lên{' '}
        <strong>{(prIncrease / 100 + 1).toFixed(1)}x</strong> so với trước, tiết kiệm ước tính{' '}
        <strong>{formatCurrency(estimatedCostSavings)}</strong> chi phí nhân lực
        (dựa trên {estimatedHoursSavedPerPR}h tiết kiệm/PR × {prIncreaseCount} PRs tăng thêm × {formatCurrency(hourlyRate)}/hr).
      </div>
    </div>
  );
}
