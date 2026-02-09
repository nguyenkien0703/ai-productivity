const API_BASE = '/api/dashboard';

/**
 * Fetch all cached dashboard data + sync status
 * @returns {Promise<Object>} - { pullRequests, sprints, syncStatus }
 */
export async function fetchDashboardData() {
  const response = await fetch(`${API_BASE}/data`);

  if (!response.ok) {
    throw new Error(`Dashboard API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Trigger manual sync
 * @param {string} [source] - "github" or "jira" or undefined for both
 * @returns {Promise<Object>} - { message, syncing }
 */
export async function triggerSync(source) {
  const response = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(source ? { source } : {}),
  });

  if (!response.ok) {
    throw new Error(`Sync trigger error: ${response.status}`);
  }

  return response.json();
}

/**
 * Poll sync progress
 * @returns {Promise<Object>} - { syncing, sources }
 */
export async function getSyncStatus() {
  const response = await fetch(`${API_BASE}/sync/status`);

  if (!response.ok) {
    throw new Error(`Sync status error: ${response.status}`);
  }

  return response.json();
}
