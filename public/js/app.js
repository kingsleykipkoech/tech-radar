/**
 * Open Source Tech Radar & Package Health Explorer
 * Client-Side Controller, Filter, Sort & Visualization Engine
 * 
 * ALU Summative Project: Playing Around with APIs
 * Author: Kingsley Kipkoech
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const serverHostnameEl = document.getElementById('serverHostname');
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const quickPillList = document.getElementById('quickPillList');
  const ecosystemFilter = document.getElementById('ecosystemFilter');
  const licenseFilter = document.getElementById('licenseFilter');
  const sortBy = document.getElementById('sortBy');
  const resultsGrid = document.getElementById('resultsGrid');
  const resultsCount = document.getElementById('resultsCount');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const emptyState = document.getElementById('emptyState');
  const toastContainer = document.getElementById('toastContainer');

  // Modal Elements
  const detailsModal = document.getElementById('detailsModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalPkgName = document.getElementById('modalPkgName');
  const modalPkgVersion = document.getElementById('modalPkgVersion');
  const modalPkgEco = document.getElementById('modalPkgEco');
  const modalBody = document.getElementById('modalBody');

  // State
  let rawPackages = [];
  let currentEcosystem = 'all';

  // -------------------------------------------------------------
  // 1. Cluster Status & Live Node Check
  // -------------------------------------------------------------
  async function checkClusterHealth() {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        serverHostnameEl.textContent = data.server || 'Active';
      } else {
        serverHostnameEl.textContent = 'Offline';
      }
    } catch {
      serverHostnameEl.textContent = 'Disconnected';
    }
  }
  checkClusterHealth();

  // -------------------------------------------------------------
  // 2. Search & Package Ingestion
  // -------------------------------------------------------------
  async function performSearch(query) {
    if (!query) return;

    showLoading(true);
    emptyState.classList.add('hidden');
    resultsGrid.innerHTML = '';
    rawPackages = [];

    try {
      // Step 1: Search registry catalog
      const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}&ecosystem=${currentEcosystem}`);
      const searchData = await searchRes.json();

      if (!searchRes.ok || !searchData.results || searchData.results.length === 0) {
        showLoading(false);
        emptyState.classList.remove('hidden');
        emptyState.querySelector('h3').textContent = `No packages found for "${query}"`;
        emptyState.querySelector('p').textContent = 'Try another package name or search across both ecosystems.';
        resultsCount.textContent = '0 packages';
        return;
      }

      showToast(`Found ${searchData.results.length} package match(es). Fetching deep intelligence...`, 'success');

      // Step 2: Fetch detailed health & stats for the packages in parallel
      const detailPromises = searchData.results.slice(0, 10).map(async (p) => {
        try {
          const detailRes = await fetch(`/api/package/${p.ecosystem}/${encodeURIComponent(p.name)}`);
          if (detailRes.ok) {
            return await detailRes.json();
          }
        } catch (e) {
          console.error(`Failed to fetch details for ${p.name}:`, e);
        }
        return {
          ...p,
          healthScore: 50,
          total30dDownloads: 0,
          downloadsTrend: [],
          license: 'Unknown',
        };
      });

      rawPackages = await Promise.all(detailPromises);
      showLoading(false);
      applyFilterAndSort();

    } catch (err) {
      showLoading(false);
      showToast(`Search failed: ${err.message}`, 'error');
    }
  }

  // -------------------------------------------------------------
  // 3. Filtering & Sorting Engine
  // -------------------------------------------------------------
  function applyFilterAndSort() {
    let filtered = [...rawPackages];

    // Filter by Ecosystem
    if (currentEcosystem !== 'all') {
      filtered = filtered.filter(p => p.ecosystem === currentEcosystem);
    }

    // Filter by License
    const selectedLicense = licenseFilter.value;
    if (selectedLicense === 'permissive') {
      filtered = filtered.filter(p => {
        const lic = (p.license || '').toUpperCase();
        return lic.includes('MIT') || lic.includes('APACHE') || lic.includes('BSD') || lic.includes('ISC');
      });
    } else if (selectedLicense === 'copyleft') {
      filtered = filtered.filter(p => {
        const lic = (p.license || '').toUpperCase();
        return lic.includes('GPL') || lic.includes('AGPL') || lic.includes('LGPL') || lic.includes('MPL');
      });
    }

    // Sort Logic
    const sortVal = sortBy.value;
    if (sortVal === 'downloads') {
      filtered.sort((a, b) => (b.total30dDownloads || 0) - (a.total30dDownloads || 0));
    } else if (sortVal === 'stars') {
      filtered.sort((a, b) => (b.github?.stars || 0) - (a.github?.stars || 0));
    } else if (sortVal === 'health') {
      filtered.sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0));
    } else if (sortVal === 'updated') {
      filtered.sort((a, b) => (a.lastUpdatedDays || 999) - (b.lastUpdatedDays || 999));
    } else if (sortVal === 'issues') {
      filtered.sort((a, b) => (a.github?.openIssues || 0) - (b.github?.openIssues || 0));
    }

    renderCards(filtered);
  }

  // -------------------------------------------------------------
  // 4. Render Results Cards
  // -------------------------------------------------------------
  function renderCards(packages) {
    resultsGrid.innerHTML = '';
    resultsCount.textContent = `${packages.length} package${packages.length === 1 ? '' : 's'}`;

    if (packages.length === 0) {
      emptyState.classList.remove('hidden');
      emptyState.querySelector('h3').textContent = 'No matching packages';
      emptyState.querySelector('p').textContent = 'No packages matched your active filter criteria. Try resetting the license or ecosystem filter.';
      return;
    }

    emptyState.classList.add('hidden');

    packages.forEach(pkg => {
      const card = document.createElement('article');
      card.className = 'package-card';

      const healthClass = (pkg.healthScore || 0) >= 80 ? 'high' : (pkg.healthScore || 0) >= 50 ? 'medium' : 'low';
      const formattedDownloads = formatNumber(pkg.total30dDownloads || 0);
      const formattedStars = pkg.github?.stars !== undefined ? formatNumber(pkg.github.stars) : '—';
      const formattedIssues = pkg.github?.openIssues !== undefined ? formatNumber(pkg.github.openIssues) : '—';

      card.innerHTML = `
        <div class="card-top">
          <div class="pkg-title-area">
            <span class="eco-badge ${pkg.ecosystem}">${pkg.ecosystem}</span>
            <a href="${pkg.links?.registry || '#'}" target="_blank" rel="noopener" class="pkg-name">${escapeHtml(pkg.name)}</a>
            <span class="pkg-version">v${escapeHtml(pkg.version || '1.0.0')}</span>
          </div>
          <div class="health-meter-pill ${healthClass}" title="Algorithmic Health Score">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
            </svg>
            <span>${pkg.healthScore || 50}/100</span>
          </div>
        </div>

        <p class="pkg-description">${escapeHtml(pkg.description || 'No description provided.')}</p>

        <div class="card-stats-grid">
          <div class="stat-item">
            <span class="stat-label">30d Downloads</span>
            <span class="stat-val">${formattedDownloads}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">GitHub Stars</span>
            <span class="stat-val">${formattedStars}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Open Issues</span>
            <span class="stat-val">${formattedIssues}</span>
          </div>
        </div>

        <div class="card-footer">
          <span class="license-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            ${escapeHtml(pkg.license || 'Unknown')}
          </span>

          <button type="button" class="inspect-btn" data-id="${pkg.ecosystem}:${pkg.name}">
            <span>Inspect Deep Dive</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14"></path>
              <path d="m12 5 7 7-7 7"></path>
            </svg>
          </button>
        </div>
      `;

      // Click to inspect
      card.querySelector('.inspect-btn').addEventListener('click', () => {
        openModal(pkg);
      });

      resultsGrid.appendChild(card);
    });
  }

  // -------------------------------------------------------------
  // 5. Package Deep Dive Inspection Modal
  // -------------------------------------------------------------
  function openModal(pkg) {
    modalPkgName.textContent = pkg.name;
    modalPkgVersion.textContent = `v${pkg.version || '1.0.0'}`;
    modalPkgEco.textContent = pkg.ecosystem;
    modalPkgEco.className = `modal-eco-badge eco-badge ${pkg.ecosystem}`;

    const hasTrend = Array.isArray(pkg.downloadsTrend) && pkg.downloadsTrend.length > 0;
    const sparklineSvg = hasTrend ? generateSparklineSvg(pkg.downloadsTrend) : '<p style="color:var(--text-muted);font-size:0.85rem;padding:20px 0;">Download trajectory only available for npm packages.</p>';

    modalBody.innerHTML = `
      <p style="color:var(--text-white);font-size:0.95rem;line-height:1.6;">${escapeHtml(pkg.description || '')}</p>

      <div class="chart-card">
        <div class="chart-header">
          <h4>30-Day Download Trajectory (Daily)</h4>
          <span style="font-family:var(--font-mono);font-size:0.85rem;color:var(--accent-blue);font-weight:600;">
            ${formatNumber(pkg.total30dDownloads || 0)} Total
          </span>
        </div>
        ${sparklineSvg}
      </div>

      <div class="modal-grid-stats">
        <div class="modal-stat-box">
          <div class="box-label">Health Score</div>
          <div class="box-value" style="color:${(pkg.healthScore || 0) >= 80 ? 'var(--accent-green)' : 'var(--accent-yellow)'}">${pkg.healthScore || 50}/100</div>
        </div>
        <div class="modal-stat-box">
          <div class="box-label">License</div>
          <div class="box-value">${escapeHtml(pkg.license || 'Unknown')}</div>
        </div>
        <div class="modal-stat-box">
          <div class="box-label">Last Updated</div>
          <div class="box-value">${pkg.lastUpdatedDays !== 999 ? `${pkg.lastUpdatedDays}d ago` : 'Recent'}</div>
        </div>
        <div class="modal-stat-box">
          <div class="box-label">Dependencies</div>
          <div class="box-value">${pkg.dependenciesCount || 0}</div>
        </div>
      </div>

      <div class="modal-action-links">
        ${pkg.links?.registry ? `<a href="${pkg.links.registry}" target="_blank" rel="noopener" class="action-link-btn primary">Open in ${pkg.ecosystem === 'npm' ? 'npm Registry' : 'PyPI'}</a>` : ''}
        ${pkg.github ? `<a href="https://github.com/${pkg.github.fullName}" target="_blank" rel="noopener" class="action-link-btn secondary">GitHub Repository (${formatNumber(pkg.github.stars)} ★)</a>` : ''}
        ${pkg.homepage ? `<a href="${pkg.homepage}" target="_blank" rel="noopener" class="action-link-btn secondary">Official Homepage</a>` : ''}
      </div>
    `;

    detailsModal.classList.remove('hidden');
  }

  function closeModal() {
    detailsModal.classList.add('hidden');
  }

  // -------------------------------------------------------------
  // 6. SVG Sparkline Generator
  // -------------------------------------------------------------
  function generateSparklineSvg(data) {
    if (!data || data.length < 2) return '';

    const width = 760;
    const height = 130;
    const padding = 15;

    const counts = data.map(d => d.count);
    const min = Math.min(...counts);
    const max = Math.max(...counts) || 1;

    const points = data.map((d, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((d.count - min) / (max - min || 1)) * (height - padding * 2);
      return { x, y, count: d.count, date: d.date };
    });

    const pathD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`, '');
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)},${height} L ${points[0].x.toFixed(1)},${height} Z`;

    return `
      <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#58a6ff" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#58a6ff" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <path class="chart-area" d="${areaD}"></path>
        <path class="chart-line" d="${pathD}"></path>
      </svg>
    `;
  }

  // -------------------------------------------------------------
  // 7. Event Listeners & Helpers
  // -------------------------------------------------------------
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) performSearch(query);
  });

  quickPillList.addEventListener('click', (e) => {
    const pill = e.target.closest('.quick-pill');
    if (pill) {
      const pkg = pill.dataset.pkg;
      searchInput.value = pkg;
      performSearch(pkg);
    }
  });

  ecosystemFilter.addEventListener('click', (e) => {
    const btn = e.target.closest('.segmented-btn');
    if (btn) {
      ecosystemFilter.querySelectorAll('.segmented-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEcosystem = btn.dataset.val;
      applyFilterAndSort();
    }
  });

  licenseFilter.addEventListener('change', applyFilterAndSort);
  sortBy.addEventListener('change', applyFilterAndSort);

  modalCloseBtn.addEventListener('click', closeModal);
  detailsModal.addEventListener('click', (e) => {
    if (e.target === detailsModal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !detailsModal.classList.contains('hidden')) {
      closeModal();
    }
  });

  function showLoading(isLoading) {
    if (isLoading) {
      loadingIndicator.classList.remove('hidden');
    } else {
      loadingIndicator.classList.add('hidden');
    }
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toLocaleString();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial trending scan
  performSearch('express');
});
