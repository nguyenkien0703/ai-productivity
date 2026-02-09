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
  let jiraSprints = [];

  try {
    githubPRs = await fetchAndCacheGitHubData();
  } catch (err) {
    console.error('GitHub sync error:', err.message);
    errors.push({ source: 'github', message: err.message });
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

  return { githubPRs, jiraSprints, status, errors };
}

// ========== Cache API Endpoints ==========

// GET /api/data/cached — return cached data (auto-sync if no cache)
app.get('/api/data/cached', async (req, res) => {
  try {
    let github = await getCachedData('github_prs');
    let jira = await getCachedData('jira_sprints');

    // If no cache exists, trigger a sync
    if (!github || !jira) {
      console.log('No cache found, triggering initial sync...');
      const result = await syncAllData();
      return res.json({
        githubPRs: result.githubPRs,
        jiraSprints: result.jiraSprints,
        syncMeta: await getSyncMeta(),
      });
    }

    const syncMeta = await getSyncMeta();
    res.json({
      githubPRs: github.data,
      jiraSprints: jira.data,
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
  let jiraSprints = [];

  // Step 1: GitHub
  send('progress', { step: 'github', status: 'syncing', message: 'Fetching GitHub PRs...' });
  try {
    githubPRs = await fetchAndCacheGitHubData();
    send('progress', { step: 'github', status: 'done', message: `GitHub: ${githubPRs.length} PRs synced` });
  } catch (err) {
    errors.push({ source: 'github', message: err.message });
    send('progress', { step: 'github', status: 'error', message: `GitHub error: ${err.message}` });
  }

  // Step 2: Jira
  send('progress', { step: 'jira', status: 'syncing', message: 'Fetching Jira sprints...' });
  try {
    jiraSprints = await fetchAndCacheJiraData();
    send('progress', { step: 'jira', status: 'done', message: `Jira: ${jiraSprints.length} sprints synced` });
  } catch (err) {
    errors.push({ source: 'jira', message: err.message });
    send('progress', { step: 'jira', status: 'error', message: `Jira error: ${err.message}` });
  }

  // Step 3: Save meta & complete
  const status = errors.length === 0 ? 'success' : 'partial';
  await updateSyncMeta(status, errors);
  const syncMeta = await getSyncMeta();

  send('complete', {
    status,
    errors,
    syncMeta,
    githubPRs,
    jiraSprints,
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
