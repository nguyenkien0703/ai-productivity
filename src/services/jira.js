// Use relative URL - works with Vite proxy in dev and same-origin in production
const API_BASE = '/api/jira';
const PROJECT_KEY = import.meta.env.VITE_JIRA_PROJECT_KEY || 'AAP';

/**
 * Fetch data from Jira API via proxy
 * @param {string} endpoint - API endpoint
 * @returns {Promise<Object>} - API response
 */
async function jiraFetch(endpoint) {
  const response = await fetch(`${API_BASE}/${endpoint}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Jira API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get all boards for the project
 * @returns {Promise<Array>} - Array of boards
 */
export async function getBoards() {
  try {
    const data = await jiraFetch(`rest/agile/1.0/board?projectKeyOrId=${PROJECT_KEY}`);
    return data.values || [];
  } catch (error) {
    console.error('Error fetching boards:', error.message);
    return [];
  }
}

/**
 * Get all sprints for a board
 * @param {number} boardId - Board ID
 * @returns {Promise<Array>} - Array of sprints
 */
export async function getSprints(boardId) {
  try {
    const data = await jiraFetch(`rest/agile/1.0/board/${boardId}/sprint?state=closed,active`);
    return data.values || [];
  } catch (error) {
    console.error('Error fetching sprints:', error.message);
    return [];
  }
}

/**
 * Get issues in a sprint
 * @param {number} sprintId - Sprint ID
 * @returns {Promise<Array>} - Array of issues
 */
export async function getSprintIssues(sprintId) {
  try {
    const data = await jiraFetch(`rest/agile/1.0/sprint/${sprintId}/issue?maxResults=1000`);
    return data.issues || [];
  } catch (error) {
    console.error('Error fetching sprint issues:', error.message);
    return [];
  }
}

/**
 * Get sprint report data
 * @param {number} boardId - Board ID
 * @param {number} sprintId - Sprint ID
 * @returns {Promise<Object>} - Sprint report
 */
export async function getSprintReport(boardId, sprintId) {
  try {
    return await jiraFetch(
      `rest/greenhopper/1.0/rapid/charts/sprintreport?rapidViewId=${boardId}&sprintId=${sprintId}`
    );
  } catch (error) {
    console.error('Error fetching sprint report:', error.message);
    return null;
  }
}

/**
 * Calculate sprint metrics
 * @param {Array} issues - Sprint issues
 * @returns {Object} - Sprint metrics
 */
export function calculateSprintMetrics(issues) {
  let committedPoints = 0;
  let completedPoints = 0;

  issues.forEach((issue) => {
    // Story Points field for this Jira instance
    const storyPoints = issue.fields?.customfield_10031 || // Story Points
                       issue.fields?.customfield_10016 ||  // Story point estimate
                       issue.fields?.customfield_10100 ||  // Original story points
                       0;

    committedPoints += Number(storyPoints) || 0;

    // Check if issue is done
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
 * Fetch all sprint data for the project
 * @returns {Promise<Array>} - Array of sprint data with metrics
 */
export async function fetchAllSprintData() {
  const boards = await getBoards();
  if (boards.length === 0) {
    console.warn('No boards found for project:', PROJECT_KEY);
    return [];
  }

  const sprintData = [];
  const boardId = boards[0].id;

  const sprints = await getSprints(boardId);

  for (const sprint of sprints) {
    const issues = await getSprintIssues(sprint.id);
    const metrics = calculateSprintMetrics(issues);

    sprintData.push({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      completeDate: sprint.completeDate,
      ...metrics,
    });
  }

  return sprintData.sort((a, b) =>
    new Date(a.startDate || 0) - new Date(b.startDate || 0)
  );
}

/**
 * Get sprint statistics before and after a date
 * @param {Array} sprints - Array of sprint data
 * @param {Date} pivotDate - Date to split before/after
 * @returns {Object} - Statistics object
 */
export function calculateSprintStats(sprints, pivotDate) {
  const before = sprints.filter((s) => new Date(s.endDate || s.completeDate) < pivotDate);
  const after = sprints.filter((s) => new Date(s.endDate || s.completeDate) >= pivotDate);

  const avgCompletionBefore =
    before.length > 0
      ? before.reduce((sum, s) => sum + s.completionRate, 0) / before.length
      : 0;

  const avgCompletionAfter =
    after.length > 0
      ? after.reduce((sum, s) => sum + s.completionRate, 0) / after.length
      : 0;

  const avgPointsBefore =
    before.length > 0
      ? before.reduce((sum, s) => sum + s.completedPoints, 0) / before.length
      : 0;

  const avgPointsAfter =
    after.length > 0
      ? after.reduce((sum, s) => sum + s.completedPoints, 0) / after.length
      : 0;

  return {
    sprintCountBefore: before.length,
    sprintCountAfter: after.length,
    avgCompletionBefore,
    avgCompletionAfter,
    avgPointsBefore,
    avgPointsAfter,
    totalPointsBefore: before.reduce((sum, s) => sum + s.completedPoints, 0),
    totalPointsAfter: after.reduce((sum, s) => sum + s.completedPoints, 0),
  };
}

export default {
  getBoards,
  getSprints,
  getSprintIssues,
  getSprintReport,
  fetchAllSprintData,
  calculateSprintMetrics,
  calculateSprintStats,
};
