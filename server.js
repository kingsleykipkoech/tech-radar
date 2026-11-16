/**
 * Open Source Tech Radar & Package Health Explorer
 * Server-side API Proxy, Cache, and Static File Server
 * Built with native Node.js (Zero external dependencies)
 * 
 * ALU Summative Assignment: Playing Around with APIs
 * Author: Kingsley Kipkoech
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const HOSTNAME = process.env.SERVER_NAME || os.hostname();

// In-memory cache with 15-minute TTL to prevent external API rate limits
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { timestamp: Date.now(), data });
}

// MIME types for static asset serving
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Algorithmic Package Health Score (0 to 100)
function computeHealthScore({ stars = 0, downloads = 0, openIssues = 0, hasLicense = false, lastUpdatedDays = 999 }) {
  let score = 0;

  // 1. Adoption & Community (Max 30 pts)
  if (stars > 50000 || downloads > 5000000) score += 30;
  else if (stars > 10000 || downloads > 1000000) score += 25;
  else if (stars > 1000 || downloads > 100000) score += 20;
  else if (stars > 100 || downloads > 10000) score += 15;
  else score += 10;

  // 2. Freshness & Maintenance (Max 30 pts)
  if (lastUpdatedDays <= 30) score += 30;
  else if (lastUpdatedDays <= 90) score += 25;
  else if (lastUpdatedDays <= 180) score += 18;
  else if (lastUpdatedDays <= 365) score += 10;
  else score += 5;

  // 3. Issue Debt Ratio (Max 20 pts)
  if (openIssues === 0) score += 20;
  else if (openIssues < 50) score += 18;
  else if (openIssues < 200) score += 14;
  else if (openIssues < 500) score += 10;
  else score += 5;

  // 4. License Clarity (Max 20 pts)
  if (hasLicense) score += 20;
  else score += 5;

  return Math.min(100, Math.max(0, score));
}

// Helper to fetch JSON from external APIs with timeout
async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'ALU-Tech-Radar/1.0 (Student Project; k.kipkoech@alustudent.com)',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, status: res.status, error: text || res.statusText };
    }

    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    clearTimeout(timeoutId);
    return { ok: false, error: err.message };
  }
}

// Parse GitHub repo URL from package metadata
function parseGitHubRepo(repoUrl) {
  if (!repoUrl) return null;
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/#]+)/i);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/i, ''),
  };
}

// -------------------------------------------------------------
// API Handlers
// -------------------------------------------------------------

async function handleSearch(reqUrl) {
  const query = (reqUrl.searchParams.get('q') || '').trim().toLowerCase();
  const ecosystem = (reqUrl.searchParams.get('ecosystem') || 'all').toLowerCase();

  if (!query) {
    return { status: 400, data: { error: 'Query parameter "q" is required.' } };
  }

  const cacheKey = `search:${ecosystem}:${query}`;
  const cached = getCached(cacheKey);
  if (cached) return { status: 200, data: cached };

  const results = [];

  // 1. Search npm registry if applicable
  if (ecosystem === 'all' || ecosystem === 'npm') {
    const npmRes = await fetchJson(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=8`);
    if (npmRes.ok && Array.isArray(npmRes.data?.objects)) {
      for (const obj of npmRes.data.objects) {
        const p = obj.package;
        const gh = parseGitHubRepo(p.links?.repository);
        results.push({
          id: `npm:${p.name}`,
          name: p.name,
          ecosystem: 'npm',
          version: p.version,
          description: p.description || 'No description provided.',
          keywords: p.keywords || [],
          author: p.publisher?.username || p.author?.name || 'Unknown',
          date: p.date,
          links: {
            registry: p.links?.npm || `https://www.npmjs.com/package/${p.name}`,
            homepage: p.links?.homepage || null,
            repository: p.links?.repository || null,
          },
          githubOwner: gh?.owner || null,
          githubRepo: gh?.repo || null,
        });
      }
    }
  }

  // 2. Search PyPI if applicable
  if (ecosystem === 'all' || ecosystem === 'pypi') {
    // Exact match direct check on PyPI
    const pypiRes = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(query)}/json`);
    if (pypiRes.ok && pypiRes.data?.info) {
      const info = pypiRes.data.info;
      const gh = parseGitHubRepo(info.project_urls?.Source || info.project_urls?.Repository || info.home_page);
      results.push({
        id: `pypi:${info.name}`,
        name: info.name,
        ecosystem: 'pypi',
        version: info.version,
        description: info.summary || 'No summary provided.',
        keywords: (info.keywords || '').split(',').map(k => k.trim()).filter(Boolean),
        author: info.author || info.maintainer || 'Unknown',
        date: pypiRes.data.releases?.[info.version]?.[0]?.upload_time || new Date().toISOString(),
        links: {
          registry: `https://pypi.org/project/${info.name}/`,
          homepage: info.home_page || null,
          repository: info.project_urls?.Source || info.project_urls?.Repository || null,
        },
        githubOwner: gh?.owner || null,
        githubRepo: gh?.repo || null,
      });
    }
  }

  const responsePayload = {
    query,
    ecosystem,
    count: results.length,
    results,
  };

  setCache(cacheKey, responsePayload);
  return { status: 200, data: responsePayload };
}

async function handlePackageDetails(ecosystem, name) {
  const cacheKey = `pkg:${ecosystem}:${name}`;
  const cached = getCached(cacheKey);
  if (cached) return { status: 200, data: cached };

  let pkgData = null;
  let ghInfo = null;
  let downloadsTrend = [];
  let total30dDownloads = 0;

  if (ecosystem === 'npm') {
    // 1. Fetch package manifest from npm registry
    const manifestRes = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (!manifestRes.ok) {
      return { status: manifestRes.status === 404 ? 404 : 502, data: { error: `Package "${name}" not found on npm.` } };
    }
    const manifest = manifestRes.data;
    const latestVersion = manifest['dist-tags']?.latest || Object.keys(manifest.versions || {}).pop();
    const versionObj = manifest.versions?.[latestVersion] || {};
    const gh = parseGitHubRepo(manifest.repository?.url || versionObj.repository?.url || manifest.homepage);

    // 2. Fetch 30-day download metrics from npm
    const dlRes = await fetchJson(`https://api.npmjs.org/downloads/range/last-month/${encodeURIComponent(name)}`);
    if (dlRes.ok && Array.isArray(dlRes.data?.downloads)) {
      downloadsTrend = dlRes.data.downloads.map(d => ({ date: d.day, count: d.downloads }));
      total30dDownloads = downloadsTrend.reduce((sum, d) => sum + d.count, 0);
    }

    pkgData = {
      name: manifest.name,
      ecosystem: 'npm',
      version: latestVersion,
      description: manifest.description || 'No description provided.',
      license: manifest.license || versionObj.license || 'Unknown',
      author: manifest.author?.name || versionObj.author?.name || 'Unknown',
      maintainersCount: (manifest.maintainers || []).length,
      dependenciesCount: Object.keys(versionObj.dependencies || {}).length,
      homepage: manifest.homepage || null,
      repository: manifest.repository?.url || null,
      lastPublished: manifest.time?.[latestVersion] || manifest.time?.modified || null,
      githubOwner: gh?.owner || null,
      githubRepo: gh?.repo || null,
      total30dDownloads,
      downloadsTrend,
    };
  } else if (ecosystem === 'pypi') {
    // Fetch from PyPI JSON API
    const pypiRes = await fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`);
    if (!pypiRes.ok) {
      return { status: pypiRes.status === 404 ? 404 : 502, data: { error: `Package "${name}" not found on PyPI.` } };
    }
    const info = pypiRes.data.info;
    const gh = parseGitHubRepo(info.project_urls?.Source || info.project_urls?.Repository || info.home_page);
    const releaseDates = Object.values(pypiRes.data.releases || {}).flat().map(r => r.upload_time).filter(Boolean).sort();
    const lastPublished = releaseDates.length ? releaseDates[releaseDates.length - 1] : null;

    pkgData = {
      name: info.name,
      ecosystem: 'pypi',
      version: info.version,
      description: info.summary || 'No summary provided.',
      license: info.license || 'Unknown',
      author: info.author || info.maintainer || 'Unknown',
      maintainersCount: 1,
      dependenciesCount: (info.requires_dist || []).length,
      homepage: info.home_page || null,
      repository: info.project_urls?.Source || info.project_urls?.Repository || null,
      lastPublished,
      githubOwner: gh?.owner || null,
      githubRepo: gh?.repo || null,
      total30dDownloads: 0,
      downloadsTrend: [],
    };
  } else {
    return { status: 400, data: { error: `Unsupported ecosystem "${ecosystem}". Use "npm" or "pypi".` } };
  }

  // 3. If GitHub repo is identified, enrich with GitHub REST API
  if (pkgData.githubOwner && pkgData.githubRepo) {
    const ghRes = await fetchJson(`https://api.github.com/repos/${pkgData.githubOwner}/${pkgData.githubRepo}`);
    if (ghRes.ok) {
      const gh = ghRes.data;
      ghInfo = {
        fullName: gh.full_name,
        stars: gh.stargazers_count,
        forks: gh.forks_count,
        openIssues: gh.open_issues_count,
        watchers: gh.subscribers_count,
        license: gh.license?.spdx_id || gh.license?.name || pkgData.license,
        pushedAt: gh.pushed_at,
        createdAt: gh.created_at,
        defaultBranch: gh.default_branch,
        archived: gh.archived,
        topics: gh.topics || [],
      };
      if (pkgData.license === 'Unknown' && ghInfo.license) {
        pkgData.license = ghInfo.license;
      }
    }
  }

  // Compute Health Score
  const lastUpdated = ghInfo?.pushedAt || pkgData.lastPublished;
  const lastUpdatedDays = lastUpdated ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)) : 999;
  
  const healthScore = computeHealthScore({
    stars: ghInfo?.stars || 0,
    downloads: pkgData.total30dDownloads || 0,
    openIssues: ghInfo?.openIssues || 0,
    hasLicense: pkgData.license && pkgData.license !== 'Unknown',
    lastUpdatedDays,
  });

  const fullData = {
    ...pkgData,
    github: ghInfo,
    healthScore,
    lastUpdatedDays,
  };

  setCache(cacheKey, fullData);
  return { status: 200, data: fullData };
}

// -------------------------------------------------------------
// HTTP Server & Static Router
// -------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Served-By', HOSTNAME);
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;

    // --- API Routes ---
    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'UP',
        server: HOSTNAME,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      }));
      return;
    }

    if (pathname === '/api/search') {
      const result = await handleSearch(reqUrl);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
      return;
    }

    const packageMatch = pathname.match(/^\/api\/package\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_@/.-]+)$/);
    if (packageMatch) {
      const [, ecosystem, name] = packageMatch;
      const result = await handlePackageDetails(ecosystem, decodeURIComponent(name));
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
      return;
    }

    // --- Static File Serving ---
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    
    // Prevent directory traversal attacks
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for single-page app or return 404
        filePath = path.join(PUBLIC_DIR, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('500 Internal Server Error');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error', details: error.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Tech Radar] Server running at http://0.0.0.0:${PORT}/ on host "${HOSTNAME}"`);
});
