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

    // افتح التفاصيل عند الضغط على أي مكان في الكرت (مع استثناء أزرار صغيرة)
card.addEventListener('click', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'button' || e.target.classList.contains('edit')) return; // لا تفتح عند Edit goal
  openDetail(acc);
});


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

// ===== Weekly detail (last 7 days) =====
const dp  = document.getElementById('detailPanel');
const db  = document.getElementById('detailBackdrop');
const dttl= document.getElementById('detailTitle');
const dsub= document.getElementById('detailSub');
const drng= document.getElementById('detailRange');
const dst = document.getElementById('detailStats');
const dch = document.getElementById('weeklyChart');
const dtb = document.getElementById('detailTable').querySelector('tbody');
document.getElementById('detailClose').onclick = closeDetail;
db.onclick = closeDetail;

function openDetail(acc){
  // شكل العنوان
  dttl.textContent = acc.alias || acc.account_id;
  dsub.textContent = acc.alias && acc.account_id ? `#${acc.account_id}` : '';

  // نطاق الأسبوع
  const end = Date.now();
  const start = end - 7*24*60*60*1000;
  drng.textContent = `${new Date(start).toLocaleString()} — ${new Date(end).toLocaleString()}`;

  // فلترة آخر 7 أيام
  const weekHist = acc.history.filter(h => h.timestamp >= start && h.timestamp <= end);
  const points = weekHist.length ? weekHist : [acc.history[acc.history.length-1] || acc.last];

  // إحصاءات سريعة
  const first = points[0]?.balance ?? acc.initial;
  const last  = points[points.length-1]?.balance ?? acc.last.balance;
  const delta = last - first;
  const max   = Math.max(...points.map(p=>p.balance));
  const min   = Math.min(...points.map(p=>p.balance));

  dst.innerHTML = `
    <span class="chip">First: <b>$${toMoney(first)}</b></span>
    <span class="chip">Last: <b>$${toMoney(last)}</b></span>
    <span class="chip">Δ Week: <b class="${delta>=0?'pos':'neg'}">$${toMoney(delta)}</b></span>
    <span class="chip">Max: <b>$${toMoney(max)}</b></span>
    <span class="chip">Min: <b>$${toMoney(min)}</b></span>
  `;

  // رسم الخط مع محاور وأيام أسبوع
  dch.innerHTML = chartWeeklySVG(points);

  // جدول يومي (group by day)
  const byDay = groupByDay(points);
  dtb.innerHTML = Object.keys(byDay).sort().map(day => {
    const arr= byDay[day];
    const f= arr[0]?.balance ?? 0;
    const l= arr[arr.length-1]?.balance ?? f;
    const d= l - f;
    return `<tr>
      <td>${day}</td>
      <td>$${toMoney(f)}</td>
      <td>$${toMoney(l)}</td>
      <td class="${d>=0?'pos':'neg'}">$${toMoney(d)}</td>
    </tr>`;
  }).join('');

  // فتح اللوحة
  db.classList.remove('hidden'); dp.classList.remove('hidden');
  requestAnimationFrame(()=>{ db.classList.add('show'); dp.classList.add('open'); });
}

function closeDetail(){
  db.classList.remove('show'); dp.classList.remove('open');
  setTimeout(()=>{ db.classList.add('hidden'); dp.classList.add('hidden'); }, 200);
}

function groupByDay(points){
  const o={};
  points.forEach(p=>{
    const d=new Date(p.timestamp);
    const k= `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
    (o[k]=o[k]||[]).push(p);
  });
  return o;
}

// رسم أسبوعي: شبكة + محاور + خط + نقاط + Tooltip
function chartWeeklySVG(points){
  const W = dch.clientWidth || 760, H = 260, P = 36;
  const xs = points.map(p=>({ x:p.timestamp, y:p.balance }));
  const minX = xs[0]?.x ?? Date.now()-7*864e5, maxX = xs[xs.length-1]?.x ?? Date.now();
  const minY = Math.min(...xs.map(p=>p.y), 0), maxY = Math.max(...xs.map(p=>p.y), 1);
  const xmap = t => P + ( (t - minX) / (maxX - minX || 1) ) * (W - 2*P);
  const ymap = v => H - P - ( (v - minY) / (maxY - minY || 1) ) * (H - 2*P);

  // محاور اليوم (7 فواصل)
  const days = Array.from({length:8}, (_,i)=> minX + i*( (maxX-minX)/7 || 1));
  const gridX = days.map(t=> `<line x1="${xmap(t).toFixed(1)}" y1="${P}" x2="${xmap(t).toFixed(1)}" y2="${H-P}" stroke="#e5e7eb"/>`).join('');
  const labelsX = days.map(t=> `<text x="${xmap(t).toFixed(1)}" y="${H-10}" text-anchor="middle" fill="#64748b" font-size="11">${new Date(t).toLocaleDateString()}</text>`).join('');

  // خطوط أفقية (4)
  const rows = 4;
  const gridY = Array.from({length:rows+1},(_,i)=> {
    const y = P + i*((H-2*P)/rows);
    return `<line x1="${P}" y1="${y.toFixed(1)}" x2="${(W-P).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#eef2f7"/>`;
  }).join('');

  // خط البيانات
  const path = xs.map((p,i)=> `${i?'L':'M'}${xmap(p.x).toFixed(1)},${ymap(p.y).toFixed(1)}`).join(' ');
  const dots = xs.map(p=> `<circle cx="${xmap(p.x).toFixed(1)}" cy="${ymap(p.y).toFixed(1)}" r="3" fill="#16a34a"/>`).join('');

  // Tooltip بسيط
  const tipId = 'tip-'+Math.random().toString(36).slice(2);
  const handlers = xs.map(p=>{
    const x = xmap(p.x), y = ymap(p.y);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10" fill="transparent"
      onmousemove="document.getElementById('${tipId}').style.display='block';
                   document.getElementById('${tipId}').style.left='${x}px';
                   document.getElementById('${tipId}').style.top='${y}px';
                   document.getElementById('${tipId}').innerHTML='${new Date(p.x).toLocaleString()}<br>$${toMoney(p.y)}';"
      onmouseout="document.getElementById('${tipId}').style.display='none';"/>`;
  }).join('');

  return `
    <div style="position:relative; width:100%; height:${H}px">
      <svg width="${W}" height="${H}">
        <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
        ${gridX} ${gridY}
        <path d="${path}" fill="none" stroke="#16a34a" stroke-width="2"/>
        ${dots}
        ${handlers}
        ${labelsX}
        <!-- y-axis min/max labels -->
        <text x="${P-6}" y="${H-P+4}" text-anchor="end" fill="#64748b" font-size="11">$${toMoney(minY)}</text>
        <text x="${P-6}" y="${P+4}" text-anchor="end" fill="#64748b" font-size="11">$${toMoney(maxY)}</text>
      </svg>
      <div id="${tipId}" class="tip" style="display:none; position:absolute;"></div>
    </div>
  `;
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
