import { useMemo } from 'react';

export default function CommitsTrendChart({ timelineData }) {
  const chartData = useMemo(() => {
    if (!timelineData || timelineData.length === 0) return null;

    // Group by week for cleaner chart
    const weeklyData = {};
    timelineData.forEach(({ date, count }) => {
      const d = new Date(date);
      const weekStart = new Date(d);
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      weekStart.setDate(diff);
      const weekKey = weekStart.toISOString().split('T')[0];

      weeklyData[weekKey] = (weeklyData[weekKey] || 0) + count;
    });

    const data = Object.entries(weeklyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const maxCount = Math.max(...data.map(d => d.count));

    return { data, maxCount };
  }, [timelineData]);

  if (!chartData || chartData.data.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
        No data available for chart
      </div>
    );
  }

  const { data, maxCount } = chartData;
  const width = 1000;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate points for the line
  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - (d.count / maxCount) * chartHeight;
    return { x, y, date: d.date, count: d.count };
  });

  const linePath = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');

  // Area fill path
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`;

  return (
    <div style={{ overflowX: 'auto', padding: '16px 0' }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + chartHeight * (1 - ratio);
          const value = Math.round(maxCount * ratio);
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#6b7280"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#gradient)"
          opacity="0.3"
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#3b82f6"
              stroke="#fff"
              strokeWidth="2"
            >
              <title>{`${new Date(p.date).toLocaleDateString()}: ${p.count} commits`}</title>
            </circle>
          </g>
        ))}

        {/* X-axis labels (show every few weeks) */}
        {points.filter((_, i) => i % Math.ceil(points.length / 8) === 0).map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={height - padding.bottom + 20}
            textAnchor="middle"
            fontSize="11"
            fill="#6b7280"
          >
            {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </text>
        ))}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Axes */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="#9ca3af"
          strokeWidth="2"
        />
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="#9ca3af"
          strokeWidth="2"
        />

        {/* Axis labels */}
        <text
          x={padding.left - 35}
          y={padding.top + chartHeight / 2}
          textAnchor="middle"
          fontSize="12"
          fill="#6b7280"
          transform={`rotate(-90 ${padding.left - 35} ${padding.top + chartHeight / 2})`}
        >
          Commits
        </text>
      </svg>
    </div>
  );
}
