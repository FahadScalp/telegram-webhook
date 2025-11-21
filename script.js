/* =========================================================
   Dashboard Script — FahadScalp
   - Fetch /accounts (Basic Auth يشتغل تلقائياً بعد دخول الصفحة)
   - Cards: Initial + Balance + Equity + Today + Profit
   - Totals bar + CSV + Search + Sort + Weekly Drawer
   - Goals per account via localStorage
   ========================================================= */

const dashboard   = document.getElementById('dashboard');
const searchInput = document.getElementById('searchInput');
const sortFilter  = document.getElementById('sortFilter');
const downloadBtn = document.getElementById('downloadBtn');

let accounts = {};      // payload من /accounts
let filtered = [];      // نتيجة getFilteredData()
let fetchTimer = null;

/* ===================== Utils ===================== */
const toMoney = n => (Number(n) || 0).toFixed(2);
function fixTsMs(t){ const n=Number(t); return n<1e12 ? n*1000 : n; }
function fmtDate(ts){
  try{
    const d = new Date(fixTsMs(ts));
    const date = d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' }); // 14/11/2025
    const time = d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    return `${date}, ${time}`;
  }catch(_){
    return '-';
  }
}

function fmtDateOnly(dOrTs){
  const d = (dOrTs instanceof Date) ? dOrTs : new Date(fixTsMs(dOrTs));
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' });
}


// أهداف الحسابات (محفوظة محلياً)
const GOALS_KEY = 'goals_by_account';
function loadGoals(){ try{ return JSON.parse(localStorage.getItem(GOALS_KEY)) || {}; }catch{ return {}; } }
function saveGoals(obj){ localStorage.setItem(GOALS_KEY, JSON.stringify(obj)); }
function getGoal(id){ const g=loadGoals(); return Number(g[id] ?? 50); }
function setGoal(id,val){ const g=loadGoals(); g[id]=Number(val)||0; saveGoals(g); }

// تأكد من وجود شريط المجمّع
function ensureTotalsBar(){
  let bar = document.getElementById('totalsBar');
  if (!bar){
    bar = document.createElement('div');
    bar.id = 'totalsBar';
    bar.className = 'totals';
    // ضعه قبل الشبكة/الدashboard
    dashboard.parentElement.insertBefore(bar, dashboard);
  }
  return bar;
}

/* ===================== Fetch ===================== */
async function fetchAccounts(){
  try{
    const res = await fetch('/accounts', { cache:'no-store' });
    if(!res.ok){
      console.error('GET /accounts failed:', res.status);
      renderEmpty('لا توجد بيانات (HTTP '+res.status+')');
      return;
    }
    accounts = await res.json();
    filtered = getFilteredData();
    renderTotals(filtered);
    renderDashboard(filtered);
  }catch(err){
    console.error('fetchAccounts error:', err);
    renderEmpty('فشل الاتصال بالسيرفر');
  }
}

/* ===================== Filter & Sort ===================== */
function getFilteredData(){
  const val = (searchInput?.value || '').toLowerCase();

  const data = Object.values(accounts).map(acc => {
    const history = Array.isArray(acc.history) ? acc.history.map(h => ({
      balance: Number(h.balance)||0,
      equity:  (h.equity==null ? undefined : Number(h.equity)),
      timestamp: fixTsMs(h.timestamp)
    })) : [];

    const last = history.length ? history[history.length-1] : {
      balance: Number(acc.last?.balance)||0,
      equity:  (acc.last?.equity==null ? undefined : Number(acc.last?.equity)),
      timestamp: fixTsMs(acc.last?.timestamp || Date.now())
    };

    return {
      ...acc,
      history,
      last,
      today: Number(acc.today)||0,
      initial_balance: Number(acc.initial_balance)||0
    };
  }).filter(acc =>
    (acc.alias||'').toLowerCase().includes(val) ||
    (String(acc.account_id)||'').toLowerCase().includes(val)
  );

  const sortBy = sortFilter?.value || 'default';
  if (sortBy === 'profit'){
    data.sort((a,b)=> ((b.last.balance-b.initial_balance)-(a.last.balance-a.initial_balance)) );
  } else if (sortBy === 'balance'){
    data.sort((a,b)=> b.last.balance - a.last.balance);
  } else if (sortBy === 'recent'){
    data.sort((a,b)=> (b.last.timestamp||0)-(a.last.timestamp||0));
  }
  return data;
}

/* ===================== Totals ===================== */
function renderTotals(data){
  const bar = ensureTotalsBar();
  let totalBal=0, totalInit=0, totalToday=0;

  data.forEach(acc=>{
    totalBal  += Number(acc.last.balance)||0;
    totalInit += Number(acc.initial_balance)||0;
    totalToday+= Number(acc.today)||0;
  });

  const pnl = totalBal - totalInit;
  bar.innerHTML = `
    <div class="chip"> <span class="muted">Total Balance:</span> <b>$${toMoney(totalBal)}</b> </div>
    <div class="chip"> <span class="muted">Initial:</span> <b>$${toMoney(totalInit)}</b> </div>
    <div class="chip"> <span class="muted">PNL:</span> <b class="${pnl>=0?'pnl-pos':'pnl-neg'}">$${toMoney(pnl)}</b> </div>
    <div class="chip"> <span class="muted">Today:</span> <b class="${totalToday>=0?'pnl-pos':'pnl-neg'}">$${toMoney(totalToday)}</b> </div>
  `;
}

/* ===================== Cards ===================== */
function renderDashboard(data){
  if (!dashboard) return;
  dashboard.innerHTML = '';
  if (!data.length){ renderEmpty('لا توجد حسابات مطابقة'); return; }

  data.forEach(acc=>{
    const init   = Number(acc.initial_balance)||0;
    const bal    = Number(acc.last.balance)||0;
    const eq     = (acc.last.equity==null ? undefined : Number(acc.last.equity));
    const profit = bal - init;
    const today  = Number(acc.today)||0;

    const card = document.createElement('article');
    card.className = `card ${profit>0?'pos':profit<0?'neg':'zero'}`;

    card.innerHTML = `
      <div class="title">
        <span>${acc.alias || acc.account_id || '-'}</span>
        ${acc.account_id ? `<small>(#${acc.account_id})</small>` : ``}
      </div>

      <div class="info three">
        <div>Initial: <b>$${toMoney(init)}</b></div>
        <div>Balance: <b>$${toMoney(bal)}</b></div>
        <div>Equity: <b class="eqv">${(eq==null||isNaN(eq)) ? '—' : '$'+toMoney(eq)}</b></div>
      </div>

      <div class="info">
        <div>Today: <b class="${today>=0?'pos':'neg'}">$${toMoney(today)}</b></div>
        <div>Profit: <b class="${profit>=0?'pos':'neg'}">$${toMoney(profit)}</b></div>
      </div>

      <div class="history">
        ${renderMiniHistory(acc.history)}
      </div>

      <div class="goal">
        <div class="progress"><i style="width:${goalPct(acc)*100}%"></i></div>
        <div class="edit" data-editgoal="${acc.account_id||''}">Edit goal</div>
      </div>

      <div class="muted" style="margin-top:6px">
        Last updated: ${fmtDate(acc.last.timestamp)}
      </div>
    `;

    // افتح الرسم الجانبي عند الضغط على البطاقة
    card.addEventListener('click', (ev)=>{
      // منع تداخل مع زر Edit goal
      if ((ev.target && ev.target.getAttribute && ev.target.getAttribute('data-editgoal') != null)) return;
      openDetail(acc);
    });

    // زر Edit goal
    const editBtn = card.querySelector('[data-editgoal]');
    editBtn?.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = String(editBtn.getAttribute('data-editgoal')||'');
      const current = getGoal(id);
      const val = prompt(`ضع هدف الربح ($):`, current);
      if (val==null) return;
      setGoal(id, Number(val)||0);
      // أعِد رسم البطاقة لتحديث شريط التقدم
      renderDashboard(getFilteredData());
    });

    dashboard.appendChild(card);
  });
}

function renderMiniHistory(arr){
  if (!arr || !arr.length) return `<span class="muted">No history</span>`;
  // آخر 3 نقاط فقط
  const last3 = arr.slice(-3);
  return last3.map((h,i,a)=>{
    const prev = i===0 ? h.balance : a[i-1].balance;
    const diff = (Number(h.balance)||0) - (Number(prev)||0);
    return `• ${fmtDate(h.timestamp)} | $${toMoney(h.balance)} | Δ: ${toMoney(diff)}`;
  }).join('<br>');
}

function goalPct(acc){
  const g  = getGoal(acc.account_id||'') || 0;
  if (!g) return 0;
  const pnl = (Number(acc.last.balance)||0) - (Number(acc.initial_balance)||0);
  const pct = Math.max(0, Math.min(1, pnl / g));
  return pct;
}

function renderEmpty(msg){
  dashboard.innerHTML = `
    <div class="card zero" style="grid-column: 1/-1; text-align:center">
      <div class="muted">${msg || '—'}</div>
    </div>
  `;
}

/* ===================== Drawer (Weekly Detail) ===================== */
let drawer, backdrop;
function ensureDrawer(){
  if (drawer && backdrop) return;
  backdrop = document.getElementById('backdrop');
  drawer   = document.getElementById('drawer');
  if (!backdrop){
    backdrop = document.createElement('div');
    backdrop.id = 'backdrop';
    backdrop.className = 'backdrop hidden';
    document.body.appendChild(backdrop);
  }
  if (!drawer){
    drawer = document.createElement('div');
    drawer.id = 'drawer';
    drawer.className = 'drawer';
    drawer.innerHTML = `
      <div class="drawer-header">
        <div>
          <div class="drawer-title" id="dwTitle">—</div>
          <div class="drawer-sub" id="dwSub">—</div>
        </div>
        <button class="btn-close big" id="dwClose">×</button>
      </div>
      <div class="drawer-body">
        <div class="stats-row" id="dwStats"></div>

        <div class="chart-wrap">
          <div class="chart-head">
  <div>Balance (last days)</div>
  <select id="dwRange" class="range-select">
    <!-- نملأ الخيارات من JS (1–30 يوم) -->
  </select>
</div>
          <div id="chartArea" class="chart"></div>
          <div class="legend">
            <span>Balance</span><span class="sep"></span>
            <span>Equity (إن وُجد)</span>
          </div>
        </div>

        <div class="table-wrap">
          <table class="mini-table" id="dwTable">
            <thead><tr><th>Δ</th><th>Last</th><th>First</th><th>التاريخ</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    `;
    document.body.appendChild(drawer);
  }
  document.getElementById('dwClose').onclick = closeDetail;
  backdrop.onclick = closeDetail;
}

function openDetail(acc){
  ensureDrawer();

  document.getElementById('dwTitle').textContent = acc.alias || acc.account_id || '-';
  document.getElementById('dwSub').textContent   = `#${acc.account_id || '-'} — Last: ${fmtDate(acc.last.timestamp)}`;

  const segBtns = drawer.querySelectorAll('.seg-btn');
  segBtns.forEach(btn=>{
    btn.onclick = ()=>{
      segBtns.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const days = Number(btn.dataset.range)||30;
      drawChart(acc, days);
      fillTable(acc, days);
    };
  });

  drawChart(acc, 30);
  fillTable(acc, 30);

  const init = Number(acc.initial_balance)||0;
const bal  = Number(acc.last.balance)||0;
const eq   = (acc.last.equity==null ? undefined : Number(acc.last.equity));
const pnl  = bal - init;

const stats = document.getElementById('dwStats');
stats.innerHTML = `
  <div class="chip">Initial: <b>$${toMoney(init)}</b></div>
  <div class="chip">Balance: <b>$${toMoney(bal)}</b></div>
  <div class="chip">Equity: <b>${(eq==null||isNaN(eq)) ? '—' : '$'+toMoney(eq)}</b></div>
  <div class="chip">Today: <b class="${(acc.today||0)>=0?'pos':'neg'}">$${toMoney(acc.today||0)}</b></div>
  <div class="chip">PNL الكلي: <b class="${pnl>=0?'pos':'neg'}">$${toMoney(pnl)}</b></div>
  <div class="chip" id="dwRangePnlChip">Range PNL: <b>$0.00</b></div>
`;
const rangeSelect = document.getElementById('dwRange');
if (rangeSelect && !rangeSelect.dataset.ready){
  // نملأ من 1 إلى 30 يوم مرة واحدة فقط
  let opts = '';
  for (let d = 1; d <= 30; d++){
    opts += `<option value="${d}" ${d===7?'selected':''}>آخر ${d} يوم</option>`;
  }
  rangeSelect.innerHTML = opts;
  rangeSelect.dataset.ready = '1';
}

// دالة لتحديث الرسم + الجدول + إجمالي PnL للمدى
function updateRange(){
  const days = Number(rangeSelect.value) || 7;
  drawChart(acc, days);
  fillTable(acc, days);   // سنعدّل fillTable بعد شوي
}

rangeSelect.onchange = updateRange;

// أول مرة
updateRange();


  backdrop.classList.remove('hidden');
  void drawer.offsetWidth;
  drawer.classList.add('open');
  setTimeout(()=>backdrop.classList.add('show'), 10);
}

function closeDetail(){
  drawer.classList.remove('open');
  backdrop.classList.remove('show');

  const onEnd = () => {
    backdrop.classList.add('hidden');
    drawer.removeEventListener('transitionend', onEnd);
  };
  drawer.addEventListener('transitionend', onEnd);
}


function drawChart(acc, days){
  const area = document.getElementById('chartArea');
  area.innerHTML = ''; // reset

  const end   = Date.now();
  const start = end - days*24*3600*1000;

  // نقاط ضمن المدى
  const pts = (acc.history||[]).filter(h => (h.timestamp>=start && h.timestamp<=end));
  if (!pts.length){
    area.innerHTML = `<div class="muted" style="padding:14px">لا توجد بيانات في هذا المدى.</div>`;
    return;
  }

  // حدود
  const minV = Math.min(...pts.map(p=>p.balance));
  const maxV = Math.max(...pts.map(p=>p.balance));
  const minT = start, maxT = end;

  const W=area.clientWidth||600, H=260, pad=20;
  const sx = t => pad + ( (t-minT)/(maxT-minT) )*(W-2*pad);
  const sy = v => (H-pad) - ( (v-minV)/(maxV-minV||1) )*(H-2*pad);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H);

  // خط الـBalance
  const pathB = document.createElementNS(svgNS,'path');
  pathB.setAttribute('fill','none'); pathB.setAttribute('stroke','#0f172a'); pathB.setAttribute('stroke-width','2');
  pathB.setAttribute('d', polyline(pts.map(p=>[sx(p.timestamp), sy(p.balance)])));
  svg.appendChild(pathB);

  // خط الـEquity إن وُجد
  const eqPts = pts.filter(p=>p.equity!=null && !isNaN(Number(p.equity)));
  if (eqPts.length){
    const pathE = document.createElementNS(svgNS,'path');
    pathE.setAttribute('fill','none'); pathE.setAttribute('stroke','#2563eb'); pathE.setAttribute('stroke-width','2');
    pathE.setAttribute('d', polyline(eqPts.map(p=>[sx(p.timestamp), sy(p.equity)])));
    svg.appendChild(pathE);
  }

  area.appendChild(svg);

  function polyline(pairs){
    if (!pairs.length) return '';
    return 'M'+pairs.map(([x,y])=>`${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
  }
}

function getDailyPnL(acc, days){
  const end   = Date.now();
  const start = end - days*24*3600*1000;

  const history = acc.history || [];
  const rows = history.filter(h => h.timestamp >= start && h.timestamp <= end);

  const byDate = {};
  rows.forEach(h => {
    const d = new Date(h.timestamp);
    const key = d.toISOString().slice(0, 10); // yyyy-mm-dd
    if (!byDate[key]){
      byDate[key] = { first: h.balance, last: h.balance, ts: h.timestamp };
    } else {
      byDate[key].last = h.balance;
      byDate[key].ts   = h.timestamp;
    }
  });

  return Object.keys(byDate).sort().map(key => {
    const rec   = byDate[key];
    const delta = (Number(rec.last)||0) - (Number(rec.first)||0);
    return {
      key,
      dateObj: new Date(rec.ts),
      first: Number(rec.first)||0,
      last:  Number(rec.last)||0,
      delta
    };
  });
}


function fillTable(acc, days){
  const tbody = document.querySelector('#dwTable tbody');
  if (!tbody) return;

  const end   = Date.now();
  const start = end - days * 24 * 3600 * 1000;

  const histAll = acc.history || [];

  // نرشّح التحديثات ضمن مدى الأيام المطلوب
  const updates = histAll.filter(h =>
    h.timestamp >= start && h.timestamp <= end
  );

  tbody.innerHTML = '';

  if (!updates.length){
    tbody.innerHTML = `<tr><td colspan="4" class="muted">لا توجد بيانات</td></tr>`;
    const chip = document.getElementById('dwRangePnlChip');
    if (chip){
      chip.innerHTML = `Range PNL (${days} يوم): <b>$0.00</b>`;
    }
    return;
  }

  // نتأكد أنه مرتّب تصاعديًا بالوقت
  updates.sort((a,b) => a.timestamp - b.timestamp);

  const rows = [];
  let prevBal = null;

  updates.forEach(h => {
    const last  = Number(h.balance) || 0;
    const first = (prevBal == null ? last : prevBal);
    const rawDelta = last - first;

    // نقرّب للعرض ونستخدمه في الفلترة
    const deltaNum  = rawDelta;
    const deltaText = toMoney(deltaNum); // يعطي "0.00" أو "5.23" إلخ

    rows.push({
      first,
      last,
      delta: deltaNum,
      deltaText,
      ts: h.timestamp
    });

    prevBal = last;
  });

  // 👈 هنا الفلترة: نستبعد أي صف يكون دلتا بعد التقريب = 0.00
  const visibleRows = rows.filter(r => r.deltaText !== '0.00');

  // لو بعد الفلترة ما بقي شيء، نعرض رسالة بسيطة
  if (!visibleRows.length){
    tbody.innerHTML = `<tr><td colspan="4" class="muted">لا يوجد ربح/خسارة (كل التحديثات 0.00$)</td></tr>`;
  } else {
    // نعرض الأحدث أولاً
    visibleRows.slice().reverse().forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="${row.delta >= 0 ? 'pos' : 'neg'}">$${row.deltaText}</td>
        <td>$${toMoney(row.last)}</td>
        <td>$${toMoney(row.first)}</td>
        <td>${fmtDate(row.ts)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // إجمالي PnL للمدى نحسبه فقط من الصفوف الظاهرة
  const totalDelta = visibleRows.reduce((sum, r) => sum + r.delta, 0);

  const chip = document.getElementById('dwRangePnlChip');
  if (chip){
    chip.innerHTML =
      `Range PNL (${days} يوم): <b class="${totalDelta >= 0 ? 'pos' : 'neg'}">$${toMoney(totalDelta)}</b>`;
  }
}





/* ===================== CSV ===================== */
function downloadCSV(){
  const rows = [["Alias","Account ID","Initial","Balance","Equity","Today","Profit","Last Updated"]];
  Object.values(accounts).forEach(acc=>{
    const init = Number(acc.initial_balance)||0;
    const last = acc.last || {};
    const bal  = Number(last.balance)||0;
    const eq   = (last.equity==null ? '' : Number(last.equity).toFixed(2));
    const pnl  = bal - init;
    rows.push([
      (acc.alias||''),
      (acc.account_id||''),
      toMoney(init),
      toMoney(bal),
      eq === '' ? '' : toMoney(eq),
      toMoney(acc.today||0),
      toMoney(pnl),
      fmtDate(last.timestamp||Date.now())
    ]);
  });
  const csv = rows.map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='accounts_report.csv'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

/* ===================== Events ===================== */
searchInput?.addEventListener('input', ()=>{
  filtered = getFilteredData();
  renderTotals(filtered);
  renderDashboard(filtered);
});
sortFilter?.addEventListener('change', ()=>{
  filtered = getFilteredData();
  renderTotals(filtered);
  renderDashboard(filtered);
});
downloadBtn?.addEventListener('click', downloadCSV);

/* ===================== Init ===================== */
fetchAccounts();
if (fetchTimer) clearInterval(fetchTimer);
fetchTimer = setInterval(fetchAccounts, 5000);
