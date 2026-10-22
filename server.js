const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {
  getLocalTodayStr,
  calculateNextDueDate,
  getAllCategories,
  createCategory,
  deleteCategory,
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  toggleTaskCompletion,
  deleteTask,
  clearCompletedTasks
} = require('./db');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.resolve(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.github.com; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
};

function isTrustedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // Same-origin GET or non-CORS request without Origin header
  try {
    const originHost = new URL(origin).host;
    const reqHost = req.headers.host || `localhost:${PORT}`;
    return (
      originHost === reqHost ||
      originHost === `localhost:${PORT}` ||
      originHost === `127.0.0.1:${PORT}`
    );
  } catch {
    return false;
  }
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApiRequest(req, res, urlObj) {
  const pathname = urlObj.pathname;
  const method = req.method.toUpperCase();

  if (!isTrustedOrigin(req)) {
    return sendJson(res, 403, { error: 'Forbidden cross-origin request' });
  }

  try {
    // GET /api/bootstrap - Fetch tasks, categories, and server today string in one request
    if (method === 'GET' && pathname === '/api/bootstrap') {
      return sendJson(res, 200, {
        tasks: getAllTasks(),
        categories: getAllCategories(),
        today: getLocalTodayStr()
      });
    }

    // GET /api/recurrence-preview?due_date=YYYY-MM-DD&recurrence=weekly
    if (method === 'GET' && pathname === '/api/recurrence-preview') {
      const dueDate = urlObj.searchParams.get('due_date') || '';
      const recurrence = urlObj.searchParams.get('recurrence') || 'none';
      const today = urlObj.searchParams.get('today') || getLocalTodayStr();
      const nextDueDate = calculateNextDueDate(dueDate || today, recurrence, today);
      return sendJson(res, 200, { next_due_date: nextDueDate });
    }

    // GET /api/tasks
    if (method === 'GET' && pathname === '/api/tasks') {
      return sendJson(res, 200, { tasks: getAllTasks() });
    }

    // POST /api/tasks
    if (method === 'POST' && pathname === '/api/tasks') {
      const body = await parseJsonBody(req);
      const today = body.client_today || getLocalTodayStr();
      const task = createTask(body, today);
      return sendJson(res, 201, { task });
    }

    // DELETE /api/tasks/completed
    if (method === 'DELETE' && pathname === '/api/tasks/completed') {
      const removedCount = clearCompletedTasks();
      return sendJson(res, 200, { removedCount });
    }

    // Match /api/tasks/:id/toggle
    const toggleMatch = pathname.match(/^\/api\/tasks\/(\d+)\/toggle$/);
    if (toggleMatch && (method === 'PATCH' || method === 'POST')) {
      const id = Number(toggleMatch[1]);
      const body = await parseJsonBody(req);
      const today = body.client_today || getLocalTodayStr();
      const result = toggleTaskCompletion(id, body.completed, today);
      if (!result) {
        return sendJson(res, 404, { error: 'Task not found' });
      }
      return sendJson(res, 200, result);
    }

    // Match /api/tasks/:id
    const taskMatch = pathname.match(/^\/api\/tasks\/(\d+)$/);
    if (taskMatch) {
      const id = Number(taskMatch[1]);

      if (method === 'GET') {
        const task = getTaskById(id);
        if (!task) return sendJson(res, 404, { error: 'Task not found' });
        return sendJson(res, 200, { task });
      }

      if (method === 'PUT' || method === 'PATCH') {
        const body = await parseJsonBody(req);
        const today = body.client_today || getLocalTodayStr();
        const updated = updateTask(id, body, today);
        if (!updated) return sendJson(res, 404, { error: 'Task not found' });
        return sendJson(res, 200, { task: updated });
      }

      if (method === 'DELETE') {
        const deleted = deleteTask(id);
        if (!deleted) return sendJson(res, 404, { error: 'Task not found' });
        return sendJson(res, 200, { success: true, id });
      }
    }

    // GET /api/categories
    if (method === 'GET' && pathname === '/api/categories') {
      return sendJson(res, 200, { categories: getAllCategories() });
    }

    // POST /api/categories
    if (method === 'POST' && pathname === '/api/categories') {
      const body = await parseJsonBody(req);
      const category = createCategory(body);
      return sendJson(res, 201, { category });
    }

    // DELETE /api/categories/:id
    const catMatch = pathname.match(/^\/api\/categories\/(\d+)$/);
    if (catMatch && method === 'DELETE') {
      const id = Number(catMatch[1]);
      const deleted = deleteCategory(id);
      if (!deleted) return sendJson(res, 404, { error: 'Category not found' });
      return sendJson(res, 200, {
        success: true,
        id,
        categories: getAllCategories(),
        tasks: getAllTasks()
      });
    }

    // GET /api/project-files — Returns all 22 project files encoded in base64 for browser-direct GitHub upload
    if (method === 'GET' && pathname === '/api/project-files') {
      const filesToPush = [
        'package.json',
        'capacitor.config.json',
        'codemagic.yaml',
        'server.js',
        'db.js',
        'MOBILE_PUBLISHING.md',
        'scripts/generate-icons.js',
        'public/index.html',
        'public/styles.css',
        'public/app.js',
        'public/manifest.json',
        'public/sw.js',
        'public/privacy.html',
        'public/mobile-preview.html',
        'public/store-publish.html',
        'public/icons/icon.svg',
        'public/icons/icon-192.png',
        'public/icons/icon-512.png',
        'public/icons/icon-1024.png',
        'public/icons/apple-touch-icon.png',
        'public/icons/feature-graphic-1024x500.png',
        '.github/workflows/mobile-release.yml'
      ];

      const files = [];
      for (const relPath of filesToPush) {
        const absPath = path.join(__dirname, relPath);
        if (!fs.existsSync(absPath)) continue;
        const fileBuffer = fs.readFileSync(absPath);
        files.push({
          path: relPath,
          contentBase64: fileBuffer.toString('base64')
        });
      }
      return sendJson(res, 200, { files });
    }

    // POST /api/github-publish — 1-Click Cloud Push to GitHub (No git CLI required)
    if (method === 'POST' && pathname === '/api/github-publish') {
      const body = await parseJsonBody(req);
      const token = (body.token || '').trim();
      const repoName = (body.repo || 'pulse-todo').trim().replace(/[^a-zA-Z0-9._-]/g, '-');
      const isPrivate = body.private !== undefined ? Boolean(body.private) : false;

      if (!token) {
        return sendJson(res, 400, { error: 'Please provide your GitHub Personal Access Token.' });
      }

      const ghFetch = async (apiPath, options = {}) => {
        const resp = await fetch(`https://api.github.com${apiPath}`, {
          method: options.method || 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'PulseToDo-Publisher/1.0',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(options.body ? { 'Content-Type': 'application/json' } : {})
          },
          body: options.body ? JSON.stringify(options.body) : undefined
        });
        const text = await resp.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch (e) {}
        return { ok: resp.ok, status: resp.status, data };
      };

      // 1. Verify authenticated GitHub user
      const userRes = await ghFetch('/user');
      if (!userRes.ok || !userRes.data.login) {
        return sendJson(res, 401, {
          error: userRes.data.message || 'Invalid GitHub token. Make sure it has "repo" and "workflow" scopes.'
        });
      }
      const owner = userRes.data.login;

      // 2. Check if repository exists; if not, create it with auto_init: true
      let repoRes = await ghFetch(`/repos/${owner}/${repoName}`);
      if (!repoRes.ok) {
        const createRes = await ghFetch('/user/repos', {
          method: 'POST',
          body: {
            name: repoName,
            description: 'Pulse ToDo — Mobile & Web Task Manager (Android & iOS)',
            private: isPrivate,
            auto_init: true
          }
        });
        if (!createRes.ok) {
          return sendJson(res, 400, {
            error: createRes.data.message || 'Failed to create repository on GitHub.'
          });
        }
        repoRes = createRes;
        await new Promise(r => setTimeout(r, 1500));
      }

      const defaultBranch = repoRes.data.default_branch || 'main';

      // 3. Ensure repository is initialized (in case user created an empty repo on github.com/new)
      let refRes = await ghFetch(`/repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`);
      if (!refRes.ok) {
        await ghFetch(`/repos/${owner}/${repoName}/contents/README.md`, {
          method: 'PUT',
          body: {
            message: 'Initialize Pulse ToDo repository',
            content: Buffer.from('# Pulse ToDo\nMobile & Web Task Manager\n').toString('base64')
          }
        });
        await new Promise(r => setTimeout(r, 1200));
        refRes = await ghFetch(`/repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`);
      }

      const latestCommitSha = refRes.data && refRes.data.object ? refRes.data.object.sha : null;
      if (!latestCommitSha) {
        return sendJson(res, 400, { error: 'Could not read repository branch HEAD.' });
      }

      // 4. Collect all project files to push
      const filesToPush = [
        'package.json',
        'capacitor.config.json',
        'codemagic.yaml',
        'server.js',
        'db.js',
        'MOBILE_PUBLISHING.md',
        'scripts/generate-icons.js',
        'public/index.html',
        'public/styles.css',
        'public/app.js',
        'public/manifest.json',
        'public/sw.js',
        'public/privacy.html',
        'public/mobile-preview.html',
        'public/store-publish.html',
        'public/icons/icon.svg',
        'public/icons/icon-192.png',
        'public/icons/icon-512.png',
        'public/icons/icon-1024.png',
        'public/icons/apple-touch-icon.png',
        'public/icons/feature-graphic-1024x500.png',
        '.github/workflows/mobile-release.yml'
      ];

      const treeItems = [];
      for (const relPath of filesToPush) {
        const absPath = path.join(__dirname, relPath);
        if (!fs.existsSync(absPath)) continue;
        const fileBuffer = fs.readFileSync(absPath);
        const blobRes = await ghFetch(`/repos/${owner}/${repoName}/git/blobs`, {
          method: 'POST',
          body: {
            content: fileBuffer.toString('base64'),
            encoding: 'base64'
          }
        });
        if (!blobRes.ok) {
          return sendJson(res, 400, {
            error: `Failed uploading ${relPath}: ${blobRes.data.message || 'GitHub API error'} (Ensure your token has "repo" and "workflow" scopes checked)`
          });
        }
        treeItems.push({
          path: relPath,
          mode: '100644',
          type: 'blob',
          sha: blobRes.data.sha
        });
      }

      // 5. Create Git Tree & Commit
      const treeRes = await ghFetch(`/repos/${owner}/${repoName}/git/trees`, {
        method: 'POST',
        body: {
          base_tree: latestCommitSha,
          tree: treeItems
        }
      });
      if (!treeRes.ok) {
        return sendJson(res, 400, { error: treeRes.data.message || 'Failed creating Git tree.' });
      }

      const commitRes = await ghFetch(`/repos/${owner}/${repoName}/git/commits`, {
        method: 'POST',
        body: {
          message: 'Publish Pulse ToDo v1.0.0 mobile app & store release workflow',
          tree: treeRes.data.sha,
          parents: [latestCommitSha]
        }
      });
      if (!commitRes.ok) {
        return sendJson(res, 400, { error: commitRes.data.message || 'Failed creating Git commit.' });
      }

      const updateRefRes = await ghFetch(`/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`, {
        method: 'PATCH',
        body: {
          sha: commitRes.data.sha,
          force: true
        }
      });
      if (!updateRefRes.ok) {
        return sendJson(res, 400, {
          error: `${updateRefRes.data.message || 'Failed updating branch.'} — Make sure the "workflow" scope is checked on your GitHub token.`
        });
      }

      // 6. Trigger workflow_dispatch as well so build starts immediately
      await ghFetch(`/repos/${owner}/${repoName}/actions/workflows/mobile-release.yml/dispatches`, {
        method: 'POST',
        body: { ref: defaultBranch }
      });

      return sendJson(res, 200, {
        success: true,
        owner,
        repo: repoName,
        filesCount: treeItems.length,
        repoUrl: `https://github.com/${owner}/${repoName}`,
        actionsUrl: `https://github.com/${owner}/${repoName}/actions`
      });
    }

    return sendJson(res, 404, { error: 'API endpoint not found' });
  } catch (err) {
    return sendJson(res, 400, { error: err.message || 'Bad request' });
  }
}

function serveStaticFile(req, res, urlObj) {
  let decodedPathname;
  try {
    decodedPathname = decodeURIComponent(urlObj.pathname);
  } catch {
    res.writeHead(400, SECURITY_HEADERS);
    res.end('Bad Request');
    return;
  }

  const reqPath = decodedPathname === '/' ? 'index.html' : decodedPathname.replace(/^[/\\]+/, '');
  const filePath = path.resolve(PUBLIC_DIR, reqPath);
  const relPath = path.relative(PUBLIC_DIR, filePath);

  if (relPath.startsWith('..') || path.isAbsolute(relPath)) {
    res.writeHead(403, SECURITY_HEADERS);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Fallback to index.html for SPA navigation
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(404, SECURITY_HEADERS);
            res.end('Not found');
            return;
          }
          res.writeHead(200, {
            ...SECURITY_HEADERS,
            'Content-Type': 'text/html; charset=utf-8'
          });
          res.end(indexContent);
        });
      } else {
        res.writeHead(500, SECURITY_HEADERS);
        res.end('Internal server error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': contentType
    });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (urlObj.pathname.startsWith('/api/')) {
    handleApiRequest(req, res, urlObj);
  } else {
    serveStaticFile(req, res, urlObj);
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`Pulse ToDo Server running at http://${HOST}:${PORT}`);
  });
}

module.exports = { server };
