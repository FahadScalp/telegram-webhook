// ===== DOM refs =====
const dashboard   = document.getElementById('dashboard');
const searchInput = document.getElementById('searchInput');
const sortFilter  = document.getElementById('sortFilter');
const downloadBtn = document.getElementById('downloadBtn');

let accounts = {};
let lastFetchOk = true;

// ===== Helpers =====
const toMoney = (v) => (isFinite(v) ? Number(v).toFixed(2) : '0.00');

const fixTsMs = (ts) => {
  if (ts == null) return Date.now();
  const n = Number(ts);
  if (!isFinite(n)) return Date.now();
  return n < 1e12 ? n * 1000 : n; // seconds -> ms
};
const fmtDate = (ts) => new Date(fixTsMs(ts)).toLocaleString();
const safe = (v, def = 0) => (isFinite(Number(v)) ? Number(v) : def);

const startOfDayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();

const staleBadge = (ts) => {
  const mins = Math.round((Date.now() - fixTsMs(ts)) / 60000);
  const c = mins <= 10 ? 'bg-green-500' : mins <= 30 ? 'bg-yellow-500' : 'bg-red-500';
  return `<span class="inline-flex items-center gap-1 text-xs text-gray-600">
    <span class="w-2 h-2 ${c} rounded-full inline-block"></span>${mins}m
  </span>`;
};

// sparkline بدون مكتبات
const sparkline = (arr) => {
  const pts = arr.slice(-50).map(h => safe(h.balance));
  if (!pts.length) return '';
  const min = Math.min(...pts), max = Math.max(...pts), W = 120, H = 24;
  const xs = pts.map((v, i) => [ i * (W / (pts.length - 1 || 1)), H - (H * (v - min) / (max - min || 1)) ]);
  const d  = xs.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  return `<svg width="${W}" height="${H}" class="mt-2 text-gray-700"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1"/></svg>`;
};

// استنتاج initial_balance عند غيابه
const resolveInitial = (acc) => {
  if (isFinite(acc?.initial_balance)) return Number(acc.initial_balance);
  const first = acc?.history?.[0];
  if (first && isFinite(first.balance)) return Number(first.balance);
  return 0;
};

// هدف/تقدم
const goals = JSON.parse(localStorage.getItem('goals') || '{}');
const getGoal  = id => Number(goals[id] || 50);
const setGoal  = (id, v) => { goals[id] = v; localStorage.setItem('goals', JSON.stringify(goals)); };
const progressHTML = (acc) => {
  const goal = getGoal(acc.account_id), p = Math.max(0, Math.min(100, (acc.profit / goal) * 100));
  return `<div class="mt-2">
    <div class="flex justify-between text-xs text-gray-600">
      <span>Goal $${toMoney(goal)}</span><span>${p.toFixed(0)}%</span>
    </div>
    <div class="w-full h-2 bg-gray-200 rounded">
      <div class="h-2 rounded ${acc.profit>=0?'bg-green-500':'bg-red-500'}" style="width:${p}%"></div>
    </div>
  </div>`;
};

// تشكيل حساب للعرض
const shapeAccount = (acc) => {
  const history = Array.isArray(acc?.history) ? acc.history.map(h => ({
    balance: safe(h.balance), timestamp: fixTsMs(h.timestamp)
  })) : [];
  const last = history[history.length - 1] || { balance: 0, timestamp: Date.now() };
  const initial = resolveInitial(acc);
  const profit = safe(last.balance) - initial;

  // ربح اليوم
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

// ===== Fetch =====
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

// ===== Filter/Sort =====
function getFilteredData() {
  const val = (searchInput?.value || '').toLowerCase().trim();
  let data = Object.values(accounts).map(shapeAccount)
    .filter(acc =>
      (acc.alias && acc.alias.toLowerCase().includes(val)) ||
      (acc.account_id && acc.account_id.toLowerCase().includes(val))
    );

  const sortBy = sortFilter?.value || 'default';
  if (sortBy === 'profit') {
    data.sort((a, b) => b.profit - a.profit);
  } else if (sortBy === 'balance') {
    data.sort((a, b) => b.last.balance - a.last.balance);
  } else if (sortBy === 'recent') {
    data.sort((a, b) => b.last.timestamp - a.last.timestamp);
  }
  return data;
}

// ===== Totals bar =====
function totalsBar(list) {
  const sum = (f) => list.reduce((s, a) => s + f(a), 0);
  const totalBal  = sum(a => a.last.balance);
  const totalInit = sum(a => a.initial);
  const totalPnL  = totalBal - totalInit;
  const totalToday= sum(a => a.todayPnL);
  return `<div class="mb-3 p-2 rounded bg-gray-100 flex gap-6 text-sm items-center">
    <div>Total Balance: <b>$${toMoney(totalBal)}</b></div>
    <div>Initial: <b>$${toMoney(totalInit)}</b></div>
    <div>PNL: <b class="${totalPnL>=0?'text-green-600':'text-red-600'}">$${toMoney(totalPnL)}</b></div>
    <div>Today: <b class="${totalToday>=0?'text-green-600':'text-red-600'}">$${toMoney(totalToday)}</b></div>
  </div>`;
}

// ===== Render =====
function renderDashboard(data) {
  dashboard.innerHTML = '';

  // Totals
  if (data.length) {
    const totals = document.createElement('div');
    totals.innerHTML = totalsBar(data);
    dashboard.appendChild(totals.firstChild);
  }

  if (!data.length) {
    const box = document.createElement('div');
    box.className = 'w-full text-center text-gray-500 py-10';
    box.innerHTML = lastFetchOk
      ? 'لا توجد بيانات حتى الآن… أرسل أول قيْد من الإكسبرت أو جرّب تحديث الصفحة.'
      : 'تعذر جلب البيانات من الخادم. تأكد أن الخدمة تعمل ثم حدّث الصفحة.';
    dashboard.appendChild(box);
    return;
  }

  data.forEach(acc => {
    const profit = acc.profit;
    const profitClass = profit > 0 ? 'text-green-600' : (profit < 0 ? 'text-red-600' : 'text-gray-700');
    const borderClass = profit > 0 ? 'border-green-500' : (profit < 0 ? 'border-red-500' : 'border-gray-300');

    const detailsHTML = acc.history.slice(-3).map((h, i, arr) => {
      const prev = i === 0 ? h.balance : arr[i - 1].balance;
      const diff = h.balance - prev;
      return `<div class="text-xs text-gray-600">• ${fmtDate(h.timestamp)} | $${toMoney(h.balance)} | Δ: ${toMoney(diff)}</div>`;
    }).join('');

    const container = document.createElement('div');
    container.className = `p-3 rounded shadow bg-white border-l-4 ${borderClass}`;

    const title = document.createElement('div');
    title.className = 'font-bold text-md mb-1 flex items-center gap-2';
    title.innerHTML = `
      <span>${acc.alias ? acc.alias : acc.account_id}${acc.alias && acc.account_id ? ` <span class="text-gray-400 text-xs">(#${acc.account_id})</span>` : ''}</span>
      ${staleBadge(acc.last.timestamp)}
    `;
    container.appendChild(title);

    const info = document.createElement('div');
    info.className = 'text-sm mb-1';
    info.innerHTML = `
      Balance: $${toMoney(acc.last.balance)} &nbsp; • &nbsp;
      Initial: $${toMoney(acc.initial)} &nbsp; • &nbsp;
      Profit: <span class="${profitClass}">$${toMoney(profit)}</span> &nbsp; • &nbsp;
      Today: <span class="${acc.todayPnL>=0?'text-green-600':'text-red-600'}">$${toMoney(acc.todayPnL)}</span>
    `;
    container.appendChild(info);

    const historyBox = document.createElement('div');
    historyBox.className = 'bg-gray-50 p-2 rounded border text-xs';
    historyBox.innerHTML = detailsHTML || '<div class="text-gray-400">No history</div>';
    container.appendChild(historyBox);

    // sparkline
    const spark = document.createElement('div');
    spark.innerHTML = sparkline(acc.history);
    container.appendChild(spark);

    // goal progress + edit button
    const prog = document.createElement('div');
    prog.innerHTML = progressHTML(acc);
    container.appendChild(prog);

    const editBtn = document.createElement('button');
    editBtn.className = 'mt-2 text-xs underline';
    editBtn.textContent = 'Edit goal';
    editBtn.onclick = () => {
      const v = prompt('Set goal $', getGoal(acc.account_id));
      if (v != null) { setGoal(acc.account_id, Number(v) || 0); renderDashboard(getFilteredData()); }
    };
    container.appendChild(editBtn);

    const lastLine = document.createElement('div');
    lastLine.className = 'text-xs text-gray-400 mt-2';
    lastLine.textContent = `Last updated: ${fmtDate(acc.last.timestamp)}`;
    container.appendChild(lastLine);

    dashboard.appendChild(container);
  });
}

// ===== CSV =====
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

// ===== Events & kickoff =====
searchInput?.addEventListener('input',  () => renderDashboard(getFilteredData()));
sortFilter?.addEventListener('change', () => renderDashboard(getFilteredData()));
downloadBtn?.addEventListener('click', downloadCSV);

fetchAccounts();
setInterval(fetchAccounts, 5000);
