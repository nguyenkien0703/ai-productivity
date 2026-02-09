import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { initDB, getCachedData, setCachedData, getSyncMeta, updateSyncMeta } from './db.js';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

// Environment variables
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;
const JIRA_BASE_URL = process.env.VITE_JIRA_BASE_URL;
const JIRA_EMAIL = process.env.VITE_JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.VITE_JIRA_API_TOKEN;
const JIRA_PROJECT_KEY = process.env.VITE_JIRA_PROJECT_KEY || 'AAP';

const GITHUB_REPOS = [
  { owner: 'DefikitTeam', repo: 'lumilink-be' },
  { owner: 'DefikitTeam', repo: 'lumilink-fe' },
  { owner: 'DefikitTeam', repo: 'claude-code-container' },
  { owner: 'DefikitTeam', repo: 'lumibrand-be' },
  { owner: 'DefikitTeam', repo: 'lumilink-product' },
];

// ========== Data Fetching & Caching ==========

/**
 * Fetch all PRs from a single GitHub repo (paginated)
 */
async function fetchGitHubRepoPRs(owner, repo) {
  const prs = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
        params: { state: 'all', per_page: perPage, page },
      }
    );

    if (response.data.length === 0) break;
    prs.push(...response.data);
    if (response.data.length < perPage) break;
    page++;
  }

  return prs.map((pr) => ({ ...pr, repoName: `${owner}/${repo}` }));
}

/**
 * Fetch all commits from a single GitHub repo (paginated)
 */
async function fetchGitHubRepoCommits(owner, repo, since = null) {
  const commits = [];
  let page = 1;
  const perPage = 100;
  const maxPages = 50; // Limit to 5000 commits per repo (increased from 30)

  const params = { per_page: perPage, page };
  if (since) params.since = since;

  while (page <= maxPages) {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits`,
        {
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
          },
          params,
          timeout: 10000, // 10 second timeout per request
        }
      );

      if (response.data.length === 0) break;
      commits.push(...response.data);
      if (response.data.length < perPage) break;
      page++;
      params.page = page;
    } catch (error) {
      console.error(`      Error fetching page ${page} from ${owner}/${repo}:`, error.message);
      break; // Stop on error but return what we have
    }
  }

  return commits.map((c) => ({ ...c, repoName: `${owner}/${repo}` }));
}

/**
 * Fetch all GitHub PRs from all repos and cache to DB
 */
async function fetchAndCacheGitHubData() {
  const allPRs = [];
  for (const { owner, repo } of GITHUB_REPOS) {
    const prs = await fetchGitHubRepoPRs(owner, repo);
    allPRs.push(...prs);
  }
  await setCachedData('github_prs', allPRs);
  console.log(`  GitHub: cached ${allPRs.length} PRs`);
  return allPRs;
}

/**
 * Fetch all GitHub commits from all repos and cache to DB
 */
async function fetchAndCacheGitHubCommits() {
  const allCommits = [];
  try {
    for (const { owner, repo } of GITHUB_REPOS) {
      console.log(`  Fetching commits from ${owner}/${repo}...`);
      const commits = await fetchGitHubRepoCommits(owner, repo);
      console.log(`    → Got ${commits.length} commits from ${owner}/${repo}`);
      allCommits.push(...commits);
    }
    await setCachedData('github_commits', allCommits);
    console.log(`  GitHub: cached ${allCommits.length} commits total`);
    return allCommits;
  } catch (error) {
    console.error('  GitHub commits fetch error:', error.message);
    throw error;
  }
}

/**
 * Helper: Count unique active days from commits (GMT+7)
 */
function countActiveDays(commits) {
  const uniqueDays = new Set(
    commits.map((c) => toGMT7DateString(c.commit.author.date))
  );
  return uniqueDays.size;
}

/**
 * Helper: Calculate current streak (GMT+7)
 */
function calculateStreak(commits) {
  if (commits.length === 0) return 0;

  const dates = [...new Set(commits.map((c) =>
    toGMT7DateString(c.commit.author.date)
  ))].sort().reverse();

  let streak = 0;
  const todayGMT7 = toGMT7DateString(new Date());
  let currentDate = new Date(todayGMT7);

  for (const dateStr of dates) {
    const commitDate = new Date(dateStr);
    const diffDays = Math.floor((currentDate - commitDate) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      streak++;
      currentDate = commitDate;
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Helper: Calculate longest streak (GMT+7)
 */
function calculateLongestStreak(commits) {
  if (commits.length === 0) return 0;

  const dates = [...new Set(commits.map((c) =>
    toGMT7DateString(c.commit.author.date)
  ))].sort();

  let longestStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return longestStreak;
}

/**
 * Helper: Calculate commits per week average
 */
function calculateCommitsPerWeek(commits) {
  if (commits.length === 0) return 0;

  const dates = commits.map((c) => new Date(c.commit.author.date));
  const oldestDate = new Date(Math.min(...dates));
  const newestDate = new Date(Math.max(...dates));
  const weeks = Math.ceil((newestDate - oldestDate) / (1000 * 60 * 60 * 24 * 7)) || 1;

  return (commits.length / weeks).toFixed(1);
}

/**
 * Helper: Find busiest week
 */
function findBusiestWeek(commits) {
  if (commits.length === 0) return { week: 'N/A', commits: 0 };

  const weekMap = {};

  commits.forEach((c) => {
    const date = new Date(c.commit.author.date);
    // Get week start (Monday)
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(date.setDate(diff));
    const weekKey = toGMT7DateString(weekStart);

    weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
  });

  const busiest = Object.entries(weekMap).reduce((max, [week, count]) =>
    count > max.commits ? { week, commits: count } : max
  , { week: 'N/A', commits: 0 });

  return busiest;
}

/**
 * Helper: Generate commits timeline data for chart
 */
function generateCommitsTimeline(commits) {
  const timelineMap = {};

  commits.forEach((c) => {
    const dateStr = toGMT7DateString(c.commit.author.date);
    timelineMap[dateStr] = (timelineMap[dateStr] || 0) + 1;
  });

  // Sort by date
  return Object.entries(timelineMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

/**
 * Helper: Calculate commits per day
 */
function calculateCommitsPerDay(commits) {
  const activeDays = countActiveDays(commits);
  return activeDays > 0 ? commits.length / activeDays : 0;
}

/**
 * Helper: Calculate average merge time
 */
function calculateAvgMergeTime(prs) {
  const merged = prs.filter((pr) => pr.merged_at);
  if (merged.length === 0) return 0;

  const mergeTimes = merged.map((pr) =>
    (new Date(pr.merged_at) - new Date(pr.created_at)) / (1000 * 60 * 60)
  );

  return mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length;
}

/**
 * Helper: Group commits by repo
 */
function groupByRepo(commits) {
  const repoMap = {};
  commits.forEach((c) => {
    const repo = c.repoName;
    repoMap[repo] = (repoMap[repo] || 0) + 1;
  });

  return Object.entries(repoMap)
    .map(([repo, count]) => ({ repo, commits: count }))
    .sort((a, b) => b.commits - a.commits);
}

/**
 * Helper: Group PRs by repo
 */
function groupPRsByRepo(prs) {
  const repoMap = {};
  prs.forEach((pr) => {
    const repo = pr.repoName;
    repoMap[repo] = (repoMap[repo] || 0) + 1;
  });

  return Object.entries(repoMap)
    .map(([repo, count]) => ({ repo, prs: count }))
    .sort((a, b) => b.prs - a.prs);
}

/**
 * Helper: Combine commits and PRs by repo
 */
function combineRepoActivity(commits, prs) {
  const repoMap = {};

  // Add commits
  commits.forEach((c) => {
    const repo = c.repoName;
    if (!repoMap[repo]) {
      repoMap[repo] = { repo, commits: 0, prs: 0 };
    }
    repoMap[repo].commits++;
  });

  // Add PRs
  prs.forEach((pr) => {
    const repo = pr.repoName;
    if (!repoMap[repo]) {
      repoMap[repo] = { repo, commits: 0, prs: 0 };
    }
    repoMap[repo].prs++;
  });

  return Object.values(repoMap)
    .sort((a, b) => (b.commits + b.prs) - (a.commits + a.prs));
}

/**
 * Helper: Analyze working pattern (GMT+7)
 */
function analyzeWorkingPattern(commits) {
  const dayCount = [0, 0, 0, 0, 0, 0, 0];
  const hourCount = Array(24).fill(0);

  commits.forEach((c) => {
    const utcDate = new Date(c.commit.author.date);
    // Convert to GMT+7
    const gmt7Date = new Date(utcDate.getTime() + (7 * 60 * 60 * 1000));
    dayCount[gmt7Date.getUTCDay()]++;
    hourCount[gmt7Date.getUTCHours()]++;
  });

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mostActiveDayIndex = dayCount.indexOf(Math.max(...dayCount));
  const mostActiveHour = hourCount.indexOf(Math.max(...hourCount));

  return {
    mostActiveDay: days[mostActiveDayIndex],
    mostActiveHour: `${mostActiveHour}:00`,
    dayDistribution: dayCount,
    hourDistribution: hourCount,
  };
}

/**
 * Helper: Convert UTC date to GMT+7 date string
 */
function toGMT7DateString(utcDate) {
  const date = new Date(utcDate);
  // Add 7 hours for GMT+7
  date.setHours(date.getHours() + 7);
  return date.toISOString().split('T')[0];
}

/**
 * Helper: Generate heatmap data with commit details (GMT+7 timezone)
 */
function generateHeatmapData(commits) {
  const heatmap = {};
  const commitsByDate = {};

  // Get date range based on commits
  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 2); // Go back 2 years for full data

  // Initialize all dates in GMT+7
  for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = toGMT7DateString(d);
    if (!heatmap[dateStr]) {
      heatmap[dateStr] = 0;
      commitsByDate[dateStr] = {};
    }
  }

  // Process commits with GMT+7 timezone
  commits.forEach((c) => {
    const dateStr = toGMT7DateString(c.commit.author.date);

    if (!heatmap[dateStr]) {
      heatmap[dateStr] = 0;
      commitsByDate[dateStr] = {};
    }

    heatmap[dateStr]++;

    // Group commits by repo for each date
    const repo = c.repoName;
    if (!commitsByDate[dateStr][repo]) {
      commitsByDate[dateStr][repo] = [];
    }
    commitsByDate[dateStr][repo].push({
      sha: c.sha,
      message: c.commit.message,
      url: c.html_url,
    });
  });

  return { heatmap, commitsByDate };
}

/**
 * Calculate member statistics
 */
function calculateMemberStats(commits, prs, pivotDate) {
  const memberMap = new Map();

  commits.forEach((commit) => {
    const username = commit.author?.login ||
                     commit.commit.author.email.split('@')[0];

    if (!memberMap.has(username)) {
      memberMap.set(username, {
        username,
        displayName: commit.author?.login || commit.commit.author.name,
        avatar: commit.author?.avatar_url || null,
        commits: [],
        prs: [],
      });
    }

    memberMap.get(username).commits.push(commit);
  });

  prs.forEach((pr) => {
    const username = pr.user.login;

    if (!memberMap.has(username)) {
      memberMap.set(username, {
        username,
        displayName: pr.user.login,
        avatar: pr.user.avatar_url,
        commits: [],
        prs: [],
      });
    }

    memberMap.get(username).prs.push(pr);
  });

  const members = Array.from(memberMap.values()).map((member) => {
    const commitsBefore = member.commits.filter((c) =>
      new Date(c.commit.author.date) < pivotDate
    );
    const commitsAfter = member.commits.filter((c) =>
      new Date(c.commit.author.date) >= pivotDate
    );

    const prsBefore = member.prs.filter((pr) =>
      new Date(pr.created_at) < pivotDate
    );
    const prsAfter = member.prs.filter((pr) =>
      new Date(pr.created_at) >= pivotDate
    );

    const { heatmap, commitsByDate } = generateHeatmapData(member.commits);

    return {
      username: member.username,
      displayName: member.displayName,
      avatar: member.avatar,
      metrics: {
        commitFrequency: {
          total: member.commits.length,
          before: commitsBefore.length,
          after: commitsAfter.length,
          activeDays: countActiveDays(member.commits),
          currentStreak: calculateStreak(member.commits),
          longestStreak: calculateLongestStreak(member.commits),
          commitsPerDay: calculateCommitsPerDay(commitsAfter),
          commitsPerWeek: calculateCommitsPerWeek(commitsAfter),
          busiestWeek: findBusiestWeek(member.commits),
        },
        prMetrics: {
          created: member.prs.length,
          before: prsBefore.length,
          after: prsAfter.length,
          merged: member.prs.filter((pr) => pr.merged_at).length,
          mergeRate: member.prs.length > 0
            ? member.prs.filter((pr) => pr.merged_at).length / member.prs.length
            : 0,
          avgMergeTimeHours: calculateAvgMergeTime(member.prs),
        },
        repoActivity: combineRepoActivity(member.commits, member.prs),
        workingPattern: analyzeWorkingPattern(member.commits),
      },
      heatmapData: heatmap,
      commitsByDate: commitsByDate,
      commitsTimeline: generateCommitsTimeline(member.commits),
    };
  });

  const filteredMembers = members.filter((m) => {
    const lowerUsername = m.username.toLowerCase();
    return !lowerUsername.includes('bot') &&
           !lowerUsername.includes('[bot]') &&
           !lowerUsername.includes('copilot') &&
           lowerUsername !== 'dependabot' &&
           lowerUsername !== 'renovate' &&
           lowerUsername !== 'github-actions';
  });

  // Calculate team ranking and percentages
  const sortedByCommits = [...filteredMembers].sort((a, b) =>
    b.metrics.commitFrequency.total - a.metrics.commitFrequency.total
  );

  const totalTeamCommits = filteredMembers.reduce((sum, m) =>
    sum + m.metrics.commitFrequency.total, 0
  );

  filteredMembers.forEach((member) => {
    const rank = sortedByCommits.findIndex(m => m.username === member.username) + 1;
    const percentage = totalTeamCommits > 0
      ? ((member.metrics.commitFrequency.total / totalTeamCommits) * 100).toFixed(1)
      : 0;

    member.teamContext = {
      rank,
      totalMembers: filteredMembers.length,
      percentageOfTeam: percentage,
    };
  });

  return filteredMembers;
}

/**
 * Fetch all Jira sprint data and cache to DB
 */
async function fetchAndCacheJiraData() {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${JIRA_API_TOKEN}`,
  };

  // Get boards
  const boardsRes = await axios.get(
    `${JIRA_BASE_URL}/rest/agile/1.0/board`,
    { headers, params: { projectKeyOrId: JIRA_PROJECT_KEY } }
  );
  const boards = boardsRes.data.values || [];
  if (boards.length === 0) {
    console.warn('  Jira: No boards found');
    await setCachedData('jira_sprints', []);
    return [];
  }

  const boardId = boards[0].id;

  // Get sprints
  const sprintsRes = await axios.get(
    `${JIRA_BASE_URL}/rest/agile/1.0/board/${boardId}/sprint`,
    { headers, params: { state: 'closed,active' } }
  );
  const sprints = sprintsRes.data.values || [];

  // Get issues per sprint and calculate metrics
  const sprintData = [];
  for (const sprint of sprints) {
    const issuesRes = await axios.get(
      `${JIRA_BASE_URL}/rest/agile/1.0/sprint/${sprint.id}/issue`,
      { headers, params: { maxResults: 1000 } }
    );
    const issues = issuesRes.data.issues || [];

    let committedPoints = 0;
    let completedPoints = 0;
    for (const issue of issues) {
      const sp =
        issue.fields?.customfield_10031 ||
        issue.fields?.customfield_10016 ||
        issue.fields?.customfield_10100 ||
        0;
      const points = Number(sp) || 0;
      committedPoints += points;
      if (issue.fields?.status?.statusCategory?.key === 'done') {
        completedPoints += points;
      }
    }

    sprintData.push({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      completeDate: sprint.completeDate,
      committedPoints,
      completedPoints,
      completionRate: committedPoints > 0 ? (completedPoints / committedPoints) * 100 : 0,
      issueCount: issues.length,
    });
  }

  sprintData.sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
  await setCachedData('jira_sprints', sprintData);
  console.log(`  Jira: cached ${sprintData.length} sprints`);
  return sprintData;
}

/**
 * Sync all data sources
 */
async function syncAllData() {
  console.log('Syncing all data...');
  const errors = [];

  let githubPRs = [];
  let githubCommits = [];
  let memberStats = null;
  let jiraSprints = [];

  try {
    githubPRs = await fetchAndCacheGitHubData();
  } catch (err) {
    console.error('GitHub PRs sync error:', err.message);
    errors.push({ source: 'github_prs', message: err.message });
  }

  try {
    console.log('Fetching GitHub commits...');
    githubCommits = await fetchAndCacheGitHubCommits();
  } catch (err) {
    console.error('GitHub commits sync error:', err.message);
    errors.push({ source: 'github_commits', message: err.message });
    githubCommits = []; // Continue with empty commits
  }

  try {
    if (githubCommits.length > 0 && githubPRs.length > 0) {
      console.log('Calculating member stats...');
      memberStats = calculateMemberStats(githubCommits, githubPRs, new Date('2025-07-01'));
      await setCachedData('member_stats', memberStats);
      console.log(`  Members: calculated stats for ${memberStats.length} members`);
    } else {
      console.log('  Skipping member stats (no commits or PRs available)');
      memberStats = [];
    }
  } catch (err) {
    console.error('Member stats calculation error:', err.message);
    errors.push({ source: 'member_stats', message: err.message });
    memberStats = []; // Continue with empty stats
  }

  try {
    jiraSprints = await fetchAndCacheJiraData();
  } catch (err) {
    console.error('Jira sync error:', err.message);
    errors.push({ source: 'jira', message: err.message });
  }

  const status = errors.length === 0 ? 'success' : 'partial';
  await updateSyncMeta(status, errors);
  console.log(`Sync complete: ${status}`);

  return { githubPRs, githubCommits, memberStats, jiraSprints, status, errors };
}

// ========== Cache API Endpoints ==========

// GET /api/data/cached — return cached data (auto-sync if no cache)
app.get('/api/data/cached', async (req, res) => {
  try {
    let github = await getCachedData('github_prs');
    let commits = await getCachedData('github_commits');
    let members = await getCachedData('member_stats');
    let jira = await getCachedData('jira_sprints');

    // If no cache exists, trigger a sync
    if (!github || !commits || !jira) {
      console.log('No cache found, triggering initial sync...');
      const result = await syncAllData();
      return res.json({
        githubPRs: result.githubPRs,
        jiraSprints: result.jiraSprints,
        memberStats: result.memberStats,
        syncMeta: await getSyncMeta(),
      });
    }

    const syncMeta = await getSyncMeta();
    res.json({
      githubPRs: github.data,
      jiraSprints: jira.data,
      memberStats: members?.data || [],
      syncMeta,
    });
  } catch (error) {
    console.error('Cache read error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/data/sync — manual sync trigger
app.post('/api/data/sync', async (req, res) => {
  try {
    const result = await syncAllData();
    const syncMeta = await getSyncMeta();
    res.json({
      githubPRs: result.githubPRs,
      jiraSprints: result.jiraSprints,
      memberStats: result.memberStats,
      syncMeta,
    });
  } catch (error) {
    console.error('Sync error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/data/sync/stream — SSE sync with progress
app.get('/api/data/sync/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const errors = [];
  let githubPRs = [];
  let githubCommits = [];
  let memberStats = null;
  let jiraSprints = [];

  // Step 1: GitHub PRs
  send('progress', { step: 'github_prs', status: 'syncing', message: 'Fetching GitHub PRs...' });
  try {
    githubPRs = await fetchAndCacheGitHubData();
    send('progress', { step: 'github_prs', status: 'done', message: `GitHub: ${githubPRs.length} PRs synced` });
  } catch (err) {
    errors.push({ source: 'github_prs', message: err.message });
    send('progress', { step: 'github_prs', status: 'error', message: `GitHub PRs error: ${err.message}` });
  }

  // Step 2: GitHub Commits
  send('progress', { step: 'github_commits', status: 'syncing', message: 'Fetching GitHub commits...' });
  try {
    githubCommits = await fetchAndCacheGitHubCommits();
    send('progress', { step: 'github_commits', status: 'done', message: `GitHub: ${githubCommits.length} commits synced` });
  } catch (err) {
    errors.push({ source: 'github_commits', message: err.message });
    send('progress', { step: 'github_commits', status: 'error', message: `GitHub commits error: ${err.message}` });
  }

  // Step 3: Calculate Member Stats
  send('progress', { step: 'member_stats', status: 'syncing', message: 'Calculating member statistics...' });
  try {
    memberStats = calculateMemberStats(githubCommits, githubPRs, new Date('2025-07-01'));
    await setCachedData('member_stats', memberStats);
    send('progress', { step: 'member_stats', status: 'done', message: `Calculated stats for ${memberStats.length} members` });
  } catch (err) {
    errors.push({ source: 'member_stats', message: err.message });
    send('progress', { step: 'member_stats', status: 'error', message: `Member stats error: ${err.message}` });
  }

  // Step 4: Jira
  send('progress', { step: 'jira', status: 'syncing', message: 'Fetching Jira sprints...' });
  try {
    jiraSprints = await fetchAndCacheJiraData();
    send('progress', { step: 'jira', status: 'done', message: `Jira: ${jiraSprints.length} sprints synced` });
  } catch (err) {
    errors.push({ source: 'jira', message: err.message });
    send('progress', { step: 'jira', status: 'error', message: `Jira error: ${err.message}` });
  }

  // Step 5: Save meta & complete
  const status = errors.length === 0 ? 'success' : 'partial';
  await updateSyncMeta(status, errors);
  const syncMeta = await getSyncMeta();

  send('complete', {
    status,
    errors,
    syncMeta,
    githubPRs,
    jiraSprints,
    memberStats,
  });

  res.end();
});

// GET /api/data/status — sync metadata
app.get('/api/data/status', async (req, res) => {
  try {
    const syncMeta = await getSyncMeta();
    res.json(syncMeta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== Existing Proxy Endpoints ==========

// GitHub API Proxy
app.get(/^\/api\/github\/(.*)$/, async (req, res) => {
  try {
    const path = req.params[0];
    const response = await axios.get(`https://api.github.com/${path}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
      params: req.query,
    });
    res.json(response.data);
  } catch (error) {
    console.error('GitHub API error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
});

// Jira API Proxy
app.get(/^\/api\/jira\/(.*)$/, async (req, res) => {
  try {
    const path = req.params[0];
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JIRA_API_TOKEN}`,
    };

    const response = await axios.get(`${JIRA_BASE_URL}/${path}`, {
      headers,
      params: req.query,
    });
    res.json(response.data);
  } catch (error) {
    console.error('Jira API error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  const syncMeta = await getSyncMeta().catch(() => null);
  res.json({
    status: 'ok',
    github: !!GITHUB_TOKEN,
    jira: !!JIRA_BASE_URL && !!JIRA_EMAIL && !!JIRA_API_TOKEN,
    database: !!process.env.DATABASE_URL,
    lastSync: syncMeta?.lastSyncAt || null,
  });
});

// Serve static files in production
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // Fallback to index.html for SPA routing (Express 5 compatible)
  app.use((req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// ========== Start Server ==========

async function startServer() {
  // Initialize database tables
  try {
    await initDB();
    console.log('Database initialized');
  } catch (err) {
    console.error('Database init error:', err.message);
    console.error('Make sure DATABASE_URL is set and PostgreSQL is running');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`\nServer running on http://localhost:${PORT}`);
    console.log('\nConfiguration:');
    console.log('   GitHub Token:', GITHUB_TOKEN ? 'configured' : 'missing');
    console.log('   Jira URL:', JIRA_BASE_URL || 'missing');
    console.log('   Jira Email:', JIRA_EMAIL || 'missing');
    console.log('   Jira Token:', JIRA_API_TOKEN ? 'configured' : 'missing');
    console.log('   Database:', process.env.DATABASE_URL ? 'configured' : 'missing');

    if (existsSync(distPath)) {
      console.log('\nProduction mode: Serving static files from /dist');
    } else {
      console.log('\nDevelopment mode: Run "npm run dev" for frontend');
    }
  });

  // Schedule daily sync (every 24 hours)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    console.log('Running scheduled daily sync...');
    try {
      await syncAllData();
    } catch (err) {
      console.error('Scheduled sync error:', err.message);
    }
  }, TWENTY_FOUR_HOURS);
}

startServer();
