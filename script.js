// ===== DOM refs =====
const dashboard   = document.getElementById('dashboard');
const searchInput = document.getElementById('searchInput');
const sortFilter  = document.getElementById('sortFilter');
const downloadBtn = document.getElementById('downloadBtn');

let accounts = {};   // يأتي من /accounts
let lastFetchOk = true;

// ===== Helpers =====
const toMoney = (v) => (isFinite(v) ? Number(v).toFixed(2) : '0.00');

const fixTsMs = (ts) => {
  // إن كان ts بالثواني حوّله إلى ميلي ثانية
  if (ts == null) return Date.now();
  const n = Number(ts);
  if (!isFinite(n)) return Date.now();
  return n < 1e12 ? n * 1000 : n;
};

const fmtDate = (ts) => new Date(fixTsMs(ts)).toLocaleString();

const safe = (v, def = 0) => (isFinite(Number(v)) ? Number(v) : def);

// استنتاج initial_balance لو غير متاح: نستخدم أول نقطة من التاريخ
const resolveInitial = (acc) => {
  if (isFinite(acc?.initial_balance)) return Number(acc.initial_balance);
  const first = acc?.history?.[0];
  if (first && isFinite(first.balance)) return Number(first.balance);
  return 0;
};

const shapeAccount = (acc) => {
  const history = Array.isArray(acc?.history) ? acc.history : [];
  const last = history[history.length - 1] || { balance: 0, timestamp: Date.now() };
  const initial = resolveInitial(acc);
  const profit = safe(last.balance) - initial;

  return {
    account_id: String(acc?.account_id ?? ''),
    alias: acc?.alias || '',
    initial,
    last: { balance: safe(last.balance), timestamp: fixTsMs(last.timestamp) },
    history: history.map(h => ({
      balance: safe(h.balance),
      timestamp: fixTsMs(h.timestamp),
    })),
    profit
  };
};

// ===== Fetch & state =====
async function fetchAccounts() {
  try {
    const res = await fetch('/accounts', { cache: 'no-store' });
    const json = await res.json();
    accounts = json || {};
    lastFetchOk = true;
  } catch (e) {
    console.error('Fetch /accounts failed:', e);
    lastFetchOk = false;
  }
  renderDashboard(getFilteredData());
}

// ===== Filters & sorting =====
function getFilteredData() {
  const val = (searchInput.value || '').toLowerCase().trim();

  let data = Object.values(accounts)
    .map(shapeAccount)
    .filter(acc =>
      (acc.alias && acc.alias.toLowerCase().includes(val)) ||
      (acc.account_id && acc.account_id.toLowerCase().includes(val))
    );

  const sortBy = sortFilter?.value || 'default';
  if (sortBy === 'profit') {
    data.sort((a, b) => b.profit - a.profit);
  } else if (sortBy === 'balance') {
    data.sort((a, b) => b.last.balance - a.last.balance);
  } // else default: keep as-is

  return data;
}

// ===== Rendering =====
function renderDashboard(data) {
  dashboard.innerHTML = '';

  // Empty state
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

    container.innerHTML = `
      <div class="font-bold text-md mb-1">
        ${acc.alias ? acc.alias : acc.account_id}
        ${acc.alias && acc.account_id ? `<span class="text-gray-400 text-xs"> (#${acc.account_id})</span>` : ''}
      </div>

      <div class="text-sm mb-1">Balance: $${toMoney(acc.last.balance)}</div>
      <div class="text-sm mb-1">Initial: $${toMoney(acc.initial)}</div>
      <div class="text-sm mb-2">Profit: <span class="${profitClass}">$${toMoney(profit)}</span></div>

      <div class="bg-gray-50 p-2 rounded border text-xs">
        ${detailsHTML || '<div class="text-gray-400">No history</div>'}
      </div>

      <div class="text-xs text-gray-400 mt-2">
        Last updated: ${fmtDate(acc.last.timestamp)}
      </div>
    `;

    dashboard.appendChild(container);
  });
}

// ===== CSV =====
function downloadCSV() {
  const rows = [["Alias", "Account ID", "Initial", "Balance", "Profit", "Last Updated"]];
  Object.values(accounts).map(shapeAccount).forEach(acc => {
    rows.push([
      acc.alias || "",
      acc.account_id,
      toMoney(acc.initial),
      toMoney(acc.last.balance),
      toMoney(acc.profit),
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

// ===== Events =====
searchInput.addEventListener('input',  () => renderDashboard(getFilteredData()));
sortFilter.addEventListener('change', () => renderDashboard(getFilteredData()));
downloadBtn.addEventListener('click', downloadCSV);

// ===== Kickoff =====
fetchAccounts();
setInterval(fetchAccounts, 5000);
