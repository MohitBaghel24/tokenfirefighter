import * as http from 'http';
import { Config, SessionState } from './types.js';
import { getDb } from './logger.js';

interface DashboardAlert {
  id: string;
  type: 'loop_alert' | 'budget_warning' | 'budget_alert';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
}

const alerts: DashboardAlert[] = [];
const eventClients: http.ServerResponse[] = [];

export function addAlert(alert: DashboardAlert) {
  alerts.unshift(alert);
  if (alerts.length > 50) alerts.length = 50;
}

export function broadcastEvent(event: { type: string; data: any }) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (let i = eventClients.length - 1; i >= 0; i--) {
    const client = eventClients[i];
    if (!client.writableEnded) {
      client.write(payload);
    } else {
      eventClients.splice(i, 1);
    }
  }
}

export function handleSSE(req: http.IncomingMessage, res: http.ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  eventClients.push(res);
  
  req.on('close', () => {
    const index = eventClients.indexOf(res);
    if (index !== -1) {
      eventClients.splice(index, 1);
    }
  });
}

export function handleApi(req: http.IncomingMessage, res: http.ServerResponse, urlPath: string, config: Config, sessions: Map<string, SessionState>) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const db = getDb();
  if (!db) {
    res.writeHead(503);
    res.end(JSON.stringify({ error: 'Database not initialized' }));
    return;
  }

  const queryParams = new URL(req.url!, `http://${req.headers.host}`).searchParams;

  try {
    if (urlPath === '/api/status') {
      let totalDailySpend = 0;
      let totalSessionSpend = 0;
      let totalCalls = 0;
      let status = 'ok';
      
      for (const state of sessions.values()) {
        totalDailySpend += state.dailySpend;
        totalSessionSpend += state.sessionSpend;
        totalCalls += state.callCount;
        if (state.lastCallStatus === 'warning') status = 'warning';
      }
      
      res.writeHead(200);
      res.end(JSON.stringify({
        daily_spend: totalDailySpend,
        daily_limit: config.budget.daily_max_usd,
        daily_percent: config.budget.daily_max_usd > 0 ? (totalDailySpend / config.budget.daily_max_usd) * 100 : 0,
        session_spend: totalSessionSpend,
        session_limit: config.budget.session_max_usd,
        session_percent: config.budget.session_max_usd > 0 ? (totalSessionSpend / config.budget.session_max_usd) * 100 : 0,
        total_calls: totalCalls,
        session_count: sessions.size,
        status,
        uptime_seconds: process.uptime(),
        timestamp: Date.now()
      }));
    } else if (urlPath === '/api/recent') {
      const limit = parseInt(queryParams.get('limit') || '50', 10);
      const rows = db.prepare(`SELECT timestamp, provider, model, endpoint, input_tokens, output_tokens, cost_usd, blocked, http_status FROM requests ORDER BY timestamp DESC LIMIT ?`).all(limit);
      res.writeHead(200);
      res.end(JSON.stringify(rows));
    } else if (urlPath === '/api/providers') {
      const ts = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); 
      const rows = db.prepare(`SELECT provider, model, SUM(cost_usd) as total_cost, COUNT(*) as call_count FROM requests WHERE timestamp > ? GROUP BY provider, model ORDER BY total_cost DESC`).all(ts);
      res.writeHead(200);
      res.end(JSON.stringify(rows));
    } else if (urlPath === '/api/history') {
      const period = queryParams.get('period') || '24h';
      const hoursBack = period === '24h' ? 24 : 7 * 24;
      const ts = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      const rows = db.prepare(`SELECT strftime('%Y-%m-%d %H:00', timestamp) as hour, SUM(cost_usd) as total_cost, COUNT(*) as call_count FROM requests WHERE timestamp > ? GROUP BY hour ORDER BY hour ASC`).all(ts);
      res.writeHead(200);
      res.end(JSON.stringify(rows));
    } else if (urlPath === '/api/alerts') {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const filtered = alerts.filter(a => a.timestamp > oneHourAgo);
      res.writeHead(200);
      res.end(JSON.stringify(filtered));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (err: any) {
    if (err.message.includes('no such table')) {
      res.writeHead(200);
      res.end(JSON.stringify([]));
    } else {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
}

export function serveDashboard(res: http.ServerResponse) {
  res.writeHead(200, {
    'Content-Type': 'text/html',
    'Cache-Control': 'no-cache'
  });
  res.end(dashboardHtml);
}

const dashboardHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TFF | Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg: #0e0e0e;
      --card-bg: #151515;
      --text: #e0e0e0;
      --text-muted: #888;
      --border: #252525;
      --green: #2ecc71;
      --yellow: #f1c40f;
      --orange: #e67e22;
      --red: #e74c3c;
    }
    
    [data-theme="light"] {
      --bg: #f5f6fa;
      --card-bg: #ffffff;
      --text: #2c3e50;
      --text-muted: #7f8c8d;
      --border: #dcdde1;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      transition: background 0.3s, color 0.3s;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      border-bottom: 1px solid var(--border);
      background: var(--card-bg);
    }

    h1 {
      margin: 0;
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .live-pulse {
      color: var(--green);
      font-weight: bold;
      animation: pulse 2s infinite;
      font-size: 0.9rem;
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }
    
    @keyframes flashRed {
      0% { background: var(--card-bg); }
      50% { background: rgba(231, 76, 60, 0.2); }
      100% { background: var(--card-bg); }
    }
    
    .flash-alert {
      animation: flashRed 0.5s 6;
    }

    #themeToggle {
      background: none;
      border: 1px solid var(--border);
      color: var(--text);
      cursor: pointer;
      font-size: 1.2rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
    }

    main {
      padding: 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .grid {
      display: grid;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .grid-4 { grid-template-columns: repeat(4, 1fr); }
    .grid-2 { grid-template-columns: repeat(2, 1fr); }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.05);
      animation: fadeUp 0.4s ease-out;
      transition: background 0.2s;
    }
    .card:hover {
      background: var(--bg); /* slight shift */
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .card .big {
      display: block;
      font-size: 2rem;
      font-weight: bold;
      margin-top: 0.5rem;
    }

    .green { color: var(--green); }
    .yellow { color: var(--yellow); }
    .orange { color: var(--orange); }
    .red { color: var(--red); }

    .progress-label {
      font-size: 0.9rem;
      margin-top: 1rem;
      margin-bottom: 0.3rem;
      display: flex;
      justify-content: space-between;
    }
    
    .progress-track {
      background: var(--border);
      height: 12px;
      border-radius: 6px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: var(--green);
      transition: width 0.3s ease, background 0.3s ease;
    }

    .table-wrap {
      max-height: 400px;
      overflow-y: auto;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    
    th, td {
      padding: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    
    th {
      position: sticky;
      top: 0;
      background: var(--card-bg);
      z-index: 1;
      font-size: 0.85rem;
      color: var(--text-muted);
      text-transform: uppercase;
    }
    
    .cost-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 6px;
    }

    .alerts-list {
      max-height: 400px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .alert-item {
      padding: 0.75rem;
      border-radius: 4px;
      border-left: 4px solid var(--red);
      background: rgba(231, 76, 60, 0.1);
      font-size: 0.9rem;
    }
    .alert-item.warning {
      border-left-color: var(--yellow);
      background: rgba(241, 196, 15, 0.1);
    }

    #budgetBanner {
      display: none;
      background: var(--red);
      color: white;
      text-align: center;
      padding: 0.5rem;
      font-weight: bold;
    }

    @media (max-width: 768px) {
      .grid-4 { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 480px) {
      .grid-4, .grid-2 { grid-template-columns: 1fr; }
      .hide-mobile { display: none; }
    }
  </style>
</head>
<body>

  <div id="budgetBanner">CRITICAL BUDGET ALERT: Spends Exceeded!</div>

  <header>
    <h1>🧯 TokenFirefighter <span class="live-pulse">● LIVE</span></h1>
    <button id="themeToggle">🌓</button>
  </header>

  <main>
    <div class="grid grid-4">
      <div class="card" id="cardDaily">Today's Spend<br><span class="big" id="dailySpend">$0.00</span></div>
      <div class="card" id="cardSession">Session Spend<br><span class="big" id="sessionSpend">$0.00</span></div>
      <div class="card" id="cardCalls">Total Calls<br><span class="big" id="totalCalls">0</span></div>
      <div class="card" id="cardStatus">Status<br><span class="big green" id="globalStatus">OK</span></div>
    </div>

    <div class="card">
      <div class="progress-label">Daily Budget <span id="dailyText">$0 / $0</span></div>
      <div class="progress-track"><div class="progress-fill" id="dailyBar" style="width:0%"></div></div>
      
      <div class="progress-label">Session Budget <span id="sessionText">$0 / $0</span></div>
      <div class="progress-track"><div class="progress-fill" id="sessionBar" style="width:0%"></div></div>
    </div>

    <div class="grid grid-2">
      <div class="card"><canvas id="spendChart"></canvas></div>
      <div class="card"><canvas id="providerChart"></canvas></div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <h3>Recent Calls</h3>
        <div class="table-wrap">
          <table id="recentTable">
            <thead>
              <tr>
                <th class="hide-mobile">Time</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
      <div class="card" id="alertsCard">
        <h3>Active Alerts</h3>
        <div id="alertsPanel" class="alerts-list"></div>
      </div>
    </div>
  </main>

  <script>
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'light') document.body.setAttribute('data-theme', 'light');
    
    themeToggle.addEventListener('click', () => {
      const isLight = document.body.getAttribute('data-theme') === 'light';
      if (isLight) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
      } else {
        document.body.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      }
      Chart.defaults.color = isLight ? '#e0e0e0' : '#2c3e50'; // Swap chart colors roughly
      if(spendChart) spendChart.update();
      if(providerChart) providerChart.update();
    });

    // Alert sound base64 (short blip)
    const alertSound = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"+Array(200).join("A"));
    function playAlert() {
      alertSound.play().catch(e => console.log('Audio blocked', e));
    }

    Chart.defaults.color = currentTheme === 'light' ? '#2c3e50' : '#e0e0e0';

    let spendChart;
    let providerChart;

    function getCostColor(cost) {
      if (cost < 0.5) return 'var(--green)';
      if (cost < 2.0) return 'var(--yellow)';
      if (cost < 5.0) return 'var(--orange)';
      return 'var(--red)';
    }

    function getColorClass(percent) {
      if (percent < 50) return 'var(--green)';
      if (percent < 80) return 'var(--yellow)';
      if (percent <= 100) return 'var(--orange)';
      return 'var(--red)';
    }

    function initCharts() {
      const ctx1 = document.getElementById('spendChart').getContext('2d');
      spendChart = new Chart(ctx1, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Hourly Spend (USD)', data: [], borderColor: '#2ecc71', tension: 0.1 }] },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
      });

      const ctx2 = document.getElementById('providerChart').getContext('2d');
      providerChart = new Chart(ctx2, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Cost by Provider', data: [], backgroundColor: '#3498db' }] },
        options: { responsive: true }
      });
    }

    async function fetchStatus() {
      try {
        const r = await fetch('/api/status');
        const d = await r.json();
        document.getElementById('dailySpend').innerText = '$' + d.daily_spend.toFixed(2);
        document.getElementById('sessionSpend').innerText = '$' + d.session_spend.toFixed(2);
        document.getElementById('totalCalls').innerText = d.total_calls;
        
        const statusEl = document.getElementById('globalStatus');
        statusEl.innerText = d.status.toUpperCase();
        statusEl.className = 'big ' + (d.status === 'ok' ? 'green' : (d.status === 'warning' ? 'yellow' : 'red'));

        document.getElementById('dailyText').innerText = \`$\${d.daily_spend.toFixed(2)} / $\${d.daily_limit}\`;
        document.getElementById('dailyBar').style.width = Math.min(d.daily_percent, 100) + '%';
        document.getElementById('dailyBar').style.background = getColorClass(d.daily_percent);

        document.getElementById('sessionText').innerText = \`$\${d.session_spend.toFixed(2)} / $\${d.session_limit}\`;
        document.getElementById('sessionBar').style.width = Math.min(d.session_percent, 100) + '%';
        document.getElementById('sessionBar').style.background = getColorClass(d.session_percent);

        document.title = \`TFF | $\${d.daily_spend.toFixed(2)} / $\${d.daily_limit}\`;
      } catch (e) { console.error('Status fetch error', e); }
    }

    async function fetchRecent() {
      try {
        const r = await fetch('/api/recent?limit=50');
        const rows = await r.json();
        const tb = document.querySelector('#recentTable tbody');
        tb.innerHTML = '';
        rows.forEach(row => {
          const tr = document.createElement('tr');
          const costColor = getCostColor(row.cost_usd);
          tr.innerHTML = \`
            <td class="hide-mobile">\${new Date(row.timestamp).toLocaleTimeString()}</td>
            <td>\${row.provider}</td>
            <td>\${row.model}</td>
            <td><span class="cost-dot" style="background:\${costColor}"></span> $\${row.cost_usd.toFixed(4)}</td>
            <td><span class="\${row.blocked ? 'red' : 'green'}">\${row.blocked ? 'BLOCKED' : row.http_status}</span></td>
          \`;
          tb.appendChild(tr);
        });
      } catch (e) { console.error(e); }
    }

    async function fetchCharts() {
      try {
        const r1 = await fetch('/api/history?period=24h');
        const hist = await r1.json();
        spendChart.data.labels = hist.map(h => h.hour.split(' ')[1]);
        spendChart.data.datasets[0].data = hist.map(h => h.total_cost);
        spendChart.update();

        const r2 = await fetch('/api/providers');
        const provs = await r2.json();
        providerChart.data.labels = provs.map(p => p.provider + '-' + p.model);
        providerChart.data.datasets[0].data = provs.map(p => p.total_cost);
        providerChart.update();
      } catch(e) {}
    }

    async function fetchAlerts() {
      try {
        const r = await fetch('/api/alerts');
        const alerts = await r.json();
        renderAlerts(alerts);
      } catch(e) {}
    }

    function renderAlerts(alerts) {
      const panel = document.getElementById('alertsPanel');
      panel.innerHTML = '';
      alerts.forEach(a => {
        const d = document.createElement('div');
        d.className = 'alert-item ' + (a.severity === 'warning' ? 'warning' : 'critical');
        d.innerText = \`[\${new Date(a.timestamp).toLocaleTimeString()}] \${a.message}\`;
        panel.appendChild(d);
      });
    }

    function flashAlertPanel() {
      const panel = document.getElementById('alertsCard');
      panel.classList.remove('flash-alert');
      void panel.offsetWidth; // trigger reflow
      panel.classList.add('flash-alert');
    }

    function showBudgetBanner() {
      document.getElementById('budgetBanner').style.display = 'block';
    }

    function addRecentRowLocally(data) {
      const tb = document.querySelector('#recentTable tbody');
      const tr = document.createElement('tr');
      const costColor = getCostColor(data.cost_usd);
      tr.innerHTML = \`
        <td class="hide-mobile">\${new Date().toLocaleTimeString()}</td>
        <td>\${data.provider}</td>
        <td>\${data.model}</td>
        <td><span class="cost-dot" style="background:\${costColor}"></span> $\${data.cost_usd.toFixed(4)}</td>
        <td><span class="\${data.blocked ? 'red' : 'green'}">\${data.blocked ? 'BLOCKED' : data.http_status}</span></td>
      \`;
      if (tb.firstChild) tb.insertBefore(tr, tb.firstChild);
      else tb.appendChild(tr);
      
      if (tb.children.length > 50) tb.removeChild(tb.lastChild);
    }

    // Initialize
    initCharts();
    fetchStatus();
    fetchRecent();
    fetchCharts();
    fetchAlerts();

    // Polling fallback
    setInterval(() => {
      fetchStatus();
      fetchCharts();
    }, 5000);

    // SSE Setup
    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === 'call_complete') {
        addRecentRowLocally(ev.data);
        fetchStatus();
      } else if (ev.type === 'budget_alert') {
        showBudgetBanner();
        playAlert();
        fetchAlerts();
      } else if (ev.type === 'loop_alert') {
        flashAlertPanel();
        playAlert();
        fetchAlerts();
      } else if (ev.type === 'budget_warning') {
        fetchAlerts();
      }
    };
  </script>
</body>
</html>
`;
