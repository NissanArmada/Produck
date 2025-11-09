// Simple local proxy for Jira Cloud API to avoid browser CORS and keep credentials off the client
// Usage:
//   1) npm install
//   2) node proxy-server.js
//   3) Open productExist.html and enable "Use local proxy"

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
});
