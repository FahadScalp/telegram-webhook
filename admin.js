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

searchInput.addEventListener('input', () => renderDashboard(Object.values(accounts)));
fetchAccounts();
setInterval(fetchAccounts, 30000);
