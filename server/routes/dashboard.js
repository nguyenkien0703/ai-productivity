import { Router } from 'express';
import { getAllPRs, getAllSprints, getSyncStatus } from '../db.js';
import { isStale, triggerBackgroundSync, isSyncing } from '../sync.js';

const router = Router();

// GET /api/dashboard/data - Return all cached data + sync status
router.get('/data', (req, res) => {
  try {
    const pullRequests = getAllPRs();
    const sprints = getAllSprints();

    const githubStatus = getSyncStatus('github');
    const jiraStatus = getSyncStatus('jira');

    const githubIsStale = isStale('github');
    const jiraIsStale = isStale('jira');

    // Auto-trigger background sync if data is stale
    if (githubIsStale || jiraIsStale) {
      if (githubIsStale) triggerBackgroundSync('github');
      if (jiraIsStale) triggerBackgroundSync('jira');
    }

    res.json({
      pullRequests,
      sprints,
      syncStatus: {
        github: {
          lastSyncAt: githubStatus?.last_sync_at || null,
          status: githubStatus?.status || 'never',
          isStale: githubIsStale,
          durationMs: githubStatus?.duration_ms || null,
          errorMsg: githubStatus?.error_msg || null,
        },
        jira: {
          lastSyncAt: jiraStatus?.last_sync_at || null,
          status: jiraStatus?.status || 'never',
          isStale: jiraIsStale,
          durationMs: jiraStatus?.duration_ms || null,
          errorMsg: jiraStatus?.error_msg || null,
        },
      },
    });
  } catch (error) {
    console.error('Dashboard data error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/dashboard/sync - Trigger manual sync
router.post('/sync', (req, res) => {
  try {
    const { source } = req.body || {};

    if (source && !['github', 'jira'].includes(source)) {
      return res.status(400).json({ error: 'Invalid source. Use "github" or "jira".' });
    }

    triggerBackgroundSync(source || undefined);

    res.status(202).json({
      message: `Sync triggered for ${source || 'all sources'}`,
      syncing: isSyncing(),
    });
  } catch (error) {
    console.error('Sync trigger error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard/sync/status - Poll sync progress
router.get('/sync/status', (req, res) => {
  try {
    const allStatus = getSyncStatus();
    const syncing = isSyncing();

    const statusMap = {};
    for (const s of (Array.isArray(allStatus) ? allStatus : [allStatus].filter(Boolean))) {
      statusMap[s.source] = {
        lastSyncAt: s.last_sync_at,
        status: s.status,
        errorMsg: s.error_msg,
        durationMs: s.duration_ms,
        isStale: isStale(s.source),
      };
    }

    res.json({
      syncing,
      sources: statusMap,
    });
  } catch (error) {
    console.error('Sync status error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
