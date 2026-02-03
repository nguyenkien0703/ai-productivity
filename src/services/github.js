// Use relative URL - works with Vite proxy in dev and same-origin in production
const API_BASE = '/api/github';

const REPOS = [
  { owner: 'DefikitTeam', repo: 'lumilink-be' },
  { owner: 'DefikitTeam', repo: 'lumilink-fe' },
];

/**
 * Fetch all PRs from a repository via proxy
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Array>} - Array of PR objects
 */
async function fetchAllPRs(owner, repo) {
  const prs = [];
  let page = 1;
  const perPage = 100;

  try {
    while (true) {
      const response = await fetch(
        `${API_BASE}/repos/${owner}/${repo}/pulls?state=all&per_page=${perPage}&page=${page}`
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      if (data.length === 0) break;

      prs.push(...data);
      if (data.length < perPage) break;
      page++;
    }
  } catch (error) {
    console.error(`Error fetching PRs from ${owner}/${repo}:`, error.message);
    throw error;
  }

  return prs;
}

/**
 * Fetch PR reviews for a specific PR
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} prNumber - PR number
 * @returns {Promise<Array>} - Array of review objects
 */
async function fetchPRReviews(owner, repo, prNumber) {
  try {
    const response = await fetch(
      `${API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching reviews for PR #${prNumber}:`, error.message);
    return [];
  }
}

/**
 * Fetch all PRs from all configured repositories
 * @returns {Promise<Array>} - Combined array of PRs from all repos
 */
export async function fetchAllRepoPRs() {
  const allPRs = [];

  for (const { owner, repo } of REPOS) {
    const prs = await fetchAllPRs(owner, repo);
    const prsWithRepo = prs.map((pr) => ({
      ...pr,
      repoName: `${owner}/${repo}`,
    }));
    allPRs.push(...prsWithRepo);
  }

  return allPRs;
}

/**
 * Fetch PRs with their first review time
 * @returns {Promise<Array>} - PRs with review data
 */
export async function fetchPRsWithReviews() {
  const allPRs = [];

  for (const { owner, repo } of REPOS) {
    const prs = await fetchAllPRs(owner, repo);

    for (const pr of prs) {
      const reviews = await fetchPRReviews(owner, repo, pr.number);
      const firstReview = reviews.length > 0
        ? reviews.reduce((earliest, review) =>
            new Date(review.submitted_at) < new Date(earliest.submitted_at) ? review : earliest
          )
        : null;

      allPRs.push({
        ...pr,
        repoName: `${owner}/${repo}`,
        firstReviewAt: firstReview?.submitted_at || null,
      });
    }
  }

  return allPRs;
}

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
    if (!pr.firstReviewAt) return null;
    return (new Date(pr.firstReviewAt) - new Date(pr.created_at)) / (1000 * 60 * 60);
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

export default {
  fetchAllRepoPRs,
  fetchPRsWithReviews,
  calculatePRStats,
  getPRsByMonth,
};
