import { formatPercentage, formatHours } from '../utils/calculations';

/**
 * Card component to display a single metric with before/after comparison
 */
export default function MetricCard({
  title,
  beforeValue,
  afterValue,
  improvement,
  unit = '',
  format = 'number',
  lowerIsBetter = false,
  icon = null,
}) {
  const isPositive = lowerIsBetter ? improvement > 0 : improvement > 0;
  const improvementColor = isPositive ? '#10b981' : '#ef4444';

  const formatValue = (value) => {
    switch (format) {
      case 'hours':
        return formatHours(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'decimal':
        return value.toFixed(1);
      default:
        return Math.round(value).toString();
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        {icon && <span style={{ fontSize: '20px' }}>{icon}</span>}
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 500,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </h3>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '16px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '12px',
              color: '#9ca3af',
              marginBottom: '4px',
            }}
          >
            Before
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#374151',
            }}
          >
            {formatValue(beforeValue)}
            {unit && <span style={{ fontSize: '14px', marginLeft: '4px' }}>{unit}</span>}
          </div>
        </div>

        <div
          style={{
            fontSize: '24px',
            color: '#d1d5db',
          }}
        >
          →
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '12px',
              color: '#9ca3af',
              marginBottom: '4px',
            }}
          >
            After
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#111827',
            }}
          >
            {formatValue(afterValue)}
            {unit && <span style={{ fontSize: '14px', marginLeft: '4px' }}>{unit}</span>}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 12px',
          backgroundColor: isPositive ? '#ecfdf5' : '#fef2f2',
          borderRadius: '8px',
        }}
      >
        <span
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: improvementColor,
          }}
        >
          {formatPercentage(improvement)}
        </span>
        <span
          style={{
            marginLeft: '8px',
            fontSize: '12px',
            color: '#6b7280',
          }}
        >
          {isPositive ? 'improvement' : 'decline'}
        </span>
      </div>
    </div>
  );
}
