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

// Re-export shared calculation functions
export { calculatePRStats, getPRsByMonth } from '../../shared/github-calculations.js';
import { calculatePRStats, getPRsByMonth } from '../../shared/github-calculations.js';

export default {
  fetchAllRepoPRs,
  fetchPRsWithReviews,
  calculatePRStats,
  getPRsByMonth,
};
