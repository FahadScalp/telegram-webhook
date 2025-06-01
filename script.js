const dashboard = document.getElementById('dashboard');
const searchInput = document.getElementById('searchInput');
let accounts = {};

async function fetchAccounts() {
  const response = await fetch('/accounts');
  accounts = await response.json();
  renderDashboard(Object.values(accounts).map(acc => ({
    ...acc,
    last: acc.history[acc.history.length - 1]
  })));
}

function renderDashboard(data) {
  dashboard.innerHTML = '';
  data.forEach(acc => {
    const profit = acc.last.balance - 100;
    const container = document.createElement('div');
    container.className = `p-4 rounded shadow bg-white border-l-4 ${
      profit > 0 ? 'border-green-500' : profit < 0 ? 'border-red-500' : 'border-gray-300'
    }`;

    const detailsHTML = acc.history.map((h, i, arr) => {
      if (i === 0) return '';
      const diff = h.balance - arr[i - 1].balance;
      return `<div class="text-sm text-gray-600">#${i} | ${new Date(h.timestamp).toLocaleString()} | Balance: $${h.balance.toFixed(2)} | Δ: ${diff.toFixed(2)}</div>`;
    }).join('');

    container.innerHTML = `
      <div class="font-bold text-lg mb-1">${acc.alias || acc.account_id}</div>
      <div class="mb-1">Balance: $${acc.last.balance.toFixed(2)}</div>
      <div class="mb-2">Profit: <span class="${profit >= 0 ? 'text-green-600' : 'text-red-600'}">$${profit.toFixed(2)}</span></div>
      <div class="bg-gray-50 p-2 rounded border">${detailsHTML || '<div class="text-gray-400">No history available</div>'}</div>
      <div class="text-xs text-gray-400 mt-2">Last updated: ${new Date(acc.last.timestamp).toLocaleString()}</div>
    `;

    dashboard.appendChild(container);
  });
}

searchInput.addEventListener('input', e => {
  const val = e.target.value.toLowerCase();
  const filtered = Object.values(accounts).filter(acc =>
    acc.alias?.toLowerCase().includes(val) || acc.account_id.includes(val)
  ).map(acc => ({
    ...acc,
    last: acc.history[acc.history.length - 1]
  }));
  renderDashboard(filtered);
});

fetchAccounts();
setInterval(fetchAccounts, 30000);
