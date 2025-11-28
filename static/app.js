const elements = {
  form: document.getElementById("patientForm"),
  processBtn: document.getElementById("processBtn"),
  resetBtn: document.getElementById("resetBtn"),
  demoBtn: document.getElementById("demoBtn"),
  demoCount: document.getElementById("demoCount"),
  queueBody: document.getElementById("queueTableBody"),
  arrayView: document.getElementById("arrayView"),
  treeView: document.getElementById("treeView"),
  stepsList: document.getElementById("stepsList"),
  logPanel: document.getElementById("logPanel"),
  statsPanel: document.getElementById("statsPanel"),
  legend: document.getElementById("severityLegend"),
  filterInput: document.getElementById("filterInput"),
  severityFilter: document.getElementById("severityFilter"),
  modal: document.getElementById("patientModal"),
  modalDetails: document.getElementById("modalDetails"),
  toast: document.getElementById("toast"),
  clearLogBtn: document.getElementById("clearLogBtn"),
  overviewSummary: document.getElementById("overviewSummary"),
};

const tabButtons = document.querySelectorAll("[data-tab]");
const tabSections = document.querySelectorAll(".tab-section");

let state = {
  queue: [],
  heapArray: [],
  stats: { total: 0, buckets: {} },
  logs: [],
  steps: [],
  severityMapping: [],
};

let stepTimers = [];
let latestStatsPayload = null;
const renderChartsIfVisible = () => {
  if (typeof window.updateStatisticsCharts !== "function") return;
  const statsSection = document.getElementById("tab-stats");
  if (!statsSection || statsSection.classList.contains("hidden")) return;
  if (latestStatsPayload) {
    window.updateStatisticsCharts(latestStatsPayload);
  }
};

const pushStatsToCharts = () => {
  const buckets = state.stats.buckets || {};
  latestStatsPayload = {
    critical: buckets["Nguy kịch"] || 0,
    high: buckets["Nguy hiểm cao"] || 0,
    medium: buckets["Trung bình"] || 0,
    light: buckets["Nhẹ"] || 0,
    veryLight: buckets["Rất nhẹ"] || 0,
    total: state.stats.total || 0,
  };
  renderChartsIfVisible();
};

const severityBadge = (label) => {
  switch (label) {
    case "Nguy kịch":
    case "Nguy hiểm cao":
      return "badge badge-high";
    case "Trung bình":
      return "badge badge-mid";
    default:
      return "badge badge-low";
  }
};

const severityClassByLevel = (severity) => {
  if (severity >= 7) return "badge badge-high";
  if (severity >= 5) return "badge badge-mid";
  return "badge badge-low";
};

const showToast = (message) => {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  setTimeout(() => elements.toast.classList.remove("show"), 2500);
};

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Đã có lỗi xảy ra.");
  }
  return data;
};

const updateState = (snapshot) => {
  state = {
    ...state,
    ...snapshot,
  };
  renderLegend();
  renderStats();
  renderQueue();
  renderArray();
  renderTree();
  renderLogs();
  renderSteps();
  runStepAnimation();
};

const fetchDashboard = async () => {
  try {
    const data = await request("/api/dashboard", { method: "GET" });
    updateState(data);
  } catch (error) {
    showToast(error.message);
  }
};

const renderLegend = () => {
  if (!elements.legend) return;
  elements.legend.innerHTML = "";
  state.severityMapping.forEach((item) => {
    const div = document.createElement("div");
    div.className = "legend-item";
    div.innerHTML = `<strong>${item.range}</strong><br>${item.label}`;
    elements.legend.appendChild(div);
  });
};

const renderStats = () => {
  elements.statsPanel.innerHTML = "";
  const totalCard = document.createElement("div");
  totalCard.className = "stat-card";
  totalCard.innerHTML = `<h3>${state.stats.total}</h3><span>Tổng bệnh nhân</span>`;
  elements.statsPanel.appendChild(totalCard);

  Object.entries(state.stats.buckets || {}).forEach(([label, value]) => {
    const card = document.createElement("div");
    card.className = "stat-card";
    card.innerHTML = `<h3>${value}</h3><span>${label}</span>`;
    elements.statsPanel.appendChild(card);
  });

  if (elements.overviewSummary) {
    const buckets = state.stats.buckets || {};
    const sortedBuckets = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
    const mostCommon = sortedBuckets[0];
    const critical = buckets["Nguy kịch"] || 0;
    elements.overviewSummary.innerHTML = `
      <div class="summary-card">
        <p>Tổng bệnh nhân</p>
        <strong>${state.stats.total}</strong>
      </div>
      <div class="summary-card">
        <p>Nhóm phổ biến</p>
        <strong>${mostCommon ? mostCommon[0] : "Chưa có"}</strong>
      </div>
      <div class="summary-card">
        <p>Ca nguy kịch (Lv 10)</p>
        <strong>${critical}</strong>
      </div>
    `;
  }
  pushStatsToCharts();
};

const filteredQueue = () => {
  const keyword = elements.filterInput.value.trim().toLowerCase();
  const severityLabel = elements.severityFilter.value;
  return state.queue.filter((patient) => {
    const matchesText =
      patient.code.toLowerCase().includes(keyword) ||
      patient.name.toLowerCase().includes(keyword);
    const matchesSeverity =
      severityLabel === "all" || patient.label === severityLabel;
    return matchesText && matchesSeverity;
  });
};

const renderQueue = () => {
  const rows = filteredQueue();
  elements.queueBody.innerHTML = "";
  if (!rows.length) {
    const row = document.createElement("tr");
    row.innerHTML =
      '<td colspan="6" style="text-align:center; color:#94a3b8;">Chưa có bệnh nhân.</td>';
    elements.queueBody.appendChild(row);
    return;
  }

  rows.forEach((patient) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${patient.code}</td>
      <td>${patient.name}</td>
      <td>${patient.admittedAtDisplay || patient.admittedAt}</td>
      <td><span class="badge ${severityClassByLevel(patient.severity)}">Lv ${patient.severity}</span></td>
      <td>${patient.label}</td>
      <td>
        <div class="table-actions">
          <button data-action="view" data-code="${patient.code}" class="outline">Xem</button>
          <button data-action="remove" data-code="${patient.code}" class="outline">Xoá</button>
        </div>
      </td>
    `;
    elements.queueBody.appendChild(tr);
  });
};

const renderArray = () => {
  elements.arrayView.innerHTML = "";
  if (!state.heapArray.length) {
    elements.arrayView.innerHTML = "<p>Heap đang trống.</p>";
    return;
  }
  state.heapArray.forEach((node, index) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = `[${index}] ${node.code} (Lv ${node.severity})`;
    elements.arrayView.appendChild(chip);
  });
};

const renderTree = () => {
  elements.treeView.innerHTML = "";
  if (!state.heapArray.length) {
    elements.treeView.innerHTML = "<p>Chưa có dữ liệu Heap.</p>";
    return;
  }
  let index = 0;
  let levelSize = 1;
  while (index < state.heapArray.length) {
    const level = document.createElement("div");
    level.className = "tree-level";
    const chunk = state.heapArray.slice(index, index + levelSize);
    chunk.forEach((node) => {
      const div = document.createElement("div");
      div.className = "heap-node";
      div.dataset.index = node.index;
      div.innerHTML = `
        <strong>${node.code}</strong>
        <div>${node.name}</div>
        <span class="${severityClassByLevel(node.severity)}">Lv ${node.severity}</span>
      `;
      level.appendChild(div);
    });
    elements.treeView.appendChild(level);
    index += levelSize;
    levelSize *= 2;
  }
};

const renderSteps = () => {
  elements.stepsList.innerHTML = "";
  if (!state.steps.length) {
    elements.stepsList.innerHTML =
      '<li class="step-item">Thực hiện thao tác để xem chi tiết từng bước.</li>';
    return;
  }

  state.steps.forEach((step, idx) => {
    const li = document.createElement("li");
    li.className = "step-item";
    li.dataset.stepIndex = idx;
    li.innerHTML = `<strong>${step.title}</strong><p>${step.description}</p>`;
    elements.stepsList.appendChild(li);
  });
};

const highlightNodes = (indices, className) => {
  document
    .querySelectorAll(`.${className}`)
    .forEach((node) => node.classList.remove(className));
  indices.forEach((idx) => {
    const nodeEl = elements.treeView.querySelector(`[data-index="${idx}"]`);
    if (nodeEl) {
      nodeEl.classList.add(className);
    }
  });
};

const clearStepTimers = () => {
  stepTimers.forEach((timer) => clearTimeout(timer));
  stepTimers = [];
  highlightNodes([], "node-focus");
  highlightNodes([], "node-swap");
  document
    .querySelectorAll(".step-item")
    .forEach((el) => el.classList.remove("active"));
};

const runStepAnimation = () => {
  clearStepTimers();
  if (!state.steps.length) return;

  state.steps.forEach((step, idx) => {
    const timer = setTimeout(() => {
      const stepItems = elements.stepsList.querySelectorAll(".step-item");
      stepItems.forEach((item) => item.classList.remove("active"));
      const current = stepItems[idx];
      if (current) current.classList.add("active");

      if (step.focus) {
        highlightNodes(step.focus, "node-focus");
      }
      if (step.swap) {
        highlightNodes(step.swap, "node-swap");
      }
    }, idx * 1000);
    stepTimers.push(timer);
  });
};

const renderLogs = () => {
  elements.logPanel.innerHTML = "";
  if (!state.logs.length) {
    elements.logPanel.innerHTML = "<li>Chưa có log.</li>";
    return;
  }
  state.logs.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "log-item";
    li.innerHTML = `<span>${entry.message}</span><strong>${entry.time}</strong>`;
    elements.logPanel.appendChild(li);
  });
};

const openModal = (patient) => {
  elements.modalDetails.innerHTML = `
    <dt>Mã bệnh nhân</dt><dd>${patient.code}</dd>
    <dt>Họ tên</dt><dd>${patient.name}</dd>
    <dt>Thời điểm nhập viện</dt><dd>${patient.admittedAtDisplay || patient.admittedAt}</dd>
    <dt>Mức độ</dt><dd>Level ${patient.severity} - ${patient.label}</dd>
  `;
  elements.modal.classList.add("show");
};

const closeModal = () => elements.modal.classList.remove("show");

const handleFormSubmit = async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.form);
  const payload = Object.fromEntries(formData.entries());

  if (!payload.admittedAt) {
    showToast("Vui lòng chọn thời điểm nhập viện.");
    return;
  }

  payload.admittedAt = new Date(payload.admittedAt).toISOString();
  payload.severity = Number(payload.severity);

  if (Number.isNaN(payload.severity) || payload.severity < 1 || payload.severity > 10) {
    showToast("Mức độ nguy kịch phải nằm trong 1-10.");
    return;
  }

  try {
    const data = await request("/api/patients", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    elements.form.reset();
    showToast(data.message);
    updateState(data.state);
  } catch (error) {
    showToast(error.message);
  }
};

const handleProcess = async () => {
  try {
    const data = await request("/api/patients/process", { method: "POST" });
    showToast(data.message);
    updateState(data.state);
  } catch (error) {
    showToast(error.message);
  }
};

const handleQueueClick = async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const code = button.dataset.code;
  if (button.dataset.action === "view") {
    try {
      const data = await request(`/api/patients/${code}`, { method: "GET" });
      openModal(data.patient);
    } catch (error) {
      showToast(error.message);
    }
  } else if (button.dataset.action === "remove") {
    try {
      const data = await request(`/api/patients/${code}`, { method: "DELETE" });
      showToast(data.message);
      updateState(data.state);
    } catch (error) {
      showToast(error.message);
    }
  }
};

const handleDemo = async () => {
  const count = Number(elements.demoCount.value);
  try {
    const data = await request("/api/patients/demo", {
      method: "POST",
      body: JSON.stringify({ count }),
    });
    showToast(data.message);
    updateState(data.state);
  } catch (error) {
    showToast(error.message);
  }
};

const handleReset = async () => {
  try {
    const data = await request("/api/patients/reset", { method: "POST" });
    showToast(data.message);
    updateState(data.state);
  } catch (error) {
    showToast(error.message);
  }
};

const handleClearLog = async () => {
  try {
    const data = await request("/api/logs/clear", { method: "POST" });
    showToast(data.message);
    updateState(data.state);
  } catch (error) {
    showToast(error.message);
  }
};

elements.form.addEventListener("submit", handleFormSubmit);
elements.processBtn.addEventListener("click", handleProcess);
elements.queueBody.addEventListener("click", handleQueueClick);
elements.demoBtn.addEventListener("click", handleDemo);
elements.resetBtn.addEventListener("click", handleReset);
elements.clearLogBtn.addEventListener("click", handleClearLog);
elements.filterInput.addEventListener("input", renderQueue);
elements.severityFilter.addEventListener("change", renderQueue);
elements.modal.addEventListener("click", (event) => {
  if (event.target === elements.modal || event.target.dataset.close !== undefined) {
    closeModal();
  }
});

const activateTab = (targetId) => {
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === targetId);
  });
  tabSections.forEach((section) => {
    section.classList.toggle("hidden", section.id !== targetId);
  });
  if (targetId === "tab-stats") {
    renderChartsIfVisible();
  }
};

const initTabs = () => {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });
  activateTab("tab-overview");
};

window.addEventListener("load", () => {
  initTabs();
  fetchDashboard();
});
