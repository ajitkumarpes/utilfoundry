const refreshButton = document.querySelector('#refresh-button');
const refreshState = document.querySelector('#refresh-state');
const errorBanner = document.querySelector('#error-banner');
const serviceNames = {
  db: ['DB', 'PostgreSQL', 'Persistent job metadata'],
  redis: ['R', 'Redis', 'Shared request rate limits'],
  objectStorage: ['S3', 'Object storage', 'MinIO / S3 document objects'],
  processor: ['P', 'Document processor', 'OCR and Office conversion worker'],
  diskSpace: ['D', 'Application disk', 'Backend container filesystem'],
  ssl: ['TLS', 'SSL certificates', 'Configured certificate validity'],
};

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

async function getJson(path) {
  const response = await fetch(path, { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

async function metric(name, tag) {
  const suffix = tag ? `?tag=${encodeURIComponent(tag)}` : '';
  try {
    const data = await getJson(`/actuator/metrics/${name}${suffix}`);
    return data.measurements?.find(item => item.statistic === 'VALUE' || item.statistic === 'COUNT')?.value ?? null;
  } catch (_) {
    return null;
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${number.format(value)} ${units[index]}`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m ${Math.floor(seconds % 60)}s`;
}

function percent(value) {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function setMeter(id, value) {
  const meter = document.querySelector(id);
  meter.style.width = `${percent(value)}%`;
  meter.style.background = value > 90 ? 'var(--red)' : value > 75 ? 'var(--amber)' : 'var(--green)';
}

function serviceDetail(key, component) {
  const details = component.details || {};
  if (key === 'db') return details.database || serviceNames[key][2];
  if (key === 'redis') return details.version ? `Redis ${details.version}` : serviceNames[key][2];
  if (key === 'diskSpace') return `${formatBytes(details.free)} free`;
  if (key === 'ssl') return `${details.validChains?.length || 0} valid certificate chains`;
  return serviceNames[key][2];
}

function renderHealth(health) {
  const overall = health.status || 'UNKNOWN';
  const isUp = overall === 'UP';
  const icon = document.querySelector('#overall-icon');
  icon.className = `status-icon ${isUp ? 'up' : 'down'}`;
  icon.textContent = isUp ? '✓' : '!';
  document.querySelector('#overall-status').textContent = isUp ? 'All systems operational' : `Platform ${overall.toLowerCase()}`;

  const components = health.components || {};
  const keys = Object.keys(serviceNames).filter(key => components[key]);
  document.querySelector('#services').innerHTML = keys.map(key => {
    const component = components[key];
    const state = component.status || 'UNKNOWN';
    const css = state === 'UP' ? 'up' : state === 'DOWN' ? 'down' : 'unknown';
    const [iconText, label] = serviceNames[key];
    return `<article class="service-card">
      <div class="service-head"><span class="service-icon" aria-hidden="true">${iconText}</span><span class="badge ${css}">${state}</span></div>
      <h3>${label}</h3><p>${serviceDetail(key, component)}</p>
    </article>`;
  }).join('');
}

async function renderMetrics() {
  const [uptime, cpu, heapUsed, heapMax, diskFree, diskTotal, dbActive, dbMax, requests] = await Promise.all([
    metric('process.uptime'), metric('system.cpu.usage'),
    metric('jvm.memory.used', 'area:heap'), metric('jvm.memory.max', 'area:heap'),
    metric('disk.free'), metric('disk.total'),
    metric('hikaricp.connections.active'), metric('hikaricp.connections.max'),
    metric('http.server.requests'),
  ]);
  const cpuPercent = cpu === null ? null : cpu * 100;
  const memoryPercent = heapUsed !== null && heapMax ? heapUsed / heapMax * 100 : null;
  const diskUsedPercent = diskFree !== null && diskTotal ? (diskTotal - diskFree) / diskTotal * 100 : null;

  document.querySelector('#metric-uptime').textContent = formatDuration(uptime);
  document.querySelector('#metric-cpu').textContent = cpuPercent === null ? '—' : `${number.format(cpuPercent)}%`;
  document.querySelector('#metric-memory').textContent = heapUsed === null ? '—' : `${formatBytes(heapUsed)} / ${formatBytes(heapMax)}`;
  document.querySelector('#metric-disk').textContent = diskFree === null ? '—' : formatBytes(diskFree);
  document.querySelector('#metric-db').textContent = dbActive === null ? '—' : `${number.format(dbActive)} / ${number.format(dbMax)}`;
  document.querySelector('#metric-requests').textContent = requests === null ? '—' : number.format(requests);
  setMeter('#cpu-meter', cpuPercent);
  setMeter('#memory-meter', memoryPercent);
  setMeter('#disk-meter', diskUsedPercent);
}

async function refresh() {
  refreshButton.disabled = true;
  refreshState.textContent = 'Refreshing…';
  errorBanner.hidden = true;
  try {
    const health = await getJson('/actuator/health');
    renderHealth(health);
    await renderMetrics();
    const checkedAt = new Date();
    document.querySelector('#last-checked').textContent = checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    refreshState.textContent = 'Live';
  } catch (error) {
    refreshState.textContent = 'Connection issue';
    document.querySelector('#error-message').textContent = error.message;
    errorBanner.hidden = false;
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
refresh();
setInterval(() => { if (!document.hidden) refresh(); }, 15000);
