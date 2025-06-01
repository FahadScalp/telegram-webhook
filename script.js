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
    const card = document.createElement('div');
    card.className = `p-4 rounded shadow bg-white border-l-4 ${
      profit > 0 ? 'border-green-500' : profit < 0 ? 'border-red-500' : 'border-gray-300'
    } cursor-pointer`;
    card.innerHTML = `
      <div class="font-bold">${acc.alias || acc.account_id}</div>
      <div>Balance: $${acc.last.balance.toFixed(2)}</div>
      <div>Profit: <span class="${profit >= 0 ? 'text-green-600' : 'text-red-600'}">$${profit.toFixed(2)}</span></div>
      <div class="text-xs text-gray-500 mt-2">${new Date(acc.last.timestamp).toLocaleString()}</div>
    `;
    card.onclick = () => showDetails(acc);
    dashboard.appendChild(card);
  });
}

function showDetails(account) {
  let details = `Details for ${account.alias || account.account_id}:\n`;
  for (let i = 1; i < account.history.length; i++) {
    const prev = account.history[i - 1].balance;
    const curr = account.history[i].balance;
    const diff = curr - prev;
    details += `#${i} | ${new Date(account.history[i].timestamp).toLocaleString()} | Balance: $${curr.toFixed(2)} | Δ: ${diff.toFixed(2)}\n`;
  }
  alert(details);
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
