// Simple local proxy for Jira Cloud API to avoid browser CORS and keep credentials off the client
// Usage:
//   1) npm install
//   2) node proxy-server.js
//   3) Open productExist.html and enable "Use local proxy"

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Ensure you have 'node-fetch' installed (npm install node-fetch@2)

const app = express();
app.use(cors());
app.use(express.json());

// Track which Jira search endpoint was last successfully used ("new" or "legacy")
let lastSearchEndpoint = null; // values: 'new', 'legacy', null

// Helper: convert plain text to Jira ADF document
function adfFromText(text) {
  const t = typeof text === 'string' ? text : '';
  return {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: t
          ? [
              {
                type: 'text',
                text: t,
              },
            ]
          : [],
      },
    ],
  };
}

app.post('/api/jira/projects', async (req, res) => {
  try {
    const { domain, email, apiToken } = req.body || {};
    if (!domain || !email || !apiToken) {
      return res.status(400).json({ error: 'Missing domain, email, or apiToken' });
    }
    const url = `https://${domain}/rest/api/3/project/search?expand=lead&maxResults=100`;
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const upstream = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return res.status(upstream.status).send(text);
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', details: String(err && err.message || err) });
  }
});

// Aggregated project details (basic project + components + versions)
app.post('/api/jira/project/details', async (req, res) => {
  try {
    const { domain, email, apiToken, projectIdOrKey } = req.body || {};
    if (!domain || !email || !apiToken || !projectIdOrKey) {
      return res.status(400).json({ error: 'Missing domain, email, apiToken, or projectIdOrKey' });
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const base = `https://${domain}`;

    const headers = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json'
    };

    // Fetch all three in parallel
    const [projResp, compsResp, versResp] = await Promise.all([
      fetch(`${base}/rest/api/3/project/${encodeURIComponent(projectIdOrKey)}?expand=lead,url`, { headers }),
      fetch(`${base}/rest/api/3/project/${encodeURIComponent(projectIdOrKey)}/components`, { headers }),
      fetch(`${base}/rest/api/3/project/${encodeURIComponent(projectIdOrKey)}/versions`, { headers })
    ]);

    const projText = await projResp.text();
    const compsText = await compsResp.text();
    const versText = await versResp.text();

    if (!projResp.ok) {
      return res.status(projResp.status).send(projText);
    }
    if (!compsResp.ok) {
      return res.status(compsResp.status).send(compsText);
    }
    if (!versResp.ok) {
      return res.status(versResp.status).send(versText);
    }

    const project = JSON.parse(projText);
    const components = JSON.parse(compsText);
    const versions = JSON.parse(versText);

    res.json({ project, components, versions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', details: String((err && err.message) || err) });
  }
});

// Update project (name, leadAccountId, description)
app.put('/api/jira/project/update', async (req, res) => {
  try {
    const { domain, email, apiToken, projectIdOrKey, name, description, leadAccountId } = req.body || {};
    if (!domain || !email || !apiToken || !projectIdOrKey) {
      return res.status(400).json({ error: 'Missing domain, email, apiToken, or projectIdOrKey' });
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const url = `https://${domain}/rest/api/3/project/${encodeURIComponent(projectIdOrKey)}`;

    const payload = {};
    if (typeof name === 'string' && name.trim()) payload.name = name.trim();
    if (typeof description === 'string') payload.description = description;
    if (typeof leadAccountId === 'string' && leadAccountId.trim()) payload.leadAccountId = leadAccountId.trim();

    const upstream = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return res.status(upstream.status).send(text);
    }
    // Jira returns 204 No Content on success for some updates; normalize to JSON
    res.setHeader('Content-Type', 'application/json');
    res.send(text || JSON.stringify({ ok: true }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', details: String((err && err.message) || err) });
  }
});

// Resolve Jira accountId by email (required to change project lead)
app.post('/api/jira/user/accountIdByEmail', async (req, res) => {
  try {
    const { domain, email, apiToken, queryEmail } = req.body || {};
    if (!domain || !email || !apiToken || !queryEmail) {
      return res.status(400).json({ error: 'Missing domain, email, apiToken, or queryEmail' });
    }
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const url = `https://${domain}/rest/api/3/user/search?query=${encodeURIComponent(queryEmail)}`;
    const upstream = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return res.status(upstream.status).send(text);
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', details: String((err && err.message) || err) });
  }
});

// Search issues in a project with optional statusCategory filter and pagination (local proxy route)
// NOTE: The frontend calls /api/jira/issues/search. Keep that path stable.
app.post('/api/jira/issues/search', async (req, res) => {
  try {
    const { domain, email, apiToken, projectIdOrKey, statusCategory, startAt = 0, maxResults = 50, excludeDescription = false, pageToken = null } = req.body || {};
    if (!domain || !email || !apiToken || !projectIdOrKey) {
      return res.status(400).json({ error: 'Missing domain, email, apiToken, or projectIdOrKey' });
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const base = `https://${domain}/rest/api/3`;

    const jqlParts = [`project = ${JSON.stringify(projectIdOrKey)}`];
    if (statusCategory && typeof statusCategory === 'string') {
      jqlParts.push(`statusCategory = ${JSON.stringify(statusCategory)}`);
    }
    const jql = jqlParts.join(' AND ') + ' ORDER BY updated DESC';

    // Construct fields list, allowing exclusion of description for performance
    const baseFields = [
      'summary',
      'status',
      'assignee',
      'labels',
      'components',
      'fixVersions',
      'priority',
      'issuetype',
      'created',
      'updated'
    ];
    if (!excludeDescription) baseFields.splice(1, 0, 'description'); // insert after summary

    const body = {
      jql,
      startAt: Number(startAt) || 0,
      maxResults: Math.min(Number(maxResults) || 50, 100),
      fields: baseFields,
    };

    // Experimental cursor token support (if provided by new API variants)
    if (pageToken) {
      body.pageToken = pageToken; // pass-through for new search API flavors
    }

    async function doSearch(path, attempt = 0) {
      const resp = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      // Basic 429 retry/backoff (up to 2 retries)
      if (resp.status === 429 && attempt < 2) {
        let retryAfterMs = 2000; // default 2s
        const ra = resp.headers.get('Retry-After');
        if (ra) {
          const secs = parseInt(ra, 10);
          if (!isNaN(secs) && secs >= 0) retryAfterMs = secs * 1000;
        }
        await new Promise(r => setTimeout(r, retryAfterMs));
        return doSearch(path, attempt + 1);
      }

      const text = await resp.text();
      return { resp, text };
    }

    // Updated fallback logic (Nov 2025):
    // The legacy /search endpoint has been removed (410) after May 1 2025.
    // We now only fallback on a 404 (endpoint not found) IF explicitly enabled via env ALLOW_LEGACY_JQL_FALLBACK=true.
    // This prevents masking real 400 errors from the new /search/jql endpoint and avoids hitting removed legacy routes.
    const legacyFallbackEnabled = process.env.ALLOW_LEGACY_JQL_FALLBACK === 'true';
    let fallbackUsed = false;
    let { resp, text } = await doSearch('/search/jql');
    if (!resp.ok && resp.status === 404 && legacyFallbackEnabled) {
      ({ resp, text } = await doSearch('/search'));
      fallbackUsed = true;
    }
    if (!resp.ok) {
      // Surface original error without attempting removed legacy endpoint.
      return res.status(resp.status).send(text);
    }
    // Determine which endpoint succeeded
    lastSearchEndpoint = fallbackUsed ? 'legacy' : 'new';

    // Attempt to augment with meta information
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (data && typeof data === 'object') {
      // Cursor token detection (field names may vary in future APIs)
      const possibleCursor = data.nextPageToken || data.nextPage || data.cursor || null;
      data._searchMeta = {
        endpoint: lastSearchEndpoint,
        excludeDescription: !!excludeDescription,
        cursorToken: possibleCursor || null,
        receivedFields: body.fields,
        fallbackUsed,
        legacyFallbackEnabled,
      };
      res.setHeader('Content-Type', 'application/json');
      return res.send(JSON.stringify(data));
    }
    // Fallback: return raw text
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', details: String((err && err.message) || err) });
  }
});

// Fetch all visible system and custom fields (mirrors GET /rest/api/3/field)
app.post('/api/jira/fields', async (req, res) => {
  try {
    const { domain, email, apiToken } = req.body || {};
    if (!domain || !email || !apiToken) {
      return res.status(400).json({ error: 'Missing domain, email, or apiToken' });
    }
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const url = `https://${domain}/rest/api/3/field`;
    const upstream = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    const text = await upstream.text();
    if (!upstream.ok) return res.status(upstream.status).send(text);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', details: String(err && err.message || err) });
  }
});

// Paginated field search (mirrors GET /rest/api/3/field/search)
app.post('/api/jira/fields/search', async (req, res) => {
  try {
    const { domain, email, apiToken, startAt = 0, maxResults = 50, type, id, query, orderBy, expand, projectIds } = req.body || {};
    if (!domain || !email || !apiToken) {
      return res.status(400).json({ error: 'Missing domain, email, or apiToken' });
    }
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const base = `https://${domain}/rest/api/3/field/search`;
    const params = new URLSearchParams();
    params.append('startAt', Number(startAt) || 0);
    params.append('maxResults', Math.min(Number(maxResults) || 50, 100));
    if (Array.isArray(type)) type.forEach(v => params.append('type', v));
    if (Array.isArray(id)) id.forEach(v => params.append('id', v));
    if (typeof query === 'string' && query.trim()) params.append('query', query.trim());
    if (typeof orderBy === 'string' && orderBy.trim()) params.append('orderBy', orderBy.trim());
    if (typeof expand === 'string' && expand.trim()) params.append('expand', expand.trim());
    if (Array.isArray(projectIds)) projectIds.forEach(v => params.append('projectIds', String(v)));
    const url = `${base}?${params.toString()}`;
    const upstream = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    const text = await upstream.text();
    if (!upstream.ok) return res.status(upstream.status).send(text);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', details: String(err && err.message || err) });
  }
});

// Paginated trashed fields (mirrors GET /rest/api/3/field/search/trashed)
app.post('/api/jira/fields/search/trashed', async (req, res) => {
  try {
    const { domain, email, apiToken, startAt = 0, maxResults = 50, id, query, orderBy, expand } = req.body || {};
    if (!domain || !email || !apiToken) {
      return res.status(400).json({ error: 'Missing domain, email, or apiToken' });
    }
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const base = `https://${domain}/rest/api/3/field/search/trashed`;
    const params = new URLSearchParams();
    params.append('startAt', Number(startAt) || 0);
    params.append('maxResults', Math.min(Number(maxResults) || 50, 100));
    if (Array.isArray(id)) id.forEach(v => params.append('id', v));
    if (typeof query === 'string' && query.trim()) params.append('query', query.trim());
    if (typeof orderBy === 'string' && orderBy.trim()) params.append('orderBy', orderBy.trim());
    if (typeof expand === 'string' && expand.trim()) params.append('expand', expand.trim());
    const url = `${base}?${params.toString()}`;
    const upstream = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    const text = await upstream.text();
    if (!upstream.ok) return res.status(upstream.status).send(text);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', details: String(err && err.message || err) });
  }
});

// Update an issue's editable fields
app.put('/api/jira/issue/update', async (req, res) => {
  try {
    const { domain, email, apiToken, issueKey, summary, descriptionText, labels, assigneeAccountId, componentIds, fixVersionIds, priorityId } = req.body || {};
    if (!domain || !email || !apiToken || !issueKey) {
      return res.status(400).json({ error: 'Missing domain, email, apiToken, or issueKey' });
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const url = `https://${domain}/rest/api/3/issue/${encodeURIComponent(issueKey)}`;

    const fields = {};
    if (typeof summary === 'string') fields.summary = summary;
    if (typeof descriptionText === 'string') fields.description = adfFromText(descriptionText);
    if (Array.isArray(labels)) fields.labels = labels.filter(x => typeof x === 'string');
    if (typeof assigneeAccountId === 'string' && assigneeAccountId.trim()) fields.assignee = { accountId: assigneeAccountId.trim() };
    if (Array.isArray(componentIds)) fields.components = componentIds.filter(Boolean).map(id => ({ id: String(id) }));
    if (Array.isArray(fixVersionIds)) fields.fixVersions = fixVersionIds.filter(Boolean).map(id => ({ id: String(id) }));
    if (typeof priorityId === 'string' && priorityId.trim()) fields.priority = { id: String(priorityId) };

    const upstream = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    const text = await upstream.text();
    if (!upstream.ok) {
      return res.status(upstream.status).send(text);
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(text || JSON.stringify({ ok: true }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', details: String((err && err.message) || err) });
  }
});

// Get available transitions for an issue
app.post('/api/jira/issue/transitions', async (req, res) => {
  try {
    const { domain, email, apiToken, issueKey } = req.body || {};
    if (!domain || !email || !apiToken || !issueKey) {
      return res.status(400).json({ error: 'Missing domain, email, apiToken, or issueKey' });
    }
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const url = `https://${domain}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`;
    const upstream = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return res.status(upstream.status).send(text);
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', details: String((err && err.message) || err) });
  }
});

// Perform a transition on an issue (move status)
app.post('/api/jira/issue/transition', async (req, res) => {
  try {
    const { domain, email, apiToken, issueKey, transitionId } = req.body || {};
    if (!domain || !email || !apiToken || !issueKey || !transitionId) {
      return res.status(400).json({ error: 'Missing domain, email, apiToken, issueKey, or transitionId' });
    }
    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const url = `https://${domain}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`;
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transition: { id: String(transitionId) } }),
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      return res.status(upstream.status).send(text);
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(text || JSON.stringify({ ok: true }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Proxy error', details: String((err && err.message) || err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});

// Health endpoint for UI diagnostics
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    lastSearchEndpoint,
    time: new Date().toISOString(),
    routes: [
      '/api/jira/projects',
      '/api/jira/project/details',
      '/api/jira/project/update',
      '/api/jira/user/accountIdByEmail',
      '/api/jira/issues/search',
      '/api/jira/issue/update',
      '/api/jira/issue/transitions',
      '/api/jira/issue/transition',
      '/api/jira/fields',
      '/api/jira/fields/search',
      '/api/jira/fields/search/trashed'
    ]
  });
});