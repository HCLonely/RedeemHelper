import { request } from '../../shared/http';
import { extractItchHrefs, prepareItchRedeemQueue, redeemItchQueue } from './extract';
import itchFreeListSites from './itchFreeListSite.json';
import type { ItchBatchResult, ItchLogEvent, ItchReporter } from './types';

const CONFIG_KEY = 'itchAutoClaimConfig';
const RUNTIME_KEY = 'itchAutoClaimRuntime';
const MAX_LOG_ENTRIES = 300;
const HEARTBEAT_INTERVAL_MS = 30_000;
const KEEPALIVE_REQUEST_INTERVAL_MS = 4 * 60_000;

interface AutoClaimConfig {
  sites: string[];
  intervalHours: number;
  keepAlive: boolean;
}

interface AutoClaimRuntime {
  running: boolean;
  nextRunAt: number | null;
  lastRunAt: number | null;
}

interface AutoClaimStats extends ItchBatchResult {
  cycles: number;
  sourceSucceeded: number;
  sourceFailed: number;
  rawLinks: number;
  uniqueLinks: number;
  pending: number;
}

type WakeLockHandle = EventTarget & { released: boolean; release: () => Promise<void> };

const DEFAULT_CONFIG: AutoClaimConfig = {
  sites: [...itchFreeListSites],
  intervalHours: 6,
  keepAlive: false
};

const EMPTY_STATS: AutoClaimStats = {
  cycles: 0,
  sourceSucceeded: 0,
  sourceFailed: 0,
  rawLinks: 0,
  uniqueLinks: 0,
  total: 0,
  claimed: 0,
  owned: 0,
  expired: 0,
  loginRequired: 0,
  failed: 0,
  cannot: 0,
  pending: 0,
  unknown: 0
};

function normalizeConfig(value: Partial<AutoClaimConfig> | null | undefined): AutoClaimConfig {
  const configuredSites = Array.isArray(value?.sites)
    ? value.sites.filter((site): site is string => itchFreeListSites.includes(site))
    : DEFAULT_CONFIG.sites;
  const interval = Number(value?.intervalHours);

  return {
    sites: [...new Set(configuredSites)],
    intervalHours: Number.isFinite(interval) && interval >= 0.1 ? interval : DEFAULT_CONFIG.intervalHours,
    keepAlive: typeof value?.keepAlive === 'boolean' ? value.keepAlive : DEFAULT_CONFIG.keepAlive
  };
}

function loadConfig(): AutoClaimConfig {
  return normalizeConfig(GM_getValue<Partial<AutoClaimConfig>>(CONFIG_KEY, {}));
}

function saveConfig(config: AutoClaimConfig): void {
  GM_setValue(CONFIG_KEY, {
    sites: [...config.sites],
    intervalHours: config.intervalHours,
    keepAlive: config.keepAlive
  });
}

function loadRuntime(): AutoClaimRuntime {
  const saved = GM_getValue<Partial<AutoClaimRuntime>>(RUNTIME_KEY, {});
  return {
    running: saved.running === true,
    nextRunAt: Number.isFinite(saved.nextRunAt) ? saved.nextRunAt! : null,
    lastRunAt: Number.isFinite(saved.lastRunAt) ? saved.lastRunAt! : null
  };
}

function saveRuntime(runtime: AutoClaimRuntime): void {
  GM_setValue(RUNTIME_KEY, { ...runtime });
}

function formatTime(timestamp: number | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
}

function createHeartbeatWorker(onTick: () => void): Worker | null {
  try {
    const source = `setInterval(() => postMessage('tick'), ${HEARTBEAT_INTERVAL_MS}); postMessage('tick');`;
    const objectUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const worker = new Worker(objectUrl);
    URL.revokeObjectURL(objectUrl);
    worker.addEventListener('message', onTick);
    return worker;
  } catch {
    return null;
  }
}

const CONSOLE_CSS = `
  :host{all:initial;display:block;min-height:100vh;color-scheme:light;font-family:Inter,"Segoe UI","Microsoft YaHei",sans-serif;color:#172033}
  *{box-sizing:border-box}
  button,input{font:inherit}
  .app{min-height:100vh;background:#f3f6fb;padding:24px}
  .shell{max-width:1180px;margin:0 auto}
  .header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}
  h1{font-size:26px;line-height:1.2;margin:0 0 6px;color:#172033}
  .subtitle{font-size:14px;color:#667085}
  .status{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#fff;border:1px solid #dce3ed;font-size:13px;font-weight:700}
  .dot{width:9px;height:9px;border-radius:50%;background:#98a2b3}.dot.running{background:#16a34a;box-shadow:0 0 0 4px #dcfce7}.dot.error{background:#dc2626}
  .grid{display:grid;grid-template-columns:minmax(310px,0.8fr) minmax(460px,1.2fr);gap:18px;align-items:start}
  .card{background:#fff;border:1px solid #dce3ed;border-radius:14px;box-shadow:0 8px 24px rgba(28,39,60,.06);padding:20px}
  .card-title{font-size:16px;font-weight:750;margin:0 0 16px;color:#172033}
  .field{margin-bottom:18px}.label{display:block;font-size:13px;font-weight:700;margin-bottom:8px;color:#344054}
  .sites{display:grid;gap:9px}.site{display:flex;gap:9px;align-items:flex-start;padding:10px;border:1px solid #e4e9f1;border-radius:9px;background:#f9fbfd;font-size:13px;word-break:break-all}.site input{margin-top:2px}
  .interval-row{display:flex;align-items:center;gap:9px}.interval{width:120px;border:1px solid #cfd8e5;border-radius:8px;padding:9px 10px;color:#172033}
  .switch-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.switch{position:relative;width:46px;height:25px}.switch input{opacity:0;width:0;height:0}.slider{position:absolute;inset:0;background:#cbd5e1;border-radius:30px;cursor:pointer;transition:.2s}.slider:before{content:"";position:absolute;width:19px;height:19px;left:3px;top:3px;background:white;border-radius:50%;transition:.2s;box-shadow:0 1px 4px rgba(0,0,0,.25)}.switch input:checked + .slider{background:#2563eb}.switch input:checked + .slider:before{transform:translateX(21px)}
  .hint{font-size:12px;line-height:1.55;color:#667085;margin-top:8px}
  .browser-tip{margin-top:10px;padding:10px 11px;border:1px solid #bfdbfe;border-radius:9px;background:#eff6ff;color:#1e3a8a;font-size:12px;line-height:1.6}.browser-tip code{padding:2px 5px;border-radius:5px;background:#dbeafe;color:#1e40af;word-break:break-all}.copy-site{margin-left:7px;border:0;border-radius:6px;padding:3px 7px;background:#2563eb;color:#fff;font-size:11px;font-weight:700;cursor:pointer}
  .actions{display:flex;gap:9px;flex-wrap:wrap}.btn{border:0;border-radius:9px;padding:10px 15px;font-weight:700;cursor:pointer}.primary{background:#2563eb;color:#fff}.primary.stop{background:#dc2626}.secondary{background:#eef2f7;color:#344054}.btn:disabled{opacity:.5;cursor:not-allowed}
  .keepalive{margin-top:18px;border-top:1px solid #edf0f5;padding-top:15px;display:grid;grid-template-columns:1fr auto;gap:8px;font-size:12px}.keepalive span:nth-child(odd){color:#667085}.keepalive span:nth-child(even){font-weight:700;text-align:right}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}.stat{padding:12px;border-radius:10px;background:#f7f9fc;border:1px solid #e8edf4}.stat b{display:block;font-size:21px;margin-bottom:3px}.stat span{font-size:11px;color:#667085}
  .times{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 16px;font-size:12px;color:#667085}.times b{color:#344054}
  .log-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.log-actions{display:flex;gap:7px}.mini{border:0;border-radius:7px;background:#eef2f7;color:#344054;padding:6px 9px;font-size:12px;cursor:pointer}
  .logs{height:480px;overflow:auto;background:#111827;border-radius:10px;padding:12px;color:#d1d5db;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}.log{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04);word-break:break-all}.log .time{color:#7f8ea3}.log .level{display:inline-block;width:62px;font-weight:700}.log.info .level{color:#60a5fa}.log.success .level{color:#4ade80}.log.warning .level{color:#fbbf24}.log.error .level{color:#f87171}.details{color:#aeb8c7}
  @media(max-width:850px){.app{padding:14px}.grid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,1fr)}.header{align-items:flex-start;flex-direction:column}.logs{height:400px}}
`;

export function mountItchAutoConsole(): void {
  const host = document.createElement('div');
  host.id = 'redeem-helper-itch-auto-console';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${CONSOLE_CSS}</style>
    <main class="app"><div class="shell">
      <header class="header"><div><h1>itch.io 自动领取控制台</h1><div class="subtitle">并发采集免费列表，顺序领取 itch.io 游戏</div></div><div class="status"><i class="dot"></i><span data-status>未启动</span></div></header>
      <div class="grid">
        <section class="card"><h2 class="card-title">参数配置</h2>
          <div class="field"><span class="label">站点（可多选）</span><div class="sites" data-sites></div></div>
          <label class="field"><span class="label">循环间隔</span><span class="interval-row"><input class="interval" data-interval type="number" min="0.1" step="0.1"><span>小时</span></span></label>
          <div class="field"><div class="switch-row"><span class="label" style="margin:0">页面保活</span><label class="switch"><input data-keepalive type="checkbox"><span class="slider"></span></label></div><div class="hint">使用屏幕唤醒锁、Worker 心跳和恢复补跑尽可能避免休眠；浏览器关闭、系统休眠或强制丢弃标签页时无法保证运行。</div><div class="browser-tip">建议同时打开浏览器的“设置 → 性能”，在“始终保持这些网站处于活动状态”或“永不让这些站点进入休眠”中添加当前站点：<code data-current-site></code><button class="copy-site" data-copy-site>复制站点</button></div></div>
          <div class="actions"><button class="btn primary" data-start>启动自动领取</button><button class="btn secondary" data-run-once>立即执行一次</button></div>
          <div class="keepalive"><span>Wake Lock</span><span data-wake>未启用</span><span>Worker 心跳</span><span data-heartbeat>未启动</span><span>页面状态</span><span data-visibility>前台</span><span>最近心跳</span><span data-heartbeat-time>—</span><span>临时资源</span><span data-resource>已清理</span></div>
        </section>
        <section class="card"><div class="log-head"><h2 class="card-title" style="margin:0">运行统计</h2><span data-log-count>日志 0 / ${MAX_LOG_ENTRIES}</span></div>
          <div class="times"><span>上次执行：<b data-last-run>—</b></span><span>下次执行：<b data-next-run>—</b></span></div>
          <div class="stats">
            <div class="stat"><b data-stat="cycles">0</b><span>运行轮次</span></div><div class="stat"><b data-stat="sources">0/0</b><span>来源成功/失败</span></div>
            <div class="stat"><b data-stat="rawLinks">0</b><span>原始链接</span></div><div class="stat"><b data-stat="uniqueLinks">0</b><span>去重后</span></div>
            <div class="stat"><b data-stat="pending">0</b><span>本轮待入库（去除已拥有，需配合<a href="https://github.com/HCLonely/Game-library-check" target="_blank">游戏库检测脚本</a>）</span></div>
            <div class="stat"><b data-stat="claimed">0</b><span>新领取</span></div><div class="stat"><b data-stat="owned">0</b><span>已拥有</span></div>
            <div class="stat"><b data-stat="expired">0</b><span>已失效</span></div><div class="stat"><b data-stat="failed">0</b><span>失败/需登录/未知</span></div>
          </div>
          <div class="log-head"><h2 class="card-title" style="margin:0">详细日志</h2><div class="log-actions"><button class="mini" data-clear>清空日志</button><button class="mini" data-copy>复制日志</button></div></div>
          <div class="logs" data-logs></div>
        </section>
      </div>
    </div></main>`;

  document.body.replaceChildren(host);
  document.body.removeAttribute('class');
  document.body.removeAttribute('style');
  document.body.style.margin = '0';
  document.body.style.minWidth = '320px';
  document.title = 'itch.io 自动领取控制台';

  const config = loadConfig();
  let runtime = loadRuntime();
  const stats = { ...EMPTY_STATS };
  const logEntries: ItchLogEvent[] = [];
  let cycleActive = false;
  let heartbeatWorker: Worker | null = null;
  let wakeLock: WakeLockHandle | null = null;
  let lastKeepaliveRequestAt = 0;

  const get = <T extends Element>(selector: string): T => shadow.querySelector<T>(selector)!;
  const sitesEl = get<HTMLDivElement>('[data-sites]');
  const intervalEl = get<HTMLInputElement>('[data-interval]');
  const keepaliveEl = get<HTMLInputElement>('[data-keepalive]');
  const startEl = get<HTMLButtonElement>('[data-start]');
  const runOnceEl = get<HTMLButtonElement>('[data-run-once]');
  const logsEl = get<HTMLDivElement>('[data-logs]');

  const setText = (selector: string, value: string): void => { get<HTMLElement>(selector).textContent = value; };
  const updateStatus = (text: string, active = false, error = false): void => {
    setText('[data-status]', text);
    get<HTMLElement>('.dot').className = `dot${active ? ' running' : ''}${error ? ' error' : ''}`;
  };
  const updateRuntimeUi = (): void => {
    startEl.textContent = runtime.running ? '停止自动领取' : '启动自动领取';
    startEl.classList.toggle('stop', runtime.running);
    setText('[data-last-run]', formatTime(runtime.lastRunAt));
    setText('[data-next-run]', formatTime(runtime.nextRunAt));
  };
  const updateStats = (): void => {
    setText('[data-stat="cycles"]', String(stats.cycles));
    setText('[data-stat="sources"]', `${stats.sourceSucceeded}/${stats.sourceFailed}`);
    setText('[data-stat="rawLinks"]', String(stats.rawLinks));
    setText('[data-stat="uniqueLinks"]', String(stats.uniqueLinks));
    setText('[data-stat="pending"]', String(stats.pending));
    setText('[data-stat="claimed"]', String(stats.claimed));
    setText('[data-stat="owned"]', String(stats.owned));
    setText('[data-stat="expired"]', String(stats.expired));
    setText('[data-stat="failed"]', String(stats.failed + stats.loginRequired + stats.unknown));
  };
  const reporter: ItchReporter = (entry) => {
    logEntries.push(entry);
    const row = document.createElement('div');
    row.className = `log ${entry.level}`;
    const time = new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour12: false });
    row.textContent = `${time}  ${entry.level.toUpperCase().padEnd(7)} ${entry.message}${entry.details ? `  ${entry.details}` : ''}`;
    logsEl.append(row);
    while (logEntries.length > MAX_LOG_ENTRIES) logEntries.shift();
    while (logsEl.childElementCount > MAX_LOG_ENTRIES) logsEl.firstElementChild?.remove();
    setText('[data-log-count]', `日志 ${logEntries.length} / ${MAX_LOG_ENTRIES}`);
    logsEl.scrollTop = logsEl.scrollHeight;
  };

  const persistConfig = (): void => saveConfig(config);
  const refreshVisibility = (): void => setText('[data-visibility]', document.hidden ? '后台' : '前台');

  const requestWakeLock = async (): Promise<void> => {
    if (!config.keepAlive || document.hidden || wakeLock && !wakeLock.released) return;
    try {
      const wakeApi = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockHandle> } }).wakeLock;
      if (!wakeApi) {
        setText('[data-wake]', '浏览器不支持');
        return;
      }
      wakeLock = await wakeApi.request('screen');
      setText('[data-wake]', '已生效');
      wakeLock.addEventListener('release', () => setText('[data-wake]', '已释放'), { once: true });
    } catch {
      setText('[data-wake]', '申请失败');
    }
  };
  const releaseWakeLock = async (): Promise<void> => {
    const current = wakeLock;
    wakeLock = null;
    if (current && !current.released) await current.release().catch(() => undefined);
    setText('[data-wake]', config.keepAlive ? '已释放' : '未启用');
  };

  const keepaliveRequest = async (): Promise<void> => {
    if (!runtime.running || !config.keepAlive || !config.sites.length) return;
    if (Date.now() - lastKeepaliveRequestAt < KEEPALIVE_REQUEST_INTERVAL_MS) return;
    lastKeepaliveRequestAt = Date.now();
    const response = await request<string>({ url: config.sites[0], method: 'HEAD', timeout: 15_000 });
    if (!response.ok) reporter({ timestamp: Date.now(), level: 'warning', message: '保活请求未成功', details: `${response.status} ${response.statusText}` });
  };

  const runCycle = async (scheduled: boolean): Promise<void> => {
    if (cycleActive || !config.sites.length) {
      if (!config.sites.length) reporter({ timestamp: Date.now(), level: 'warning', message: '请至少选择一个来源站点' });
      return;
    }

    cycleActive = true;
    runOnceEl.disabled = true;
    startEl.disabled = scheduled;
    setText('[data-resource]', '使用中');
    updateStatus('正在采集来源站点', true);
    reporter({ timestamp: Date.now(), level: 'info', message: `开始第 ${stats.cycles + 1} 轮自动领取` });

    let allLinks: string[] = [];
    let queue: string[] = [];
    let terminatedForLogin = false;
    stats.pending = 0;
    try {
      const sourceResults = await Promise.all(config.sites.map(async (site) => {
        const response = await request<string>({ url: site, method: 'GET', timeout: 30_000 });
        if (!response.ok || !response.text) {
          stats.sourceFailed += 1;
          updateStats();
          reporter({ timestamp: Date.now(), level: 'error', message: '来源站点请求失败', details: `${site} (${response.status} ${response.statusText})` });
          return [];
        }
        const links = extractItchHrefs(response.text, site);
        stats.sourceSucceeded += 1;
        stats.rawLinks += links.length;
        updateStats();
        reporter({ timestamp: Date.now(), level: 'success', message: `来源获取成功，发现 ${links.length} 条链接`, details: site });
        return links;
      }));

      allLinks = sourceResults.flat();
      updateStatus('正在处理链接', true);
      queue = await prepareItchRedeemQueue(allLinks, reporter);
      stats.uniqueLinks += queue.length;
      updateStats();
      reporter({ timestamp: Date.now(), level: 'info', message: `链接处理完成：来源链接 ${allLinks.length}，入库队列 ${queue.length}` });

      updateStatus('正在顺序领取', true);
      const batch = await redeemItchQueue(queue, reporter, (item, completed, total) => {
        stats.total += 1;
        if (item.status === 'login-required') stats.loginRequired += 1;
        else stats[item.status] += 1;
        updateStats();
        updateStatus(`正在顺序领取 ${completed}/${total}`, true);
      }, (remaining, removedOwned) => {
        stats.pending = remaining;
        updateStats();
        reporter({
          timestamp: Date.now(),
          level: 'info',
          message: `联动过滤完成：去除已拥有 ${removedOwned} 个，实际需入库 ${remaining} 个`
        });
      });
      stats.cycles += 1;
      runtime.lastRunAt = Date.now();
      updateStats();

      if (batch.loginRequired > 0) {
        terminatedForLogin = true;
        runtime.running = false;
        runtime.nextRunAt = null;
        stopHeartbeat();
        void releaseWakeLock();
        updateStatus('请先登录，任务已终止', false, true);
      }
      reporter({
        timestamp: Date.now(),
        level: terminatedForLogin ? 'error' : 'success',
        message: terminatedForLogin
          ? `检测到未登录，本轮及后续循环已终止；已处理 ${batch.total}/${queue.length}`
          : `本轮完成：领取 ${batch.claimed}，已拥有 ${batch.owned}，失败 ${batch.failed + batch.unknown}`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reporter({ timestamp: Date.now(), level: 'error', message: '本轮执行异常', details: message });
      updateStatus('执行异常', false, true);
    } finally {
      allLinks.length = 0;
      queue.length = 0;
      cycleActive = false;
      runOnceEl.disabled = false;
      startEl.disabled = false;
      setText('[data-resource]', '已清理');
      if (terminatedForLogin) {
        updateStatus('请先登录，任务已终止', false, true);
      } else if (runtime.running && scheduled) {
        runtime.nextRunAt = Date.now() + config.intervalHours * 60 * 60_000;
        updateStatus('等待下一轮', true);
      } else if (!runtime.running) {
        updateStatus('未启动');
      }
      saveRuntime(runtime);
      updateRuntimeUi();
      updateStats();
    }
  };

  const heartbeat = (): void => {
    const now = Date.now();
    setText('[data-heartbeat]', '正常');
    setText('[data-heartbeat-time]', new Date(now).toLocaleTimeString('zh-CN', { hour12: false }));
    if (runtime.running && runtime.nextRunAt && now >= runtime.nextRunAt && !cycleActive) void runCycle(true);
    void keepaliveRequest();
  };
  const startHeartbeat = (): void => {
    if (heartbeatWorker) return;
    heartbeatWorker = createHeartbeatWorker(heartbeat);
    if (!heartbeatWorker) {
      setText('[data-heartbeat]', 'Worker 不可用');
      return;
    }
    setText('[data-heartbeat]', '正常');
  };
  const stopHeartbeat = (): void => {
    heartbeatWorker?.terminate();
    heartbeatWorker = null;
    setText('[data-heartbeat]', '未启动');
    setText('[data-heartbeat-time]', '—');
  };

  const start = (resume: boolean): void => {
    if (!config.sites.length) {
      reporter({ timestamp: Date.now(), level: 'warning', message: '请至少选择一个来源站点' });
      return;
    }
    saveConfig(config);
    runtime.running = true;
    startHeartbeat();
    if (config.keepAlive) void requestWakeLock();
    if (resume && runtime.nextRunAt && runtime.nextRunAt > Date.now()) {
      updateStatus('等待下一轮', true);
    } else {
      runtime.nextRunAt = null;
      void runCycle(true);
    }
    saveRuntime(runtime);
    updateRuntimeUi();
  };
  const stop = (): void => {
    runtime = { ...runtime, running: false, nextRunAt: null };
    saveRuntime(runtime);
    stopHeartbeat();
    void releaseWakeLock();
    updateStatus(cycleActive ? '本轮结束后停止' : '已停止');
    updateRuntimeUi();
  };

  itchFreeListSites.forEach((site) => {
    const label = document.createElement('label');
    label.className = 'site';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = site;
    checkbox.checked = config.sites.includes(site);
    const text = document.createElement('span');
    text.textContent = site;
    checkbox.addEventListener('change', () => {
      config.sites = Array.from(sitesEl.querySelectorAll<HTMLInputElement>('input:checked')).map((item) => item.value);
      persistConfig();
    });
    label.append(checkbox, text);
    sitesEl.append(label);
  });

  intervalEl.value = String(config.intervalHours);
  keepaliveEl.checked = config.keepAlive;
  setText('[data-current-site]', window.location.hostname);
  intervalEl.addEventListener('change', () => {
    const value = Number(intervalEl.value);
    config.intervalHours = Number.isFinite(value) && value >= 0.1 ? value : DEFAULT_CONFIG.intervalHours;
    intervalEl.value = String(config.intervalHours);
    persistConfig();
    if (runtime.running && runtime.lastRunAt) {
      runtime.nextRunAt = runtime.lastRunAt + config.intervalHours * 60 * 60_000;
      saveRuntime(runtime);
      updateRuntimeUi();
    }
  });
  keepaliveEl.addEventListener('change', () => {
    config.keepAlive = keepaliveEl.checked;
    persistConfig();
    if (config.keepAlive && runtime.running) void requestWakeLock();
    else void releaseWakeLock();
  });
  startEl.addEventListener('click', () => runtime.running ? stop() : start(false));
  runOnceEl.addEventListener('click', () => void runCycle(false));
  get<HTMLButtonElement>('[data-clear]').addEventListener('click', () => {
    logEntries.length = 0;
    logsEl.replaceChildren();
    setText('[data-log-count]', `日志 0 / ${MAX_LOG_ENTRIES}`);
  });
  get<HTMLButtonElement>('[data-copy]').addEventListener('click', () => {
    const text = logEntries.map((entry) => `${new Date(entry.timestamp).toLocaleString('zh-CN', { hour12: false })} ${entry.level.toUpperCase()} ${entry.message}${entry.details ? ` ${entry.details}` : ''}`).join('\n');
    GM_setClipboard(text, 'text');
  });
  get<HTMLButtonElement>('[data-copy-site]').addEventListener('click', () => {
    GM_setClipboard(window.location.hostname, 'text');
    const button = get<HTMLButtonElement>('[data-copy-site]');
    button.textContent = '已复制';
    window.setTimeout(() => { button.textContent = '复制站点'; }, 1500);
  });

  document.addEventListener('visibilitychange', () => {
    refreshVisibility();
    if (!document.hidden && runtime.running && config.keepAlive) void requestWakeLock();
    heartbeat();
  });
  window.addEventListener('pageshow', heartbeat);
  window.addEventListener('focus', heartbeat);
  window.addEventListener('beforeunload', () => saveRuntime(runtime));

  refreshVisibility();
  updateRuntimeUi();
  updateStats();
  if (runtime.running) start(true);
}
