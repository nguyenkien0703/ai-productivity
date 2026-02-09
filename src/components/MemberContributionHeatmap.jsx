import { useMemo, useState } from 'react';

// Helper: Convert UTC date to GMT+7 date string (same as server)
function toGMT7DateString(date) {
  const d = new Date(date);
  // Add 7 hours for GMT+7
  d.setHours(d.getHours() + 7);
  return d.toISOString().split('T')[0];
}

export default function MemberContributionHeatmap({ heatmapData, memberData }) {
  // Calculate max year from data (default to current year)
  const maxYear = useMemo(() => {
    const years = Object.keys(heatmapData).map(dateStr => new Date(dateStr).getFullYear());
    return Math.max(...years, new Date().getFullYear());
  }, [heatmapData]);

  const [selectedYear, setSelectedYear] = useState(maxYear);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const { weeks, monthLabels, yearRange } = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();

    // Calculate year range from heatmap data
    const years = Object.keys(heatmapData).map(dateStr => new Date(dateStr).getFullYear());
    const minYear = Math.min(...years, currentYear - 1);
    const maxYear = currentYear;
    const yearRange = [];
    for (let y = maxYear; y >= minYear; y--) {
      yearRange.push(y);
    }

    // Always show full year (Jan 1 - Dec 31) for consistent width
    const startDate = new Date(selectedYear, 0, 1); // Jan 1
    const endDate = new Date(selectedYear, 11, 31); // Dec 31 (always full year)

    const weekGrid = [];
    const monthLabelsArray = [];
    let currentWeek = [];
    let currentMonth = -1;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = toGMT7DateString(d);
      const count = heatmapData[dateStr] || 0;

      currentWeek.push({ date: new Date(d), count });

      // Track month labels (show label at start of each month)
      if (d.getMonth() !== currentMonth) {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        monthLabelsArray.push({
          index: weekGrid.length,
          label: monthNames[d.getMonth()],
        });
        currentMonth = d.getMonth();
      }

      // Push week on Saturday
      if (d.getDay() === 6) {
        weekGrid.push(currentWeek);
        currentWeek = [];
      }
    }

    // Push any remaining days (last incomplete week)
    if (currentWeek.length > 0) {
      weekGrid.push(currentWeek);
    }

    return { weeks: weekGrid, monthLabels: monthLabelsArray, yearRange };
  }, [heatmapData, selectedYear]);

  function getColor(count) {
    if (count === 0) return '#ebedf0';
    if (count <= 2) return '#9be9a8';
    if (count <= 5) return '#40c463';
    if (count <= 10) return '#30a14e';
    return '#216e39';
  }

  return (
    <div
      style={{
        backgroundColor: '#fff',
        padding: '24px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Contribution Activity</h3>

        {/* Year Selector */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: '#fff',
          }}
        >
          {yearRange.map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      {/* Year Summary */}
      <div style={{ marginBottom: '16px', fontSize: '14px', color: '#6b7280' }}>
        {(() => {
          const yearCommits = Object.entries(heatmapData).filter(([dateStr]) => {
            const year = new Date(dateStr).getFullYear();
            return year === selectedYear;
          }).reduce((sum, [, count]) => sum + count, 0);
          return `${yearCommits} contributions in ${selectedYear}`;
        })()}
      </div>

      {/* Month Labels */}
      <div
        style={{
          position: 'relative',
          marginBottom: '4px',
          paddingLeft: '40px',
          fontSize: '12px',
          color: '#6b7280',
          height: '20px',
        }}
      >
        {monthLabels.map((label, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${40 + label.index * 23}px`,
            }}
          >
            {label.label}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
        {/* Day Labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '10px', color: '#6b7280', paddingTop: '18px', flexShrink: 0 }}>
          <div style={{ height: '17px' }}></div>
          <div style={{ height: '17px', lineHeight: '17px' }}>Mon</div>
          <div style={{ height: '17px' }}></div>
          <div style={{ height: '17px', lineHeight: '17px' }}>Wed</div>
          <div style={{ height: '17px' }}></div>
          <div style={{ height: '17px', lineHeight: '17px' }}>Fri</div>
          <div style={{ height: '17px' }}></div>
        </div>

        {/* Heatmap Grid */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            paddingBottom: '16px',
            flex: 1,
            minWidth: 0,
            justifyContent: 'flex-start',
          }}
        >
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexShrink: 0 }}>
            {week.map((day, dayIndex) => {
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const month = monthNames[day.date.getMonth()];
              const dayNum = day.date.getDate();
              const year = day.date.getFullYear();
              const commitText = day.count === 1 ? '1 commit' : `${day.count} commits`;
              const tooltipText = day.count === 0
                ? `No commits on ${month} ${dayNum}, ${year}`
                : `${commitText} on ${month} ${dayNum}, ${year}`;

              return (
                <div
                  key={dayIndex}
                  title={tooltipText}
                  onClick={() => {
                    if (day.count > 0) {
                      setSelectedDate(day.date);
                      setShowModal(true);
                    }
                  }}
                  style={{
                    width: '17px',
                    height: '17px',
                    backgroundColor: getColor(day.count),
                    borderRadius: '3px',
                    cursor: day.count > 0 ? 'pointer' : 'default',
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (day.count > 0) e.currentTarget.style.transform = 'scale(1.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                />
              );
            })}
          </div>
        ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginTop: '8px' }}>
        <span>Less</span>
        {[0, 1, 3, 6, 11].map((threshold) => (
          <div
            key={threshold}
            style={{
              width: '17px',
              height: '17px',
              backgroundColor: getColor(threshold),
              borderRadius: '3px',
            }}
          />
        ))}
        <span>More</span>
      </div>

      {/* Modal for Commit Details */}
      {showModal && selectedDate && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px' }}>
                  Contributions on {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
                  {heatmapData[toGMT7DateString(selectedDate)] || 0} commits
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0',
                  lineHeight: '1',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                View commits on GitHub:
              </p>
              {(() => {
                const dateStr = toGMT7DateString(selectedDate);
                const commitsOnDate = memberData?.commitsByDate?.[dateStr] || {};
                const reposWithCommits = Object.keys(commitsOnDate);

                if (reposWithCommits.length === 0) {
                  return (
                    <p style={{ fontSize: '14px', color: '#9ca3af', fontStyle: 'italic' }}>
                      No commit details available for this date
                    </p>
                  );
                }

                return reposWithCommits.map(repoName => {
                  const commits = commitsOnDate[repoName];
                  return (
                    <div key={repoName} style={{ marginBottom: '12px' }}>
                      <a
                        href={`https://github.com/${repoName}/commits?author=${memberData.username}&since=${dateStr}&until=${dateStr}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'block',
                          padding: '12px',
                          backgroundColor: '#f9fafb',
                          borderRadius: '6px',
                          textDecoration: 'none',
                          color: '#111827',
                          border: '1px solid #e5e7eb',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f3f4f6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: 500, display: 'block' }}>{repoName}</span>
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>
                              {commits.length} commit{commits.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#3b82f6' }}>View →</span>
                        </div>
                      </a>
                    </div>
                  );
                });
              })()}
            </div>

            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '16px', fontStyle: 'italic' }}>
              Note: Links show all commits by {memberData?.username} on the selected date. Timezone: GMT+7
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
