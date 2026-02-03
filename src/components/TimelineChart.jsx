import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { getMonthLabels } from '../utils/calculations';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Register annotation plugin if available
try {
  ChartJS.register(annotationPlugin);
} catch (e) {
  console.warn('Annotation plugin not available');
}

/**
 * Line chart showing metrics over time with pivot date annotation
 */
export default function TimelineChart({ monthlyData, pivotDate }) {
  const labels = getMonthLabels(monthlyData);

  // Find the index of the pivot month
  const pivotMonth = `${pivotDate.getFullYear()}-${String(pivotDate.getMonth() + 1).padStart(2, '0')}`;
  const pivotIndex = monthlyData.findIndex((d) => d.month >= pivotMonth);

  const data = {
    labels,
    datasets: [
      {
        label: 'PRs Created',
        data: monthlyData.map((d) => d.prCount),
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'PRs Merged',
        data: monthlyData.map((d) => d.mergedCount),
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Avg Merge Time (hrs)',
        data: monthlyData.map((d) => d.avgMergeTime),
        borderColor: 'rgba(249, 115, 22, 1)',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
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
        text: 'Monthly Trends',
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

            if (label.includes('Time')) {
              return `${label}: ${value.toFixed(1)} hours`;
            }
            return `${label}: ${value}`;
          },
        },
      },
      annotation: pivotIndex >= 0 ? {
        annotations: {
          line1: {
            type: 'line',
            xMin: pivotIndex,
            xMax: pivotIndex,
            borderColor: 'rgba(239, 68, 68, 0.7)',
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: 'Join Date',
              position: 'start',
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              color: 'white',
              font: {
                size: 11,
              },
            },
          },
        },
      } : {},
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Count',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Hours',
        },
        grid: {
          drawOnChartArea: false,
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
      <Line data={data} options={options} />
    </div>
  );
}
