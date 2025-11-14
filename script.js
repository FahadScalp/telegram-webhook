const dashboard = document.getElementById('dashboard');
const searchInput = document.getElementById('searchInput');
const sortFilter = document.getElementById('sortFilter');
const downloadBtn = document.getElementById('downloadBtn');

let accounts = {};
let currentDetailAcc = null;
let currentDays = 7;

// ============ جلب بيانات الحسابات ============
async function fetchAccounts() {
  try {
    const response = await fetch('/accounts');
    accounts = await response.json();
    renderDashboard(getFilteredData());
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

// ============ تصفية وفرز ============
function getFilteredData() {
  const val = searchInput.value.toLowerCase();
  let data = Object.values(accounts)
    .filter(acc => acc.alias?.toLowerCase().includes(val) || acc.account_id.includes(val))
    .map(acc => ({
      ...acc,
      last: acc.history?.[acc.history.length - 1] || {},
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

// ============ توليد العرض ============
function renderDashboard(data) {
  dashboard.innerHTML = totalsBarHTML(data);

  data.forEach(acc => {
    const initial = acc.initial_balance ?? 100;
    const profit = acc.last.balance - initial;

    const card = document.createElement('article');
    card.className = `card ${profit > 0 ? 'pos' : profit < 0 ? 'neg' : 'zero'}`;
    card.innerHTML = `
      <div class="title">${acc.alias || acc.account_id} 
        <small>#${acc.account_id}</small>
      </div>
      <div class="info">
        <span>Initial: <b>$${toMoney(initial)}</b></span>
        <span>Balance: <b>$${toMoney(acc.last.balance)}</b></span>
      </div>
      <div class="info">
        <span>Today: <b class="${acc.today >= 0 ? 'pos' : 'neg'}">$${toMoney(acc.today ?? 0)}</b></span>
        <span>Profit: <b class="${profit >= 0 ? 'pos' : 'neg'}">$${toMoney(profit)}</b></span>
      </div>
      <div class="history">
        ${acc.history
          .slice(-3)
          .map(h => {
            const d = new Date(h.timestamp);
            return `• ${d.toLocaleString()} | $${toMoney(h.balance)}`;
          })
          .join('<br>')}
      </div>
      <div class="goal">
        <div class="progress"><i style="width:0%"></i></div>
        <div class="edit" onclick="editGoal('${acc.account_id}')">Edit goal</div>
      </div>
      <div class="muted text-xs">Last updated: ${new Date(acc.last.timestamp).toLocaleString()}</div>
    `;

    // عند الضغط على الكرت فتح التفاصيل
    card.addEventListener('click', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'button' || e.target.classList.contains('edit')) return;
      openDetail(acc);
    });

    dashboard.appendChild(card);
  });
}

// ============ شريط الإجماليات ============
function totalsBarHTML(data) {
  const sum = f => data.reduce((s, a) => s + f(a), 0);
  const totalBal = sum(a => a.last.balance || 0);
  const totalInit = sum(a => a.initial_balance || 0);
  const totalPnL = totalBal - totalInit;
  const todaySum = sum(a => a.today || 0);
  return `
    <div class="totals">
      <div class="chip">Total Balance: <b>$${toMoney(totalBal)}</b></div>
      <div class="chip">Initial: <b>$${toMoney(totalInit)}</b></div>
      <div class="chip">PNL: <b class="${totalPnL >= 0 ? 'pnl-pos' : 'pnl-neg'}">$${toMoney(totalPnL)}</b></div>
      <div class="chip">Today: <b>$${toMoney(todaySum)}</b></div>
    </div>`;
}

// ============ أدوات مساعدة ============
function toMoney(n) {
  return (Number(n) || 0).toFixed(2);
}

// ============ نظام الهدف ============
function editGoal(id) {
  const goals = JSON.parse(localStorage.getItem('goals') || '{}');
  const g = prompt('Set goal $', goals[id] || 50);
  if (g != null) {
    goals[id] = Number(g);
    localStorage.setItem('goals', JSON.stringify(goals));
  }
}

// ============ لوحة التفاصيل الأسبوعية ============
const dp = document.getElementById('detailPanel');
const db = document.getElementById('detailBackdrop');
const dttl = document.getElementById('detailTitle');
const dsub = document.getElementById('detailSub');
const drng = document.getElementById('detailRange');
const dst = document.getElementById('detailStats');
const dch = document.getElementById('weeklyChart');
const ddChart = document.getElementById('ddChart');
const dtb = document.getElementById('detailTable').querySelector('tbody');
const seg = document.getElementById('periodSeg');
document.getElementById('detailClose').onclick = closeDetail;
db.onclick = closeDetail;

seg.addEventListener('click', e => {
  const b = e.target.closest('.seg-btn');
  if (!b) return;
  seg.querySelectorAll('.seg-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  currentDays = Number(b.dataset.days) || 7;
  if (currentDetailAcc) openDetail(currentDetailAcc, true);
});

function openDetail(acc, rerenderOnly = false) {
  currentDetailAcc = acc;

  if (!rerenderOnly) {
    dttl.textContent = acc.alias || acc.account_id;
    dsub.textContent = acc.alias && acc.account_id ? `#${acc.account_id}` : '';
    db.classList.remove('hidden');
    dp.classList.remove('hidden');
    requestAnimationFrame(() => {
      db.classList.add('show');
      dp.classList.add('open');
    });
  }

  const end = Date.now();
  const start = end - currentDays * 24 * 60 * 60 * 1000;
  drng.textContent = `${new Date(start).toLocaleString()} — ${new Date(end).toLocaleString()}`;

  const points = acc.history.filter(h => h.timestamp >= start && h.timestamp <= end);
  const data = points.length ? points : [acc.history[acc.history.length - 1] || acc.last];

  const first = data[0]?.balance ?? acc.initial;
  const last = data[data.length - 1]?.balance ?? acc.last.balance;
  const delta = last - first;
  const max = Math.max(...data.map(p => p.balance));
  const min = Math.min(...data.map(p => p.balance));
  dst.innerHTML = `
    <span class="chip">First: <b>$${toMoney(first)}</b></span>
    <span class="chip">Last: <b>$${toMoney(last)}</b></span>
    <span class="chip">Δ ${currentDays}d: <b class="${delta >= 0 ? 'pos' : 'neg'}">$${toMoney(delta)}</b></span>
    <span class="chip">Max: <b>$${toMoney(max)}</b></span>
    <span class="chip">Min: <b>$${toMoney(min)}</b></span>
  `;

  dch.innerHTML = chartWeeklySVG(data);
  ddChart.innerHTML = drawdownSVG(data);

  const byDay = groupByDay(data);
  dtb.innerHTML = Object.keys(byDay)
    .sort()
    .map(day => {
      const arr = byDay[day];
      const f = arr[0]?.balance ?? 0;
      const l = arr[arr.length - 1]?.balance ?? f;
      const d = l - f;
      return `<tr>
        <td>${day}</td>
        <td>$${toMoney(l)}</td>
        <td>$${toMoney(f)}</td>
        <td class="${d >= 0 ? 'pos' : 'neg'}">$${toMoney(d)}</td>
      </tr>`;
    })
    .join('');
}

function closeDetail() {
  db.classList.remove('show');
  dp.classList.remove('open');
  setTimeout(() => {
    db.classList.add('hidden');
    dp.classList.add('hidden');
  }, 200);
}

function groupByDay(points) {
  const o = {};
  points.forEach(p => {
    const d = new Date(p.timestamp);
    const k = `${d.getFullYear()}-${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    (o[k] = o[k] || []).push(p);
  });
  return o;
}

// ===== الشارت الأسبوعي =====
function chartWeeklySVG(points) {
  const W = dch.clientWidth || 760,
    H = 260,
    P = 36;
  const xs = points.map(p => ({
    x: p.timestamp,
    bal: p.balance,
    eq: isFinite(p.equity) ? p.equity : NaN,
  }));
  const minX = xs[0]?.x ?? Date.now() - currentDays * 864e5,
    maxX = xs[xs.length - 1]?.x ?? Date.now();
  const vals = xs.flatMap(p => [p.bal, isFinite(p.eq) ? p.eq : undefined]).filter(v => isFinite(v));
  const minY = Math.min(...vals, 0),
    maxY = Math.max(...vals, 1);
  const xmap = t => P + ((t - minX) / (maxX - minX || 1)) * (W - 2 * P);
  const ymap = v => H - P - ((v - minY) / (maxY - minY || 1)) * (H - 2 * P);

  const days = Array.from({ length: 8 }, (_, i) => minX + i * ((maxX - minX) / 7 || 1));
  const gridX = days
    .map(
      t =>
        `<line x1="${xmap(t).toFixed(1)}" y1="${P}" x2="${xmap(t).toFixed(
          1
        )}" y2="${H - P}" stroke="#e5e7eb"/>`
    )
    .join('');
  const labelsX = days
    .map(
      t =>
        `<text x="${xmap(t).toFixed(1)}" y="${H - 10}" text-anchor="middle" fill="#64748b" font-size="11">${new Date(
          t
        ).toLocaleDateString()}</text>`
    )
    .join('');

  const pathBal = xs
    .map((p, i) => `${i ? 'L' : 'M'}${xmap(p.x).toFixed(1)},${ymap(p.bal).toFixed(1)}`)
    .join(' ');
  const pathEq = xs
    .filter(p => isFinite(p.eq))
    .map((p, i) => `${i ? 'L' : 'M'}${xmap(p.x).toFixed(1)},${ymap(p.eq).toFixed(1)}`)
    .join(' ');

  const tipId = 'tip-' + Math.random().toString(36).slice(2);
  const handlers = xs
    .map(p => {
      const x = xmap(p.x),
        y = ymap(p.bal);
      const eqTxt = isFinite(p.eq) ? `<br>Equity: $${toMoney(p.eq)}` : '';
      return `<rect x="${(x - 8).toFixed(1)}" y="${P}" width="16" height="${
        H - 2 * P
      }" fill="transparent"
      onmousemove="const T=document.getElementById('${tipId}');T.style.display='block';T.style.left='${x}px';T.style.top='${y}px';
                   T.innerHTML='${new Date(p.x).toLocaleString()}<br>Balance: $${toMoney(
        p.bal
      )}${eqTxt}';"
      onmouseout="document.getElementById('${tipId}').style.display='none';"></rect>`;
    })
    .join('');

  return `
    <div style="position:relative;width:100%;height:${H}px">
      <svg width="${W}" height="${H}">
        <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
        ${gridX}
        ${pathEq ? `<path d="${pathEq}" fill="none" stroke="var(--eq)" stroke-width="2"/>` : ''}
        <path d="${pathBal}" fill="none" stroke="var(--bal)" stroke-width="2"/>
        ${labelsX}
        ${handlers}
        <text x="${P - 6}" y="${H - P + 4}" text-anchor="end" class="dd-axis">$${toMoney(minY)}</text>
        <text x="${P - 6}" y="${P + 4}" text-anchor="end" class="dd-axis">$${toMoney(maxY)}</text>
      </svg>
      <div id="${tipId}" class="tip" style="display:none;position:absolute;"></div>
    </div>
  `;
}

// ===== رسم Drawdown =====
function drawdownSVG(points) {
  if (!points.length) return '';
  const by = groupByDay(points);
  const keys = Object.keys(by).sort();
  const days = keys.map(k => ({ day: k, arr: by[k] }));
  const dd = days.map(d => {
    const bal = d.arr.map(p => p.balance);
    const max = Math.max(...bal);
    const min = Math.min(...bal);
    const ddPct = max > 0 ? ((min - max) / max) * 100 : 0;
    return { day: d.day, dd: ddPct };
  });

  const W = ddChart.clientWidth || 760,
    H = 120,
    P = 36;
  const minY = Math.min(0, ...dd.map(x => x.dd));
  const xmap = i => P + (i / Math.max(1, dd.length - 1)) * (W - 2 * P);
  const ymap = v => H - P - ((v - minY) / (0 - minY || 1)) * (H - 2 * P);

  const bars = dd
    .map((d, i) => {
      const x = xmap(i) - 10,
        y = ymap(d.dd);
      const h = ymap(0) - y;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="20" height="${Math.max(
        0,
        h
      ).toFixed(1)}" class="dd-bar">
              <title>${d.day} — ${toMoney(d.dd)}%</title>
            </rect>`;
    })
    .join('');

  const labelsX = dd
    .map(
      (d, i) =>
        `<text x="${xmap(i).toFixed(1)}" y="${H - 10}" text-anchor="middle" class="dd-axis">${d.day.slice(5)}</text>`
    )
    .join('');

  return `
    <svg width="${W}" height="${H}">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <line x1="${P}" y1="${ymap(0)}" x2="${W - P}" y2="${ymap(0)}" stroke="#e5e7eb"/>
      ${bars}
      ${labelsX}
      <text x="${P - 6}" y="${ymap(minY) - 4}" text-anchor="end" class="dd-axis">${toMoney(minY)}%</text>
    </svg>
  `;
}

// ============ البحث والتحديث ============
searchInput.addEventListener('input', () => renderDashboard(getFilteredData()));
sortFilter.addEventListener('change', () => renderDashboard(getFilteredData()));
downloadBtn.addEventListener('click', downloadCSV);

fetchAccounts();
setInterval(fetchAccounts, 5000);

// ============ CSV ============
function downloadCSV() {
  const rows = [['Alias', 'Account ID', 'Balance', 'Profit', 'Last Updated']];
  Object.values(accounts).forEach(acc => {
    const last = acc.history[acc.history.length - 1];
    const initial = acc.initial_balance ?? 100;
    const profit = last.balance - initial;
    rows.push([
      acc.alias || '',
      acc.account_id,
      last.balance.toFixed(2),
      profit.toFixed(2),
      new Date(last.timestamp).toLocaleString(),
    ]);
  });

  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'accounts_report.csv';
  a.click();
}
