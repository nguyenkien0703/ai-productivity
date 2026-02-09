/**
 * Get PR statistics grouped by time period
 * @param {Array} prs - Array of PR objects
 * @param {Date} pivotDate - Date to split before/after
 * @returns {Object} - Statistics object
 */
export function calculatePRStats(prs, pivotDate) {
  const before = prs.filter((pr) => new Date(pr.created_at) < pivotDate);
  const after = prs.filter((pr) => new Date(pr.created_at) >= pivotDate);

  const mergedBefore = before.filter((pr) => pr.merged_at);
  const mergedAfter = after.filter((pr) => pr.merged_at);

  const getMergeTime = (pr) => {
    if (!pr.merged_at) return null;
    return (new Date(pr.merged_at) - new Date(pr.created_at)) / (1000 * 60 * 60);
  };

  const beforeMergeTimes = mergedBefore.map(getMergeTime).filter(Boolean);
  const afterMergeTimes = mergedAfter.map(getMergeTime).filter(Boolean);

  const avgMergeTimeBefore =
    beforeMergeTimes.length > 0
      ? beforeMergeTimes.reduce((a, b) => a + b, 0) / beforeMergeTimes.length
      : 0;

  const avgMergeTimeAfter =
    afterMergeTimes.length > 0
      ? afterMergeTimes.reduce((a, b) => a + b, 0) / afterMergeTimes.length
      : 0;

  const getReviewTime = (pr) => {
    if (!pr.firstReviewAt && !pr.first_review_at) return null;
    const reviewAt = pr.firstReviewAt || pr.first_review_at;
    return (new Date(reviewAt) - new Date(pr.created_at)) / (1000 * 60 * 60);
  };

  const beforeReviewTimes = before.map(getReviewTime).filter(Boolean);
  const afterReviewTimes = after.map(getReviewTime).filter(Boolean);

  const avgReviewTimeBefore =
    beforeReviewTimes.length > 0
      ? beforeReviewTimes.reduce((a, b) => a + b, 0) / beforeReviewTimes.length
      : 0;

  const avgReviewTimeAfter =
    afterReviewTimes.length > 0
      ? afterReviewTimes.reduce((a, b) => a + b, 0) / afterReviewTimes.length
      : 0;

  return {
    prCountBefore: before.length,
    prCountAfter: after.length,
    mergedCountBefore: mergedBefore.length,
    mergedCountAfter: mergedAfter.length,
    avgMergeTimeBefore,
    avgMergeTimeAfter,
    avgReviewTimeBefore,
    avgReviewTimeAfter,
  };
}

/**
 * Get PR data grouped by month
 * @param {Array} prs - Array of PR objects
 * @returns {Array} - Monthly data
 */
export function getPRsByMonth(prs) {
  const monthlyData = {};

  prs.forEach((pr) => {
    const date = new Date(pr.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        prCount: 0,
        mergedCount: 0,
        totalMergeTime: 0,
        mergedWithTime: 0,
      };
    }

    monthlyData[monthKey].prCount++;
    if (pr.merged_at) {
      monthlyData[monthKey].mergedCount++;
      const mergeTime = (new Date(pr.merged_at) - new Date(pr.created_at)) / (1000 * 60 * 60);
      monthlyData[monthKey].totalMergeTime += mergeTime;
      monthlyData[monthKey].mergedWithTime++;
    }
  });

  return Object.values(monthlyData)
    .map((data) => ({
      ...data,
      avgMergeTime: data.mergedWithTime > 0 ? data.totalMergeTime / data.mergedWithTime : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
