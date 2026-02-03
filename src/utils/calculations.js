/**
 * Calculate percentage improvement between two values
 * @param {number} before - Value before
 * @param {number} after - Value after
 * @param {boolean} lowerIsBetter - If true, lower values are better (e.g., merge time)
 * @returns {number} - Percentage improvement
 */
export function calculateImprovement(before, after, lowerIsBetter = false) {
  if (before === 0) return after === 0 ? 0 : 100;

  if (lowerIsBetter) {
    // For metrics where lower is better (time-based)
    return ((before - after) / before) * 100;
  }

  // For metrics where higher is better (counts, rates)
  return ((after - before) / before) * 100;
}

/**
 * Calculate time saved based on improvement
 * @param {number} beforeTime - Average time before (hours)
 * @param {number} afterTime - Average time after (hours)
 * @param {number} count - Number of items (e.g., PRs)
 * @returns {Object} - Time saved in various units
 */
export function calculateTimeSaved(beforeTime, afterTime, count) {
  const timeSavedPerItem = beforeTime - afterTime;
  const totalHoursSaved = timeSavedPerItem * count;

  return {
    perItem: timeSavedPerItem,
    totalHours: totalHoursSaved,
    totalDays: totalHoursSaved / 8, // Assuming 8-hour workday
    totalWeeks: totalHoursSaved / 40, // Assuming 40-hour workweek
  };
}

/**
 * Calculate estimated cost savings
 * @param {number} hoursSaved - Total hours saved
 * @param {number} hourlyRate - Hourly rate in currency
 * @returns {number} - Total cost savings
 */
export function calculateCostSavings(hoursSaved, hourlyRate) {
  return hoursSaved * hourlyRate;
}

/**
 * Format hours to human-readable string
 * @param {number} hours - Hours to format
 * @returns {string} - Formatted string
 */
export function formatHours(hours) {
  if (hours < 1) {
    return `${Math.round(hours * 60)} minutes`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)} hours`;
  }
  const days = hours / 24;
  if (days < 7) {
    return `${days.toFixed(1)} days`;
  }
  return `${(days / 7).toFixed(1)} weeks`;
}

/**
 * Format percentage with sign
 * @param {number} percentage - Percentage value
 * @returns {string} - Formatted string with sign
 */
export function formatPercentage(percentage) {
  const sign = percentage >= 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
}

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} - Formatted currency string
 */
export function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculate comprehensive metrics summary
 * @param {Object} prStats - PR statistics
 * @param {Object} sprintStats - Sprint statistics
 * @param {number} hourlyRate - Optional hourly rate for cost calculations
 * @returns {Object} - Comprehensive summary
 */
export function calculateSummary(prStats, sprintStats, hourlyRate = 50) {
  const prCountImprovement = calculateImprovement(
    prStats.prCountBefore,
    prStats.prCountAfter
  );

  const mergeTimeImprovement = calculateImprovement(
    prStats.avgMergeTimeBefore,
    prStats.avgMergeTimeAfter,
    true // Lower is better
  );

  const reviewTimeImprovement = calculateImprovement(
    prStats.avgReviewTimeBefore,
    prStats.avgReviewTimeAfter,
    true // Lower is better
  );

  const completionRateImprovement = calculateImprovement(
    sprintStats.avgCompletionBefore,
    sprintStats.avgCompletionAfter
  );

  const storyPointsImprovement = calculateImprovement(
    sprintStats.avgPointsBefore,
    sprintStats.avgPointsAfter
  );

  // Calculate time saved from merge time improvement
  const timeSaved = calculateTimeSaved(
    prStats.avgMergeTimeBefore,
    prStats.avgMergeTimeAfter,
    prStats.mergedCountAfter
  );

  const costSavings = calculateCostSavings(timeSaved.totalHours, hourlyRate);

  return {
    improvements: {
      prCount: prCountImprovement,
      mergeTime: mergeTimeImprovement,
      reviewTime: reviewTimeImprovement,
      completionRate: completionRateImprovement,
      storyPoints: storyPointsImprovement,
    },
    timeSaved,
    costSavings,
    overallImprovement:
      (prCountImprovement +
        mergeTimeImprovement +
        completionRateImprovement +
        storyPointsImprovement) /
      4,
  };
}

/**
 * Get month labels for chart
 * @param {Array} data - Monthly data array
 * @returns {Array} - Formatted month labels
 */
export function getMonthLabels(data) {
  return data.map((item) => {
    const [year, month] = item.month.split('-');
    // Format: "Jan '25" or "Jan '26"
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[parseInt(month) - 1];
    const shortYear = year.slice(-2);
    return `${monthName} '${shortYear}`;
  });
}

/**
 * Determine if a date is before or after the pivot date
 * @param {string|Date} date - Date to check
 * @param {Date} pivotDate - Pivot date
 * @returns {string} - 'before' or 'after'
 */
export function getPeriod(date, pivotDate) {
  return new Date(date) < pivotDate ? 'before' : 'after';
}

export default {
  calculateImprovement,
  calculateTimeSaved,
  calculateCostSavings,
  formatHours,
  formatPercentage,
  formatCurrency,
  calculateSummary,
  getMonthLabels,
  getPeriod,
};
