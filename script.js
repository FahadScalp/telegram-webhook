const dashboard = document.getElementById('dashboard');
const searchInput = document.getElementById('searchInput');
const sortFilter = document.getElementById('sortFilter');
const downloadBtn = document.getElementById('downloadBtn');
let accounts = {};

async function fetchAccounts() {
  const response = await fetch('/accounts');
  accounts = await response.json();
  renderDashboard(getFilteredData());
}

function getFilteredData() {
  const val = searchInput.value.toLowerCase();
  let data = Object.values(accounts).filter(acc =>
    acc.alias?.toLowerCase().includes(val) || acc.account_id.includes(val)
  ).map(acc => ({
    ...acc,
    last: acc.history[acc.history.length - 1]
  }));

  const sortBy = sortFilter.value;
  if (sortBy === 'profit') {
    data.sort((a, b) => {
      const profitA = a.last.balance - (a.initial_balance ?? 1000);
      const profitB = b.last.balance - (b.initial_balance ?? 1000);
      return profitB - profitA;
    });
  } else if (sortBy === 'balance') {
    data.sort((a, b) => b.last.balance - a.last.balance);
  }
  return data;
}

function renderDashboard(data) {
  dashboard.innerHTML = '';
  data.forEach(acc => {
    const initial = acc.initial_balance ?? 100;
    const profit = acc.last.balance - initial;

    const container = document.createElement('div');
    container.className = `p-3 rounded shadow bg-white border-l-4 ${
      profit > 0 ? 'border-green-500' : profit < 0 ? 'border-red-500' : 'border-gray-300'
    }`;

    const detailsHTML = acc.history.slice(-3).map((h, i, arr) => {
      const prev = i === 0 ? h.balance : arr[i - 1].balance;
      const diff = h.balance - prev;
      return `<div class="text-xs text-gray-600">• ${new Date(h.timestamp).toLocaleString()} | $${h.balance.toFixed(2)} | Δ: ${diff.toFixed(2)}</div>`;
    }).join('');

    container.innerHTML = `
      <div class="font-bold text-md mb-1">${acc.alias || acc.account_id}</div>
      <div class="text-sm mb-1">Balance: $${acc.last.balance.toFixed(2)}</div>
      <div class="text-sm mb-2">Profit: <span class="${profit >= 0 ? 'text-green-600' : 'text-red-600'}">$${profit.toFixed(2)}</span></div>
      <div class="bg-gray-50 p-2 rounded border text-xs">${detailsHTML || '<div class="text-gray-400">No history</div>'}</div>
      <div class="text-xs text-gray-400 mt-2">Last updated: ${new Date(acc.last.timestamp).toLocaleString()}</div>
    `;
    dashboard.appendChild(container);
  });
}

function downloadCSV() {
  const rows = [["Alias", "Account ID", "Balance", "Profit", "Last Updated"]];
  Object.values(accounts).forEach(acc => {
    const last = acc.history[acc.history.length - 1];
    const initial = acc.initial_balance ?? 100;
    const profit = last.balance - initial;
    rows.push([
      acc.alias || "",
      acc.account_id,
      last.balance.toFixed(2),
      profit.toFixed(2),
      new Date(last.timestamp).toLocaleString()
    ]);
  });

  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "accounts_report.csv";
  a.click();
}

searchInput.addEventListener('input', () => renderDashboard(getFilteredData()));
sortFilter.addEventListener('change', () => renderDashboard(getFilteredData()));
downloadBtn.addEventListener('click', downloadCSV);

fetchAccounts();
setInterval(fetchAccounts, 5000);
