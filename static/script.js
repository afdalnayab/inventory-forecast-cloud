let chart = null;

function animateNumber(el, target) {
  const start = 0;
  const duration = 600;
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function getStatus(stock_qty, reorder_level) {
  if (stock_qty <= reorder_level * 0.5) return { label: "Critical", cls: "status-critical" };
  if (stock_qty <= reorder_level) return { label: "Low stock", cls: "status-low" };
  return { label: "Healthy", cls: "status-healthy" };
}

const editIcon = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 20H21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 3.5C17.33 2.67 18.67 2.67 19.5 3.5C20.33 4.33 20.33 5.67 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const deleteIcon = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 7H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 7L7 20H17L18 7" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 11V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 11V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 7L9.5 4H14.5L15 7" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

async function loadProducts() {
  const res = await fetch("/api/products");
  const products = await res.json();
  const tbody = document.getElementById("productTable");
  tbody.innerHTML = "";

  let lowCount = 0;
  let totalStock = 0;

  products.forEach(p => {
    const status = getStatus(p.stock_qty, p.reorder_level);
    if (status.cls !== "status-healthy") lowCount++;
    totalStock += p.stock_qty;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="product-name">${p.name}</td>
      <td>${p.category || "—"}</td>
      <td>${p.stock_qty}</td>
      <td><span class="status-pill-cell ${status.cls}">${status.label}</span></td>
      <td class="row-actions">
        <button class="icon-btn" title="Edit" onclick="editProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}', '${(p.category || "").replace(/'/g, "\\'")}', ${p.stock_qty}, ${p.reorder_level})">${editIcon}</button>
        <button class="icon-btn delete" title="Delete" onclick="deleteProduct(${p.id})">${deleteIcon}</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  animateNumber(document.getElementById("kpiProducts"), products.length);
  animateNumber(document.getElementById("kpiStock"), totalStock);
  animateNumber(document.getElementById("kpiLowStock"), lowCount);
}

function editProduct(id, name, category, stock_qty, reorder_level) {
  document.getElementById("productId").value = id;
  document.getElementById("name").value = name;
  document.getElementById("category").value = category;
  document.getElementById("stock_qty").value = stock_qty;
  document.getElementById("reorder_level").value = reorder_level;
  document.getElementById("productForm").classList.remove("form-collapsed");
}

async function deleteProduct(id) {
  if (!confirm("Delete this product?")) return;
  await fetch(`/api/products/${id}`, { method: "DELETE" });
  loadProducts();
}

document.getElementById("toggleFormBtn").addEventListener("click", () => {
  document.getElementById("productForm").classList.toggle("form-collapsed");
});

document.getElementById("productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("productId").value;
  const payload = {
    name: document.getElementById("name").value,
    category: document.getElementById("category").value,
    stock_qty: document.getElementById("stock_qty").value,
    reorder_level: document.getElementById("reorder_level").value,
  };

  if (id) {
    await fetch(`/api/products/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } else {
    await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  }
  document.getElementById("productForm").reset();
  document.getElementById("productId").value = "";
  document.getElementById("productForm").classList.add("form-collapsed");
  loadProducts();
});

document.getElementById("resetForm").addEventListener("click", () => {
  document.getElementById("productForm").reset();
  document.getElementById("productId").value = "";
  document.getElementById("productForm").classList.add("form-collapsed");
});

async function loadForecastDropdown() {
  const res = await fetch("/api/products/list-names");
  const names = await res.json();
  document.getElementById("forecastProduct").innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join("");
}

document.getElementById("runForecast").addEventListener("click", async () => {
  const product = document.getElementById("forecastProduct").value;
  const days = document.getElementById("forecastDays").value;
  const res = await fetch(`/api/forecast/${product}?days=${days}`);
  const data = await res.json();

  if (data.error) {
    document.getElementById("forecastSummary").textContent = data.error;
    return;
  }

  document.getElementById("forecastSummary").textContent =
    `Predicted total demand for ${product} over the next ${days} day(s): ${data.total_predicted_demand} units`;
  document.getElementById("kpiForecast").textContent = data.total_predicted_demand;

  const labels = data.forecast.map(f => f.date.slice(5));
  const values = data.forecast.map(f => f.predicted_demand);

  const ctx = document.getElementById("forecastChart").getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, "rgba(124, 111, 240, 0.35)");
  gradient.addColorStop(1, "rgba(124, 111, 240, 0.02)");

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: `${product} demand`,
        data: values,
        borderColor: "#7c6ff0",
        backgroundColor: gradient,
        pointBackgroundColor: "#7c6ff0",
        pointBorderColor: "#0a0d13",
        pointBorderWidth: 2,
        pointRadius: 4,
        tension: 0.35,
        fill: true,
        borderWidth: 2.5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#161b26",
          borderColor: "#232a37",
          borderWidth: 1,
          titleColor: "#eef1f6",
          bodyColor: "#8b93a3",
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
        },
      },
      scales: {
        x: { ticks: { color: "#565f6f", font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { color: "#565f6f", font: { size: 11 } }, grid: { color: "#1a202c" }, beginAtZero: true },
      },
    },
  });
});

loadProducts();
loadForecastDropdown();