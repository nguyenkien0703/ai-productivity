import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Environment variables
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;
const JIRA_BASE_URL = process.env.VITE_JIRA_BASE_URL;
const JIRA_EMAIL = process.env.VITE_JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.VITE_JIRA_API_TOKEN;

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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    github: !!GITHUB_TOKEN,
    jira: !!JIRA_BASE_URL && !!JIRA_EMAIL && !!JIRA_API_TOKEN,
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

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log('\n📊 Configuration:');
  console.log('   GitHub Token:', GITHUB_TOKEN ? '✓ configured' : '✗ missing');
  console.log('   Jira URL:', JIRA_BASE_URL || '✗ missing');
  console.log('   Jira Email:', JIRA_EMAIL || '✗ missing');
  console.log('   Jira Token:', JIRA_API_TOKEN ? '✓ configured' : '✗ missing');

  if (existsSync(distPath)) {
    console.log('\n✅ Production mode: Serving static files from /dist');
  } else {
    console.log('\n⚠️  Development mode: Run "npm run dev" for frontend');
  }
});
