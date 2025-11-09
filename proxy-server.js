// Minimal local server to run jira_fetcher.py and return its output.
// Usage:
//   1) npm install
//   2) node proxy-server.js
//   3) Frontend will POST to /api/jira_fetcher/run with Jira credentials.

const path = require('path');
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

// Resolve absolute path to the Python script
const fetcherPath = path.join(__dirname, 'jira_fetcher.py');

function choosePythonCmd() {
  // On Windows, many environments have 'python'; some have 'py'. Try env override first.
  return process.env.PYTHON_CMD || 'python';
}

app.post('/api/jira_fetcher/run', (req, res) => {
  const { domain, email, apiToken, project, maxIssuesPerProject, verbose } = req.body || {};
  if (!domain || !email || !apiToken) {
    return res.status(400).json({ error: 'Missing domain, email, or apiToken' });
  }

  const args = [
    fetcherPath,
    '--domain', String(domain),
    '--email', String(email),
    '--api-token', String(apiToken)
  ];
  if (project) { args.push('--project', String(project)); }
  if (maxIssuesPerProject) { args.push('--max-issues-per-project', String(maxIssuesPerProject)); }
  if (verbose) { args.push('--verbose'); }

  const pythonCmd = choosePythonCmd();
  const child = spawn(pythonCmd, args, { cwd: __dirname, env: process.env });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });
  child.on('error', (err) => {
    return res.status(500).json({ error: 'Failed to start Python process', details: String(err && err.message || err) });
  });
  child.on('close', (code) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ code, stdout, stderr }));
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), script: fetcherPath });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fetcher server listening on http://localhost:${PORT}`);
});