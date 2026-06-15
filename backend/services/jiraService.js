const axios = require('axios');

function getJiraAuthHeaders() {
  const host = (process.env.JIRA_HOST || '').trim();
  const user = (process.env.JIRA_USER || '').trim();
  const token = (process.env.JIRA_API_TOKEN || '').trim();
  const projectKey = (process.env.JIRA_PROJECT_KEY || '').trim();

  if (!host || !user || !token || !projectKey) {
    return null; // Run in Mock mode
  }

  const authString = Buffer.from(`${user}:${token}`).toString('base64');
  return {
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    host,
    projectKey
  };
}

/**
 * Creates a new JIRA issue/task.
 * Returns { key, id } or mock values.
 */
async function createIssue(summary, description, labels = []) {
  const auth = getJiraAuthHeaders();
  if (!auth) {
    const mockId = Math.floor(Math.random() * 10000);
    const mockKey = `MOCK-${mockId}`;
    console.warn(`[JiraService] JIRA not fully configured in backend/.env. Using Mock Key: ${mockKey}`);
    return { key: mockKey, id: String(mockId), mock: true };
  }

  const url = `${auth.host}/rest/api/2/issue`;
  const data = {
    fields: {
      project: {
        key: auth.projectKey
      },
      summary: summary,
      description: description,
      issuetype: {
        name: 'Task'
      },
      labels: labels
    }
  };

  try {
    const response = await axios.post(url, data, { headers: auth.headers });
    return { key: response.data.key, id: response.data.id, mock: false };
  } catch (error) {
    console.error('[JiraService] Failed to create issue on JIRA. Falling back to Mock Key.', error.response?.data || error.message);
    const mockId = Math.floor(Math.random() * 10000);
    return { key: `FAIL-${mockId}`, id: String(mockId), mock: true };
  }
}

/**
 * Fetches status of a JIRA issue.
 * Returns string (e.g. 'To Do', 'In Progress', 'Done').
 */
async function getIssueStatus(issueKey, defaultStatus = 'To Do') {
  if (issueKey.startsWith('MOCK-') || issueKey.startsWith('FAIL-')) {
    return defaultStatus; // Return last cached status for mock/failed items
  }

  const auth = getJiraAuthHeaders();
  if (!auth) return defaultStatus;

  const url = `${auth.host}/rest/api/2/issue/${issueKey}?fields=status`;

  try {
    const response = await axios.get(url, { headers: auth.headers });
    return response.data?.fields?.status?.name || defaultStatus;
  } catch (error) {
    console.error(`[JiraService] Error fetching status for ${issueKey}:`, error.message);
    return defaultStatus;
  }
}

/**
 * Adds a comment to a JIRA issue (useful for weekly submissions).
 */
async function addComment(issueKey, commentText) {
  if (issueKey.startsWith('MOCK-') || issueKey.startsWith('FAIL-')) {
    console.log(`[JiraService] [MOCK] Added submission comment to ${issueKey}`);
    return true;
  }

  const auth = getJiraAuthHeaders();
  if (!auth) return false;

  const url = `${auth.host}/rest/api/2/issue/${issueKey}/comment`;
  const data = { body: commentText };

  try {
    await axios.post(url, data, { headers: auth.headers });
    return true;
  } catch (error) {
    console.error(`[JiraService] Failed to add comment to ${issueKey}:`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Transitions JIRA issue status (e.g. to Done).
 */
async function transitionIssue(issueKey, targetStatusName = 'Done') {
  if (issueKey.startsWith('MOCK-') || issueKey.startsWith('FAIL-')) {
    console.log(`[JiraService] [MOCK] Transitioned ${issueKey} status to ${targetStatusName}`);
    return true;
  }

  const auth = getJiraAuthHeaders();
  if (!auth) return false;

  try {
    // 1. Get available transitions
    const transitionsUrl = `${auth.host}/rest/api/2/issue/${issueKey}/transitions`;
    const response = await axios.get(transitionsUrl, { headers: auth.headers });
    const transitions = response.data?.transitions || [];

    // 2. Find transition ID matching target status
    const transition = transitions.find(t => 
      t.name.toLowerCase() === targetStatusName.toLowerCase() || 
      t.to?.name?.toLowerCase() === targetStatusName.toLowerCase()
    );

    if (!transition) {
      console.warn(`[JiraService] Transition matching "${targetStatusName}" not found for issue ${issueKey}`);
      return false;
    }

    // 3. Post transition
    await axios.post(transitionsUrl, { transition: { id: transition.id } }, { headers: auth.headers });
    return true;
  } catch (error) {
    console.error(`[JiraService] Transition failed for ${issueKey}:`, error.response?.data || error.message);
    return false;
  }
}

module.exports = {
  isConfigured: () => getJiraAuthHeaders() !== null,
  createIssue,
  getIssueStatus,
  addComment,
  transitionIssue
};
