function loadCSV() {
  fetch("data.csv")
    .then(response => response.text())
    .then(text => {
      const lines = text.trim().split("\n");
      const headers = lines[0].split(",");
      const data = lines.slice(1).map(line => {
        const cols = line.split(",");
        const row = {};
        headers.forEach((h, i) => {
          row[h] = cols[i];
        });
        return row;
      });

      const tbody = document.querySelector("#dataTable tbody");
      tbody.innerHTML = "";
      for (const row of data) {
        const tr = document.createElement("tr");
        headers.forEach(h => {
          const td = document.createElement("td");
          td.textContent = row[h];
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }

      $('#dataTable').DataTable();
    })
    .catch(err => {
      console.error("⚠️ Failed to load CSV:", err);
    });
}

loadCSV();
