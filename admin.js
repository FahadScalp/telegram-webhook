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
      <div class="bg-gray-50 p-2 rounded border text-xs mb-2">${detailsHTML || '<div class="text-gray-400">No history</div>'}</div>

      <button onclick="toggleAlertForm('${acc.account_id}')" class="text-sm text-blue-600 hover:underline mb-2">+ إضافة تنبيه تلغرام</button>
      <form id="form-${acc.account_id}" class="hidden flex flex-col gap-2 text-xs border p-2 rounded mt-2 bg-blue-50">
        <input type="text" placeholder="Bot Token" class="p-1 border rounded" id="token-${acc.account_id}" />
        <input type="text" placeholder="Chat ID" class="p-1 border rounded" id="chat-${acc.account_id}" />
        <input type="text" placeholder="Message" class="p-1 border rounded" id="msg-${acc.account_id}" />
        <button type="button" onclick="saveAlert('${acc.account_id}')" class="bg-blue-600 text-white py-1 rounded">حفظ التنبيه</button>
      </form>

      <div class="text-xs text-gray-400 mt-2">Last updated: ${new Date(acc.last.timestamp).toLocaleString()}</div>
    `;
    dashboard.appendChild(container);
  });
}

function toggleAlertForm(id) {
  const form = document.getElementById(`form-${id}`);
  if (form.classList.contains('hidden')) {
    form.classList.remove('hidden');
  } else {
    form.classList.add('hidden');
  }
}

function saveAlert(id) {
  const token = document.getElementById(`token-${id}`).value;
  const chat = document.getElementById(`chat-${id}`).value;
  const msg = document.getElementById(`msg-${id}`).value;

  console.log("Saving alert for", id, token, chat, msg);
  alert(`تم حفظ التنبيه لحساب ${id} (تجريبي فقط حالياً)`);
}

searchInput.addEventListener('input', () => renderDashboard(Object.values(accounts)));
fetchAccounts();
setInterval(fetchAccounts, 30000);
