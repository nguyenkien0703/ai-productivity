/**
 * Calculate sprint metrics from issues
 * @param {Array} issues - Sprint issues
 * @returns {Object} - Sprint metrics
 */
export function calculateSprintMetrics(issues) {
  let committedPoints = 0;
  let completedPoints = 0;

  issues.forEach((issue) => {
    const storyPoints = issue.fields?.customfield_10031 ||
                       issue.fields?.customfield_10016 ||
                       issue.fields?.customfield_10100 ||
                       0;

    committedPoints += Number(storyPoints) || 0;

    const status = issue.fields?.status?.statusCategory?.key;
    if (status === 'done') {
      completedPoints += Number(storyPoints) || 0;
    }
  });

  const completionRate = committedPoints > 0 ? (completedPoints / committedPoints) * 100 : 0;

  return {
    committedPoints,
    completedPoints,
    completionRate,
    issueCount: issues.length,
  };
}

/**
 * Get sprint statistics before and after a date
 * @param {Array} sprints - Array of sprint data
 * @param {Date} pivotDate - Date to split before/after
 * @returns {Object} - Statistics object
 */
export function calculateSprintStats(sprints, pivotDate) {
  const before = sprints.filter((s) => new Date(s.endDate || s.completeDate || s.end_date || s.complete_date) < pivotDate);
  const after = sprints.filter((s) => new Date(s.endDate || s.completeDate || s.end_date || s.complete_date) >= pivotDate);

  const avgCompletionBefore =
    before.length > 0
      ? before.reduce((sum, s) => sum + (s.completionRate ?? s.completion_rate ?? 0), 0) / before.length
      : 0;

  const avgCompletionAfter =
    after.length > 0
      ? after.reduce((sum, s) => sum + (s.completionRate ?? s.completion_rate ?? 0), 0) / after.length
      : 0;

  const avgPointsBefore =
    before.length > 0
      ? before.reduce((sum, s) => sum + (s.completedPoints ?? s.completed_points ?? 0), 0) / before.length
      : 0;

  const avgPointsAfter =
    after.length > 0
      ? after.reduce((sum, s) => sum + (s.completedPoints ?? s.completed_points ?? 0), 0) / after.length
      : 0;

  return {
    sprintCountBefore: before.length,
    sprintCountAfter: after.length,
    avgCompletionBefore,
    avgCompletionAfter,
    avgPointsBefore,
    avgPointsAfter,
    totalPointsBefore: before.reduce((sum, s) => sum + (s.completedPoints ?? s.completed_points ?? 0), 0),
    totalPointsAfter: after.reduce((sum, s) => sum + (s.completedPoints ?? s.completed_points ?? 0), 0),
  };
}
