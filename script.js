// ===================== عناصر الواجهة ===================== //
const dashboard   = document.getElementById('dashboard');
const searchInput = document.getElementById('searchInput');
const sortFilter  = document.getElementById('sortFilter');
const downloadBtn = document.getElementById('downloadBtn');
const toMoney = n => (Number(n)||0).toFixed(2);

// لوحة التفاصيل (الدرور)
const dp   = document.getElementById('detailPanel');
const db   = document.getElementById('detailBackdrop');
const dttl = document.getElementById('detailTitle');
const dsub = document.getElementById('detailSub');
const drng = document.getElementById('detailRange');
const dst  = document.getElementById('detailStats');
const dch  = document.getElementById('weeklyChart');
const ddChart = document.getElementById('ddChart');
const dtb  = document.getElementById('detailTable').querySelector('tbody');
const seg  = document.getElementById('periodSeg');
document.getElementById('detailClose').onclick = closeDetail;
db.onclick = closeDetail;

// ===================== حالة عامة ===================== //
let accounts = {};
let currentDetailAcc = null;
let currentDays = 7;

// ===================== أدوات مساعدة ===================== //
const toMoney = (v) => (isFinite(v) ? Number(v).toFixed(2) : '0.00');
const safe    = (v, def=0)=> (isFinite(Number(v)) ? Number(v) : def);
const fixTsMs = (ts)=>{ const n=Number(ts); if(!isFinite(n))return Date.now(); return n<1e12? n*1000 : n; };

// ===================== جلب وعرض ===================== //
async function fetchAccounts(){
  try{
    const res = await fetch('/accounts',{cache:'no-store'});
    accounts = await res.json() || {};
  }catch(e){ console.error('Fetch /accounts failed:', e); }
  renderDashboard(getFilteredData());
}

function getFilteredData() {
  const val = (searchInput.value || "").toLowerCase();

  // حوّل history إلى شكل موحّد + أصلح timestamp + التقط equity لو موجود
  const data = Object.values(accounts).map(acc => {
    const history = Array.isArray(acc.history) ? acc.history.map(h => ({
      balance: Number(h.balance) || 0,
      equity:  Number(h.equity),                 // قد يكون undefined — ما عندنا مشكلة
      timestamp: fixTsMs(h.timestamp)            // يتعامل مع ms أو s
    })) : [];

    const last = history.length
      ? history[history.length - 1]
      : {
          balance: Number(acc.balance) || 0,
          equity:  Number(acc.equity),           // احتياطي إذا السيرفر يرسلها خارج history
          timestamp: Date.now()
        };

    return {
      ...acc,
      history,
      last,
      initial_balance: Number.isFinite(Number(acc.initial_balance))
        ? Number(acc.initial_balance)
        : (history[0]?.balance ?? 0),
      today: Number(acc.today) || 0,
      equity: Number(acc.equity)                 // احتياطي للاستخدام إذا history لا يحتوي equity
    };
  })
  // فلترة البحث (alias أو account_id)
  .filter(acc =>
    (acc.alias || "").toLowerCase().includes(val) ||
    (acc.account_id || "").toLowerCase().includes(val)
  );

  // الفرز
  const sortBy = sortFilter.value;
  if (sortBy === "profit") {
    data.sort((a, b) => {
      const pA = (a.last.balance - (a.initial_balance ?? 0));
      const pB = (b.last.balance - (b.initial_balance ?? 0));
      return pB - pA;
    });
  } else if (sortBy === "balance") {
    data.sort((a, b) => b.last.balance - a.last.balance);
  } else if (sortBy === "recent") {
    data.sort((a, b) => (b.last.timestamp || 0) - (a.last.timestamp || 0));
  }

  return data;
}


function totalsBarHTML(list){
  const sum=(f)=>list.reduce((s,a)=>s+f(a),0);
  const totalBal=sum(a=>a.last.balance||0);
  const totalInit=sum(a=>a.initial_balance||0);
  const totalPnL = totalBal-totalInit;
  const totalToday=sum(a=>a.today||0);
  return `
    <div class="totals">
      <div class="chip">Total Balance: <b>$${toMoney(totalBal)}</b></div>
      <div class="chip">Initial: <b>$${toMoney(totalInit)}</b></div>
      <div class="chip">PNL: <b class="${totalPnL>=0?'pnl-pos':'pnl-neg'}">$${toMoney(totalPnL)}</b></div>
      <div class="chip">Today: <b class="${totalToday>=0?'pnl-pos':'pnl-neg'}">$${toMoney(totalToday)}</b></div>
    </div>`;
}

function renderDashboard(data) {
  dashboard.innerHTML = ""; // لو عندك totalsBarHTML حطّه هنا قبل التفريغ

  data.forEach(acc => {
    const initial = acc.initial_balance ?? 0;
    const profit  = (acc.last.balance ?? 0) - initial;

    // التقط الإيكويتي من آخر history ولو غير موجود استخدم acc.equity كاحتياطي
    const equityVal = Number.isFinite(acc.last?.equity) ? acc.last.equity
                    : (Number.isFinite(acc.equity) ? acc.equity : NaN);

    const container = document.createElement("article");
    container.className = `card ${profit>0?'pos':profit<0?'neg':'zero'}`;

    container.innerHTML = `
      <div class="title">
        <span>${acc.alias || acc.account_id || "-"}</span>
        ${acc.account_id ? `<small>(#${acc.account_id})</small>` : ""}
      </div>

      <!-- السطر العلوي: Initial + Balance + Equity -->
      <div class="info three">
        <div>Initial: <b>$${toMoney(initial)}</b></div>
        <div>Balance: <b>$${toMoney(acc.last.balance || 0)}</b></div>
        <div>Equity: <b class="eqv">${Number.isFinite(equityVal) ? '$'+toMoney(equityVal) : '—'}</b></div>
      </div>

      <!-- السطر الثاني: Today + Profit -->
      <div class="info">
        <div>Today: <b class="${(acc.today||0) >= 0 ? 'pos':'neg'}">$${toMoney(acc.today || 0)}</b></div>
        <div>Profit: <b class="${profit >= 0 ? 'pos':'neg'}">$${toMoney(profit)}</b></div>
      </div>

      <div class="history">
        ${
          (acc.history || []).slice(-3).map((h, i, arr) => {
            const prev = i === 0 ? h.balance : arr[i-1].balance;
            const diff = (h.balance||0) - (prev||0);
            return `• ${new Date(h.timestamp).toLocaleString()} | $${toMoney(h.balance||0)} | Δ: ${toMoney(diff)}`;
          }).join("<br>") || '<span class="muted">No history</span>'
        }
      </div>

      <div class="goal">
        <div class="progress">
          <i style="width:${Math.max(0,Math.min(100, (profit/(getGoal(acc.account_id)||50))*100))}%"></i>
        </div>
        <div class="edit" onclick="editGoal('${acc.account_id||''}'); event.stopPropagation();">Edit goal</div>
      </div>

      <div class="muted" style="margin-top:6px">
        Last updated: ${new Date(acc.last.timestamp || Date.now()).toLocaleString()}
      </div>
    `;

    // افتح اللوحة الجانبية عند الضغط (لو عندك openDetail)
    container.addEventListener("click", () => { if (typeof openDetail==='function') openDetail(acc); });

    dashboard.appendChild(container);
  });
}



// ===================== الأهداف (محفوظة محليًا) ===================== //
const goals = JSON.parse(localStorage.getItem('goals')||'{}');
const getGoal = id => Number(goals[id]||50);
function editGoal(id){
  const v = prompt('Set goal $', getGoal(id));
  if(v!=null){ goals[id]=Number(v)||0; localStorage.setItem('goals', JSON.stringify(goals)); renderDashboard(getFilteredData()); }
}

// ===================== لوحة التفاصيل الأسبوعية ===================== //
seg.addEventListener('click',(e)=>{
  const b = e.target.closest('.seg-btn'); if(!b) return;
  seg.querySelectorAll('.seg-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  currentDays = Number(b.dataset.days)||7;
  if(currentDetailAcc) openDetail(currentDetailAcc, true);
});

function openDetail(acc, rerenderOnly=false){
  currentDetailAcc = acc;

  if(!rerenderOnly){
    dttl.textContent = acc.alias || acc.account_id;
    dsub.textContent = acc.alias && acc.account_id ? `#${acc.account_id}` : '';
    db.classList.remove('hidden'); dp.classList.remove('hidden');
    requestAnimationFrame(()=>{ db.classList.add('show'); dp.classList.add('open'); });
  }

  const end   = Date.now();
  const start = end - currentDays*24*60*60*1000;
  drng.textContent = `${new Date(start).toLocaleString()} — ${new Date(end).toLocaleString()}`;

  const points = acc.history.filter(h=> h.timestamp>=start && h.timestamp<=end);
  const data   = points.length ? points : [acc.history[acc.history.length-1] || acc.last];

  const first = data[0]?.balance ?? acc.initial_balance ?? 0;
  const last  = data[data.length-1]?.balance ?? acc.last.balance ?? first;
  const delta = last-first;
  const max   = Math.max(...data.map(p=>p.balance));
  const min   = Math.min(...data.map(p=>p.balance));

  dst.innerHTML = `
    <span class="chip">First: <b>$${toMoney(first)}</b></span>
    <span class="chip">Last: <b>$${toMoney(last)}</b></span>
    <span class="chip">Δ ${currentDays}d: <b class="${delta>=0?'pos':'neg'}">$${toMoney(delta)}</b></span>
    <span class="chip">Max: <b>$${toMoney(max)}</b></span>
    <span class="chip">Min: <b>$${toMoney(min)}</b></span>
  `;

  dch.innerHTML     = chartWeeklySVG(data);
  ddChart.innerHTML = drawdownSVG(data);

  const byDay = groupByDay(data);
  dtb.innerHTML = Object.keys(byDay).sort().map(day=>{
    const arr=byDay[day];
    const f = arr[0]?.balance ?? 0;
    const l = arr[arr.length-1]?.balance ?? f;
    const d = l-f;
    return `<tr>
      <td>${day}</td>
      <td>$${toMoney(l)}</td>
      <td>$${toMoney(f)}</td>
      <td class="${d>=0?'pos':'neg'}">$${toMoney(d)}</td>
    </tr>`;
  }).join('');
}

function closeDetail(){
  db.classList.remove('show'); dp.classList.remove('open');
  setTimeout(()=>{ db.classList.add('hidden'); dp.classList.add('hidden'); }, 200);
}

function groupByDay(points){
  const o={};
  points.forEach(p=>{
    const d=new Date(p.timestamp);
    const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    (o[k]=o[k]||[]).push(p);
  });
  return o;
}

// ===================== رسم الشارت (Balance + Equity) ===================== //
function chartWeeklySVG(points){
  const W = dch.clientWidth || 760, H=260, P=36;
  const xs = points.map(p=>({ x:p.timestamp, bal:safe(p.balance), eq:isFinite(p.equity)?Number(p.equity):NaN }));
  const minX = xs[0]?.x ?? Date.now()-currentDays*864e5;
  const maxX = xs[xs.length-1]?.x ?? Date.now();
  const vals = xs.flatMap(p=> [p.bal, isFinite(p.eq)?p.eq:undefined]).filter(v=>isFinite(v));
  const minY = Math.min(...vals, 0), maxY = Math.max(...vals, 1);
  const xmap = t => P + ((t-minX)/(maxX-minX||1))*(W-2*P);
  const ymap = v => H - P - ((v-minY)/(maxY-minY||1))*(H-2*P);

  const days = Array.from({length:8},(_,i)=> minX + i*((maxX-minX)/7 || 1));
  const gridX = days.map(t=> `<line x1="${xmap(t).toFixed(1)}" y1="${P}" x2="${xmap(t).toFixed(1)}" y2="${H-P}" stroke="#e5e7eb"/>`).join('');
  const labelsX = days.map(t=> `<text x="${xmap(t).toFixed(1)}" y="${H-10}" text-anchor="middle" fill="#64748b" font-size="11">${new Date(t).toLocaleDateString()}</text>`).join('');

  const pathBal = xs.map((p,i)=> `${i?'L':'M'}${xmap(p.x).toFixed(1)},${ymap(p.bal).toFixed(1)}`).join(' ');
  const pathEq  = xs.filter(p=>isFinite(p.eq)).map((p,i)=> `${i?'L':'M'}${xmap(p.x).toFixed(1)},${ymap(p.eq).toFixed(1)}`).join(' ');

  const tipId='tip-'+Math.random().toString(36).slice(2);
  const handlers = xs.map(p=>{
    const x=xmap(p.x), y=ymap(p.bal);
    const eqTxt = isFinite(p.eq)? `<br>Equity: $${toMoney(p.eq)}` : '';
    return `<rect x="${(x-8).toFixed(1)}" y="${P}" width="${16}" height="${H-2*P}" fill="transparent"
      onmousemove="const T=document.getElementById('${tipId}');T.style.display='block';T.style.left='${x}px';T.style.top='${y}px';
                   T.innerHTML='${new Date(p.x).toLocaleString()}<br>Balance: $${toMoney(p.bal)}${eqTxt}';"
      onmouseout="document.getElementById('${tipId}').style.display='none';"></rect>`;
  }).join('');

  return `
    <div style="position:relative;width:100%;height:${H}px">
      <svg width="${W}" height="${H}">
        <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
        ${gridX}
        ${pathEq ? `<path d="${pathEq}" fill="none" stroke="var(--eq)" stroke-width="2"/>` : ''}
        <path d="${pathBal}" fill="none" stroke="var(--bal)" stroke-width="2"/>
        ${labelsX}
        ${handlers}
        <text x="${P-6}" y="${H-P+4}" text-anchor="end" class="dd-axis">$${toMoney(minY)}</text>
        <text x="${P-6}" y="${P+4}"   text-anchor="end" class="dd-axis">$${toMoney(maxY)}</text>
      </svg>
      <div id="${tipId}" class="tip" style="display:none;position:absolute;"></div>
    </div>
  `;
}

// ===================== رسم الـ Drawdown اليومي ===================== //
function drawdownSVG(points){
  if(!points.length) return '';
  const by = groupByDay(points);
  const keys = Object.keys(by).sort();
  const days = keys.map(k=>({ day:k, arr:by[k]}));
  const dd = days.map(d=>{
    const bal = d.arr.map(p=>safe(p.balance));
    const mx  = Math.max(...bal);
    const mn  = Math.min(...bal);
    const ddPct = mx>0 ? ( (mn-mx)/mx )*100 : 0; // قيمة سالبة تحت الصفر
    return { day:d.day, dd: ddPct };
  });

  const W = ddChart.clientWidth || 760, H=120, P=36;
  const minY = Math.min(0, ...dd.map(x=>x.dd));
  const xmap = i => P + (i/Math.max(1,dd.length-1))*(W-2*P);
  const ymap = v => H - P - ((v-minY)/(0-minY || 1))*(H-2*P);

  const bars = dd.map((d,i)=>{
    const x=xmap(i)-10, y=ymap(d.dd), h=ymap(0)-y;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="20" height="${Math.max(0,h).toFixed(1)}" class="dd-bar">
              <title>${d.day} — ${toMoney(d.dd)}%</title>
            </rect>`;
  }).join('');

  const labelsX = dd.map((d,i)=> `<text x="${xmap(i).toFixed(1)}" y="${H-10}" text-anchor="middle" class="dd-axis">${d.day.slice(5)}</text>`).join('');

  return `
    <svg width="${W}" height="${H}">
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>
      <line x1="${P}" y1="${ymap(0)}" x2="${W-P}" y2="${ymap(0)}" stroke="#e5e7eb"/>
      ${bars}
      ${labelsX}
      <text x="${P-6}" y="${ymap(minY)-4}" text-anchor="end" class="dd-axis">${toMoney(minY)}%</text>
    </svg>
  `;
}

// ===================== CSV ===================== //
function downloadCSV(){
  const rows = [["Alias","Account ID","Initial","Balance","Profit","Today","Last Updated"]];
  Object.values(accounts).forEach(acc=>{
    const history = Array.isArray(acc.history)? acc.history : [];
    const last = history[history.length-1] || {balance:0,timestamp:Date.now()};
    const initial = isFinite(acc.initial_balance)? Number(acc.initial_balance)
                   : (history[0]?.balance ?? 0);
    const profit = last.balance - initial;
    rows.push([
      acc.alias||"", acc.account_id, toMoney(initial), toMoney(last.balance),
      toMoney(profit), toMoney(acc.today||0), new Date(last.timestamp).toLocaleString()
    ]);
  });
  const csv = rows.map(r=>r.join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='accounts_report.csv'; a.click(); URL.revokeObjectURL(url);
}

// ===================== أحداث وتشغيل ===================== //
searchInput?.addEventListener('input',  ()=> renderDashboard(getFilteredData()));
sortFilter ?.addEventListener('change', ()=> renderDashboard(getFilteredData()));
downloadBtn?.addEventListener('click',  downloadCSV);

fetchAccounts();
setInterval(fetchAccounts, 5000);
