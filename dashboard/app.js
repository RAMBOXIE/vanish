async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Unable to load ${path}`);
  }
  return response.json();
}

let refreshTimer = null;

function setupRefresh() {
  const controls = document.getElementById('refresh-controls');
  controls.addEventListener('change', event => {
    if (event.target.name !== 'refresh') return;
    if (refreshTimer) clearInterval(refreshTimer);
    const seconds = Number(event.target.value);
    if (seconds > 0) {
      refreshTimer = setInterval(renderDashboard, seconds * 1000);
    }
  });
}

function renderCounters(status) {
  const counters = status.counters || {};
  const root = document.getElementById('counters');
  root.innerHTML = Object.entries(counters).map(([label, value]) => `
    <div class="counter">
      <span>${humanize(label)}</span>
      <strong>${value}</strong>
    </div>
  `).join('');
}

function renderTable(rootId, rows) {
  const root = document.getElementById(rootId);
  if (!rows.length) {
    root.innerHTML = '<p class="empty">No items queued.</p>';
    return;
  }

  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  root.innerHTML = `
    <table>
      <thead>
        <tr>${columns.map(column => `<th>${humanize(column)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map(row => `
          <tr>${columns.map(column => `<td>${row[column] ?? ''}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function humanize(value) {
  return value.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').trim();
}

async function renderDashboard() {
  const [retry, manualReview, deadLetter, completed, failed, status] = await Promise.all([
    loadJson('./data/retry-queue.json'),
    loadJson('./data/manual-review-queue.json'),
    loadJson('./data/dead-letter-queue.json'),
    loadJson('./data/completed.json'),
    loadJson('./data/failed.json'),
    loadJson('./data/status.json')
  ]);

  renderCounters(status);
  renderTable('retry-queue', retry);
  renderTable('manual-review-queue', manualReview);
  renderTable('dead-letter-queue', deadLetter);
  renderTable('completed', completed);
  renderTable('failed', failed);
}

try {
  setupRefresh();
  await renderDashboard();
} catch (error) {
  document.body.insertAdjacentHTML('beforeend', `<p class="error">${error.message}</p>`);
}
