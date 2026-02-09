import axios from 'axios';
import {
  upsertPRsBatch,
  upsertSprintsBatch,
  setSyncStatus,
  getSyncStatus,
} from './db.js';
import { calculateSprintMetrics } from '../shared/jira-calculations.js';

// Read env vars lazily (after dotenv has loaded)
function getEnv() {
  return {
    GITHUB_TOKEN: process.env.VITE_GITHUB_TOKEN,
    JIRA_BASE_URL: process.env.VITE_JIRA_BASE_URL,
    JIRA_API_TOKEN: process.env.VITE_JIRA_API_TOKEN,
    JIRA_PROJECT_KEY: process.env.VITE_JIRA_PROJECT_KEY || 'AAP',
  };
}

const REPOS = [
  { owner: 'DefikitTeam', repo: 'lumilink-be' },
  { owner: 'DefikitTeam', repo: 'lumilink-fe' },
];

let syncInProgress = { github: false, jira: false };

// --- GitHub Sync ---

async function fetchAllGitHubPRs(owner, repo) {
  const { GITHUB_TOKEN } = getEnv();
  const prs = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
      params: { state: 'all', per_page: perPage, page },
    });

    if (response.data.length === 0) break;
    prs.push(...response.data);
    if (response.data.length < perPage) break;
    page++;
  }

  return prs;
}

export async function syncGitHub() {
  if (syncInProgress.github) {
    console.log('   GitHub sync already in progress, skipping');
    return;
  }

  syncInProgress.github = true;
  const startTime = Date.now();

  try {
    setSyncStatus('github', 'in_progress');
    console.log('   Starting GitHub sync...');

    const allPRs = [];

    for (const { owner, repo } of REPOS) {
      const repoName = `${owner}/${repo}`;
      const prs = await fetchAllGitHubPRs(owner, repo);

      for (const pr of prs) {
        allPRs.push({
          id: pr.id,
          number: pr.number,
          repo_name: repoName,
          title: pr.title,
          state: pr.state,
          user_login: pr.user?.login || '',
          created_at: pr.created_at,
          merged_at: pr.merged_at || null,
          first_review_at: null,
        });
      }
    }

    if (allPRs.length > 0) {
      upsertPRsBatch(allPRs);
    }

    const durationMs = Date.now() - startTime;
    setSyncStatus('github', 'success', null, durationMs);
    console.log(`   GitHub sync completed: ${allPRs.length} PRs in ${durationMs}ms`);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    setSyncStatus('github', 'error', error.message, durationMs);
    console.error('   GitHub sync error:', error.message);
  } finally {
    syncInProgress.github = false;
  }
}

// --- Jira Sync ---

async function jiraGet(path) {
  const { JIRA_BASE_URL, JIRA_API_TOKEN } = getEnv();
  const response = await axios.get(`${JIRA_BASE_URL}/${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JIRA_API_TOKEN}`,
    },
  });
  return response.data;
}

export async function syncJira() {
  if (syncInProgress.jira) {
    console.log('   Jira sync already in progress, skipping');
    return;
  }

  syncInProgress.jira = true;
  const startTime = Date.now();

  try {
    setSyncStatus('jira', 'in_progress');
    console.log('   Starting Jira sync...');

    const { JIRA_PROJECT_KEY } = getEnv();
    const boardsData = await jiraGet(`rest/agile/1.0/board?projectKeyOrId=${JIRA_PROJECT_KEY}`);
    const boards = boardsData.values || [];

    if (boards.length === 0) {
      console.warn('   No Jira boards found');
      setSyncStatus('jira', 'success', 'No boards found', Date.now() - startTime);
      syncInProgress.jira = false;
      return;
    }

    const boardId = boards[0].id;
    const sprintsData = await jiraGet(`rest/agile/1.0/board/${boardId}/sprint?state=closed,active`);
    const sprints = sprintsData.values || [];

    const sprintRecords = [];

    for (const sprint of sprints) {
      const issuesData = await jiraGet(`rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=1000`);
      const issues = issuesData.issues || [];
      const metrics = calculateSprintMetrics(issues);

      sprintRecords.push({
        id: sprint.id,
        board_id: boardId,
        name: sprint.name,
        state: sprint.state,
        start_date: sprint.startDate || null,
        end_date: sprint.endDate || null,
        complete_date: sprint.completeDate || null,
        committed_points: metrics.committedPoints,
        completed_points: metrics.completedPoints,
        completion_rate: metrics.completionRate,
        issue_count: metrics.issueCount,
      });
    }

    if (sprintRecords.length > 0) {
      upsertSprintsBatch(sprintRecords);
    }

    const durationMs = Date.now() - startTime;
    setSyncStatus('jira', 'success', null, durationMs);
    console.log(`   Jira sync completed: ${sprintRecords.length} sprints in ${durationMs}ms`);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    setSyncStatus('jira', 'error', error.message, durationMs);
    console.error('   Jira sync error:', error.message);
  } finally {
    syncInProgress.jira = false;
  }
}

// --- Background Sync ---

export function isStale(source) {
  const staleHours = parseInt(process.env.CACHE_STALE_HOURS ?? '6', 10);
  const status = getSyncStatus(source);
  if (!status) return true;

  const lastSync = new Date(status.last_sync_at + 'Z');
  const now = new Date();
  const diffHours = (now - lastSync) / (1000 * 60 * 60);
  return diffHours > staleHours;
}

export function triggerBackgroundSync(source) {
  if (source === 'github' || !source) {
    syncGitHub().catch((err) => console.error('Background GitHub sync failed:', err.message));
  }
  if (source === 'jira' || !source) {
    syncJira().catch((err) => console.error('Background Jira sync failed:', err.message));
  }
}

export function isSyncing(source) {
  if (source) return syncInProgress[source] || false;
  return syncInProgress;
}
