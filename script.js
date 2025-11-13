// ===================== DOM Elements ===================== //
const dashboard   = document.getElementById('dashboard');
const totalsBar   = document.getElementById('totalsBar');
const searchInput = document.getElementById('searchInput');
const sortFilter  = document.getElementById('sortFilter');
const downloadBtn = document.getElementById('downloadBtn');

let accounts = {};
let lastFetchOk = true;

// ===================== Helper Functions ===================== //
const toMoney = (v) => (isFinite(v) ? Number(v).toFixed(2) : '0.00');
const safe = (v, def = 0) => (isFinite(Number(v)) ? Number(v) : def);

const fixTsMs = (ts) => {
  if (ts == null) return Date.now();
  const n = Number(ts);
  if (!isFinite(n)) return Date.now();
  return n < 1e12 ? n * 1000 : n; // seconds → ms
};
const fmtDate = (ts) => new Date(fixTsMs(ts)).toLocaleString();

const startOfDayMs = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
})();

const staleBadge = (ts) => {
  const mins = Math.round((Date.now() - fixTsMs(ts)) / 60000);
  const c = mins <= 10 ? 'dot-ok' : mins <= 30 ? 'dot-warn' : 'dot-bad';
  return `<span class="dot ${c}"></span><span>${mins}m</span>`;
};

// Sparkline صغيرة
const sparkline = (arr) => {
  const pts = arr.slice(-40).map(h => safe(h.balance));
  if (!pts.length) return '';
  const min = Math.min(...pts), max = Math.max(...pts), W = 120, H = 24;
  const xs = pts.map((v, i) => [
    i * (W / (pts.length - 1 || 1)),
    H - (H * (v - min) / (max - min || 1))
  ]);
  const d = xs.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  return `<svg width="${W}" height="${H}" class="spark"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1"/></svg>`;
};

const resolveInitial = (acc) => {
  if (isFinite(acc?.initial_balance)) return Number(acc.initial_balance);
  const first = acc?.history?.[0];
  if (first && isFinite(first.balance)) return Number(first.balance);
  return 0;
};

// الأهداف (Goal)
const goals = JSON.parse(localStorage.getItem('goals') || '{}');
const getGoal = id => Number(goals[id] || 50);
const setGoal = (id, v) => { goals[id] = v; localStorage.setItem('goals', JSON.stringify(goals)); };

// ===================== Data Shaping ===================== //
const shapeAccount = (acc) => {
  const history = Array.isArray(acc?.history)
    ? acc.history.map(h => ({ balance: safe(h.balance), timestamp: fixTsMs(h.timestamp) }))
    : [];

  const last = history[history.length - 1] || { balance: 0, timestamp: Date.now() };
  const initial = resolveInitial(acc);
  const profit = safe(last.balance) - initial;
  const firstToday = history.find(h => h.timestamp >= startOfDayMs) || history[0] || { balance: initial };
  const todayPnL = safe(last.balance) - safe(firstToday.balance);

  return {
    account_id: String(acc?.account_id ?? ''),
    alias: acc?.alias || '',
    initial,
    last,
    history,
    profit,
    todayPnL
  };
};

// ===================== Fetch & Filter ===================== //
async function fetchAccounts() {
  try {
    const res = await fetch('/accounts', { cache: 'no-store' });
    accounts = await res.json() || {};
    lastFetchOk = true;
  } catch (e) {
    console.error('Fetch /accounts failed:', e);
    lastFetchOk = false;
  }
  renderDashboard(getFilteredData());
}

function getFilteredData() {
  const val = (searchInput?.value || '').toLowerCase().trim();
  let data = Object.values(accounts)
    .map(shapeAccount)
    .filter(acc =>
      (acc.alias && acc.alias.toLowerCase().includes(val)) ||
      (acc.account_id && acc.account_id.toLowerCase().includes(val))
    );

  const sortBy = sortFilter?.value || 'default';
  if (sortBy === 'profit')      data.sort((a, b) => b.profit - a.profit);
  else if (sortBy === 'balance') data.sort((a, b) => b.last.balance - a.last.balance);
  else if (sortBy === 'recent')  data.sort((a, b) => b.last.timestamp - a.last.timestamp);
  return data;
}

// ===================== Totals Bar ===================== //
function totalsBarHTML(list) {
  const sum = (f) => list.reduce((s, a) => s + f(a), 0);
  const totalBal = sum(a => a.last.balance);
  const totalInit = sum(a => a.initial);
  const totalPnL = totalBal - totalInit;
  const totalToday = sum(a => a.todayPnL);

  const pnlClass = totalPnL >= 0 ? 'pnl-pos' : 'pnl-neg';
  const todayClass = totalToday >= 0 ? 'pnl-pos' : 'pnl-neg';

  return `
    <div class="chip">Total Balance: <b>$${toMoney(totalBal)}</b></div>
    <div class="chip">Initial: <b>$${toMoney(totalInit)}</b></div>
    <div class="chip">PNL: <b class="${pnlClass}">$${toMoney(totalPnL)}</b></div>
    <div class="chip">Today: <b class="${todayClass}">$${toMoney(totalToday)}</b></div>
  `;
}

// ===================== Render Dashboard ===================== //
function renderDashboard(data) {
  totalsBar.innerHTML = data.length ? totalsBarHTML(data) : '';

  dashboard.innerHTML = '';
  if (!data.length) {
    const msg = document.createElement('div');
    msg.className = 'w-full text-center text-gray-500 py-10';
    msg.innerHTML = lastFetchOk
      ? 'لا توجد بيانات بعد… أرسل أول تحديث من الإكسبرت.'
      : '⚠️ تعذّر جلب البيانات من الخادم.';
    dashboard.appendChild(msg);
    return;
  }

  data.forEach(acc => {
    const profit = acc.profit;
    const card = document.createElement('article');
    card.className = `card ${profit > 0 ? 'pos' : profit < 0 ? 'neg' : 'zero'}`;

    // ===== العنوان =====
    const title = document.createElement('div');
    title.className = 'title';
    title.innerHTML = `
      <span>${acc.alias || acc.account_id}</span>
      ${acc.alias && acc.account_id ? `<small>(#${acc.account_id})</small>` : ''}
      <span class="badge">${staleBadge(acc.last.timestamp)}</span>
    `;
    card.appendChild(title);

    // ===== المعلومات =====
    const info = document.createElement('div');
    info.className = 'info';
    info.innerHTML = `
      <div>Balance: <b>$${toMoney(acc.last.balance)}</b></div>
      <div class="muted">Initial: $${toMoney(acc.initial)}</div>
      <div>Profit: <b class="${profit >= 0 ? 'pos' : 'neg'}">$${toMoney(profit)}</b></div>
      <div>Today: <b class="${acc.todayPnL >= 0 ? 'pos' : 'neg'}">$${toMoney(acc.todayPnL)}</b></div>
    `;
    card.appendChild(info);

    // ===== التاريخ =====
    const detailsHTML = acc.history.slice(-3).map((h, i, arr) => {
      const prev = i === 0 ? h.balance : arr[i - 1].balance;
      const diff = h.balance - prev;
      return `<div>• ${fmtDate(h.timestamp)} | $${toMoney(h.balance)} | Δ: ${toMoney(diff)}</div>`;
    }).join('');
    const historyBox = document.createElement('div');
    historyBox.className = 'history';
    historyBox.innerHTML = detailsHTML || '<div class="muted">No history</div>';
    card.appendChild(historyBox);

    // ===== Sparkline =====
    const spark = document.createElement('div');
    spark.innerHTML = sparkline(acc.history);
    card.appendChild(spark);

    // ===== الهدف =====
    const goal = getGoal(acc.account_id);
    const percent = Math.max(0, Math.min(100, (acc.profit / goal) * 100));
    const goalDiv = document.createElement('div');
    goalDiv.className = 'goal';
    goalDiv.innerHTML = `
      <div class="flex-row">
        <span class="muted">Goal $${toMoney(goal)}</span>
        <span class="muted" style="float:inline-end">${percent.toFixed(0)}%</span>
      </div>
      <div class="progress"><i style="width:${percent}%"></i></div>
    `;
    card.appendChild(goalDiv);

    // ===== زر تعديل الهدف =====
    const edit = document.createElement('div');
    edit.className = 'edit';
    edit.textContent = 'Edit goal';
    edit.onclick = () => {
      const v = prompt('Set goal $', getGoal(acc.account_id));
      if (v != null) { setGoal(acc.account_id, Number(v) || 0); renderDashboard(getFilteredData()); }
    };
    card.appendChild(edit);

    // ===== آخر تحديث =====
    const lastLine = document.createElement('div');
    lastLine.className = 'muted';
    lastLine.style.marginTop = '8px';
    lastLine.textContent = `Last updated: ${fmtDate(acc.last.timestamp)}`;
    card.appendChild(lastLine);

    dashboard.appendChild(card);
  });
}

// ===================== CSV Export ===================== //
function downloadCSV() {
  const rows = [["Alias", "Account ID", "Initial", "Balance", "Profit", "Today", "Last Updated"]];
  Object.values(accounts).map(shapeAccount).forEach(acc => {
    rows.push([
      acc.alias || "",
      acc.account_id,
      toMoney(acc.initial),
      toMoney(acc.last.balance),
      toMoney(acc.profit),
      toMoney(acc.todayPnL),
      fmtDate(acc.last.timestamp)
    ]);
  });

  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "accounts_report.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ===================== Events ===================== //
searchInput?.addEventListener('input',  () => renderDashboard(getFilteredData()));
sortFilter?.addEventListener('change', () => renderDashboard(getFilteredData()));
downloadBtn?.addEventListener('click', downloadCSV);

// ===================== Init ===================== //
fetchAccounts();
setInterval(fetchAccounts, 5000);
