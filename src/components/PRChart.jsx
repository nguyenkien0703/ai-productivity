import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * Bar chart comparing PR metrics before and after the pivot date
 */
export default function PRChart({ prStats }) {
  const data = {
    labels: ['PR Count', 'Merged PRs', 'Avg Merge Time (hrs)', 'Avg Review Time (hrs)'],
    datasets: [
      {
        label: 'Before (Pre-Join)',
        data: [
          prStats.prCountBefore,
          prStats.mergedCountBefore,
          prStats.avgMergeTimeBefore,
          prStats.avgReviewTimeBefore,
        ],
        backgroundColor: 'rgba(156, 163, 175, 0.8)',
        borderColor: 'rgba(156, 163, 175, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'After (Post-Join)',
        data: [
          prStats.prCountAfter,
          prStats.mergedCountAfter,
          prStats.avgMergeTimeAfter,
          prStats.avgReviewTimeAfter,
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: 'Pull Request Metrics Comparison',
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.dataset.label || '';
            const value = context.raw;
            const dataIndex = context.dataIndex;

            if (dataIndex >= 2) {
              return `${label}: ${value.toFixed(1)} hours`;
            }
            return `${label}: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
    },
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        border: '1px solid #e5e7eb',
        height: '400px',
      }}
    >
      <Bar data={data} options={options} />
    </div>
  );
}
