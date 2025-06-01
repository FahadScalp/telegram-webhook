
async function loadAccounts() {
  const res = await fetch('/accounts');
  const data = await res.json();
  const container = document.getElementById('dashboard');
  container.innerHTML = '';

  for (const [id, acc] of Object.entries(data)) {
    const div = document.createElement('div');
    div.className = 'card';
    const profit = parseFloat(acc.balance) - 100;
    const profitClass = profit >= 0 ? 'highlight-profit' : 'highlight-loss';

    div.innerHTML = `
      <h3>${acc.name}</h3>
      <div class="info">Account ID: ${acc.account_id}</div>
      <div class="info">Balance: ${acc.balance} $</div>
      <div class="info ${profitClass}">Profit: ${profit.toFixed(2)} $</div>
      <div class="info">Last Updated: ${acc.time}</div>
      <button onclick="alert('Feature Coming Soon')">🔔 Alert</button>
    `;
    container.appendChild(div);
  }
}

window.onload = loadAccounts;
