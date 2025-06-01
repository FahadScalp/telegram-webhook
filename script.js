function loadCSV() {
  $.get('data.csv', function (data) {
    const rows = data.trim().split('\n');
    const headers = rows.shift().split(',');
    const table = $('#dataTable').DataTable();
    const accountsSet = new Set();

    table.clear();

    const lastByAccount = {};
    rows.forEach(row => {
      const parts = row.split(',');
      if (parts.length !== 5) return;

      const [time, name, account, balanceStr, profitStr] = parts;
      const balance = parseFloat(balanceStr);
      const profit = parseFloat(profitStr);
      const netProfit = +(balance - (balance - profit)).toFixed(2);

      if (!lastByAccount[account] || new Date(time) > new Date(lastByAccount[account].time)) {
        lastByAccount[account] = { time, name, account, balance, profit, netProfit };
      }
    });

    let totalProfit = 0;
    Object.values(lastByAccount).forEach(entry => {
      const { time, name, account, balance, profit, netProfit } = entry;
      totalProfit += netProfit;
      const rowClass = netProfit < 0 ? 'loss' : 'profit';

      table.row.add([
        time,
        name,
        account,
        balance.toFixed(2),
        profit.toFixed(2),
        `<span class="${rowClass}">${netProfit.toFixed(2)}</span>`
      ]);

      accountsSet.add(account);
    });

    $('#grandTotal').text(totalProfit.toFixed(2));
    table.draw();

    // Populate account filter dropdown
    const accountFilter = $('#accountFilter');
    accountFilter.empty().append(`<option value="">عرض الكل</option>`);
    [...accountsSet].sort().forEach(account => {
      accountFilter.append(`<option value="${account}">${account}</option>`);
    });
  }).fail(function (err) {
    console.error('⚠️ Failed to load CSV:', err);
  });
}

$(document).ready(function () {
  const table = $('#dataTable').DataTable();

  $('#accountFilter').on('change', function () {
    const val = $(this).val();
    table.column(2).search(val).draw();
  });

  loadCSV();
  setInterval(loadCSV, 10000);
});
