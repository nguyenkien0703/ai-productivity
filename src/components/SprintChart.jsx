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
 * Bar chart showing sprint completion rates and story points
 */
export default function SprintChart({ sprintData, pivotDate }) {
  // Prepare labels and data
  const labels = sprintData.map((sprint) => sprint.name);
  const completionRates = sprintData.map((sprint) => sprint.completionRate);
  const storyPoints = sprintData.map((sprint) => sprint.completedPoints);

  // Determine which sprints are before/after pivot
  const backgroundColors = sprintData.map((sprint) => {
    const sprintEnd = new Date(sprint.endDate || sprint.completeDate);
    return sprintEnd < pivotDate
      ? 'rgba(156, 163, 175, 0.8)' // Gray for before
      : 'rgba(16, 185, 129, 0.8)'; // Green for after
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'Completion Rate (%)',
        data: completionRates,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors.map((c) => c.replace('0.8', '1')),
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: 'y',
      },
      {
        label: 'Story Points Completed',
        data: storyPoints,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        borderRadius: 6,
        yAxisID: 'y1',
        type: 'bar',
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
        text: 'Sprint Performance',
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

            if (label.includes('%')) {
              return `${label}: ${value.toFixed(1)}%`;
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
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        min: 0,
        max: 100,
        title: {
          display: true,
          text: 'Completion Rate (%)',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        min: 0,
        title: {
          display: true,
          text: 'Story Points',
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
      <Bar data={data} options={options} />
    </div>
  );
}
