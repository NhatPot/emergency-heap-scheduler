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
  stepsContainer: document.getElementById("heap-steps-container"),
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
  // Animation controls
  animPlayBtn: document.getElementById("animPlayBtn"),
  animPauseBtn: document.getElementById("animPauseBtn"),
  animStepForwardBtn: document.getElementById("animStepForwardBtn"),
  animStepBackBtn: document.getElementById("animStepBackBtn"),
  animResetBtn: document.getElementById("animResetBtn"),
  animSpeedSlider: document.getElementById("animSpeedSlider"),
  animSpeedValue: document.getElementById("animSpeedValue"),
  animProgress: document.getElementById("animProgress"),
  heapDemoBtn: document.getElementById("heapDemoBtn"),
  heapDemoCount: document.getElementById("heapDemoCount"),
  heapDemoSeverity: document.getElementById("heapDemoSeverity"),
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
  renderHeapLegend();
  renderStats();
  renderQueue();
  renderArray();
  renderTree();
  renderLogs();
  renderSteps();
  runStepAnimation();
  
  // Initialize animation nếu đang ở tab heap
  try {
    const heapTab = document.getElementById("tab-heap");
    if (heapTab && !heapTab.classList.contains("hidden")) {
      setTimeout(() => {
        initAnimation();
      }, 100);
    }
  } catch (error) {
    // Ignore errors if animation not initialized yet
  }
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

// Tính số level từ kích thước mảng
const calculateLevels = (size) => {
  if (size === 0) return 0;
  return Math.floor(Math.log2(size)) + 1;
};

// Lấy label severity
const getSeverityLabel = (severity) => {
  if (severity >= 10) return "Nguy kịch";
  if (severity >= 7) return "Nguy hiểm cao";
  if (severity >= 5) return "Trung bình";
  if (severity >= 3) return "Nhẹ";
  return "Rất nhẹ";
};

// Render legend cho severity
const renderHeapLegend = () => {
  const legendEl = document.getElementById("heapLegend");
  if (!legendEl) return;
  legendEl.innerHTML = "";
  const labels = [
    { range: "10", label: "Nguy kịch", class: "legend-critical" },
    { range: "7-9", label: "Nguy hiểm cao", class: "legend-high" },
    { range: "5-6", label: "Trung bình", class: "legend-medium" },
    { range: "3-4", label: "Nhẹ", class: "legend-light" },
    { range: "1-2", label: "Rất nhẹ", class: "legend-very-light" },
  ];
  labels.forEach((item) => {
    const div = document.createElement("div");
    div.className = `legend-badge ${item.class}`;
    div.innerHTML = `<span class="legend-color"></span><span>${item.label}</span>`;
    legendEl.appendChild(div);
  });
};

const renderArray = () => {
  elements.arrayView.innerHTML = "";
  if (!state.heapArray.length) {
    elements.arrayView.innerHTML = "<p>Heap đang trống.</p>";
    return;
  }
  state.heapArray.forEach((node, index) => {
    const item = document.createElement("div");
    item.className = "heap-array-item";
    item.dataset.index = index;
    item.innerHTML = `<span class="array-index">[${index}]</span> <strong>${node.code}</strong> <span class="${severityClassByLevel(node.severity)}">Lv ${node.severity}</span>`;
    
    // Highlight đồng bộ khi hover/click
    item.addEventListener("mouseenter", () => highlightSync(index, "hover"));
    item.addEventListener("mouseleave", () => clearHighlightSync());
    item.addEventListener("click", () => highlightSync(index, "click"));
    
    elements.arrayView.appendChild(item);
  });
};

// Render cây Heap với đường nối cha-con
const renderTree = () => {
  elements.treeView.innerHTML = "";
  if (!state.heapArray.length) {
    elements.treeView.innerHTML = "<p>Chưa có dữ liệu Heap.</p>";
    return;
  }

  const levels = calculateLevels(state.heapArray.length);
  const treeContainer = document.createElement("div");
  treeContainer.className = "heap-tree-wrapper";

  // Tạo SVG để vẽ đường nối
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.className = "heap-connectors";
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";
  svg.style.pointerEvents = "none";
  treeContainer.appendChild(svg);

  // Tạo các level
  for (let level = 0; level < levels; level++) {
    const levelDiv = document.createElement("div");
    levelDiv.className = "heap-level";
    const startIdx = Math.pow(2, level) - 1;
    const endIdx = Math.min(Math.pow(2, level + 1) - 1, state.heapArray.length);
    const nodesInLevel = endIdx - startIdx;

    // Grid columns = số node trong level này
    levelDiv.style.gridTemplateColumns = `repeat(${nodesInLevel}, 1fr)`;

    for (let i = startIdx; i < endIdx; i++) {
      const node = state.heapArray[i];
      const nodeDiv = document.createElement("div");
      nodeDiv.className = "heap-node";
      nodeDiv.dataset.index = i;
      nodeDiv.dataset.level = level;
      
      const label = getSeverityLabel(node.severity);
      const badgeClass = severityClassByLevel(node.severity);
      
      nodeDiv.innerHTML = `
        <div class="node-index">${i}</div>
        <div class="node-content">
          <strong class="node-code">${node.code}</strong>
          <div class="node-name">${node.name.length > 15 ? node.name.substring(0, 15) + "..." : node.name}</div>
          <span class="badge ${badgeClass}">Lv ${node.severity}</span>
        </div>
      `;

      // Highlight đồng bộ khi hover/click
      nodeDiv.addEventListener("mouseenter", () => highlightSync(i, "hover"));
      nodeDiv.addEventListener("mouseleave", () => clearHighlightSync());
      nodeDiv.addEventListener("click", () => highlightSync(i, "click"));

      levelDiv.appendChild(nodeDiv);
    }
    treeContainer.appendChild(levelDiv);
  }

  elements.treeView.appendChild(treeContainer);

  // Vẽ đường nối sau khi DOM đã render
  setTimeout(() => {
    drawConnectors(svg, state.heapArray.length);
  }, 100);
};

// Debounce resize để vẽ lại connectors
let resizeTimer = null;
if (!window.heapResizeHandler) {
  window.heapResizeHandler = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const svg = elements.treeView?.querySelector(".heap-connectors");
      if (svg && state.heapArray.length > 0) {
        drawConnectors(svg, state.heapArray.length);
      }
    }, 250);
  };
  window.addEventListener("resize", window.heapResizeHandler);
}

// Vẽ đường nối cha-con
const drawConnectors = (svg, size) => {
  svg.innerHTML = ""; // Clear previous connectors
  
  for (let i = 1; i < size; i++) {
    const parentIdx = Math.floor((i - 1) / 2);
    const parentEl = elements.treeView.querySelector(`[data-index="${parentIdx}"]`);
    const childEl = elements.treeView.querySelector(`[data-index="${i}"]`);
    
    if (!parentEl || !childEl) continue;

    const parentRect = parentEl.getBoundingClientRect();
    const childRect = childEl.getBoundingClientRect();
    const containerRect = elements.treeView.getBoundingClientRect();

    const parentX = parentRect.left + parentRect.width / 2 - containerRect.left;
    const parentY = parentRect.top + parentRect.height - containerRect.top;
    const childX = childRect.left + childRect.width / 2 - containerRect.left;
    const childY = childRect.top - containerRect.top;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", parentX);
    line.setAttribute("y1", parentY);
    line.setAttribute("x2", childX);
    line.setAttribute("y2", childY);
    line.setAttribute("stroke", "rgba(59, 130, 246, 0.4)");
    line.setAttribute("stroke-width", "2");
    svg.appendChild(line);
  }
};

// Highlight đồng bộ giữa cây và mảng
const highlightSync = (index, type) => {
  // Highlight trên cây
  const treeNode = elements.treeView.querySelector(`[data-index="${index}"]`);
  if (treeNode) {
    treeNode.classList.add("highlight");
  }
  
  // Highlight trên mảng
  const arrayItem = elements.arrayView.querySelector(`[data-index="${index}"]`);
  if (arrayItem) {
    arrayItem.classList.add("highlight");
  }
};

const clearHighlightSync = () => {
  elements.treeView.querySelectorAll(".highlight").forEach((el) => el.classList.remove("highlight"));
  elements.arrayView.querySelectorAll(".highlight").forEach((el) => el.classList.remove("highlight"));
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
    li.style.cursor = "pointer";
    elements.stepsList.appendChild(li);
  });
  
  // Event delegation cho steps
  elements.stepsList.addEventListener("click", (e) => {
    const stepItem = e.target.closest(".step-item");
    if (stepItem && stepItem.dataset.stepIndex !== undefined) {
      const idx = parseInt(stepItem.dataset.stepIndex, 10);
      handleStepClick(idx);
    }
  });
};

const highlightNodes = (indices, className) => {
  // Clear previous highlights
  document
    .querySelectorAll(`.${className}`)
    .forEach((node) => node.classList.remove(className));
  
  // Highlight trên cây
  indices.forEach((idx) => {
    const treeNode = elements.treeView.querySelector(`[data-index="${idx}"]`);
    if (treeNode) {
      treeNode.classList.add(className);
    }
    
    // Highlight trên mảng
    const arrayItem = elements.arrayView.querySelector(`[data-index="${idx}"]`);
    if (arrayItem) {
      arrayItem.classList.add(className);
    }
  });
};

// Helper để highlight các bước thuật toán
const highlightHeapOperation = ({ type, indexA, indexB }) => {
  clearHighlightSync();
  
  if (type === "compare" && indexA !== undefined && indexB !== undefined) {
    highlightNodes([indexA, indexB], "op-compare");
  } else if (type === "swap" && indexA !== undefined && indexB !== undefined) {
    highlightNodes([indexA, indexB], "op-swap");
  } else if (type === "insert" && indexA !== undefined) {
    highlightNodes([indexA], "op-insert");
  } else if (type === "remove" && indexA !== undefined) {
    highlightNodes([indexA], "op-remove");
  }
};

const clearStepTimers = () => {
  stepTimers.forEach((timer) => clearTimeout(timer));
  stepTimers = [];
  highlightNodes([], "node-focus");
  highlightNodes([], "node-swap");
  document
    .querySelectorAll(".op-compare, .op-swap, .op-insert, .op-remove")
    .forEach((el) => {
      el.classList.remove("op-compare", "op-swap", "op-insert", "op-remove");
    });
  document
    .querySelectorAll(".step-item")
    .forEach((el) => el.classList.remove("active", "step-active", "animating"));
};

const handleStepClick = (idx) => {
  // Pause animation khi click vào step
  pauseAnimation();
  
  // Tìm frame tương ứng với step index
  // Frame index = step index + 1 (vì frame 0 là initial state)
  const frameIndex = idx + 1;
  
  if (animationFrames && animationFrames.length > frameIndex) {
    // Render frame tương ứng
    renderFrame(frameIndex);
  } else {
    // Nếu chưa có animation frames, chỉ highlight step
    const step = state.steps[idx];
    if (!step) return;
    
    // Clear previous highlights
    clearHighlightSync();
    document.querySelectorAll(".step-item").forEach((item) => {
      item.classList.remove("active", "step-active", "animating");
    });
    
    // Highlight step
    const stepItems = elements.stepsList.querySelectorAll(".step-item");
    if (stepItems[idx]) {
      stepItems[idx].classList.add("active", "step-active");
    }
    
    // Highlight dựa trên focus và swap
    if (step.focus && step.focus.length >= 2) {
      highlightHeapOperation({ type: "compare", indexA: step.focus[0], indexB: step.focus[1] });
    } else if (step.focus && step.focus.length === 1) {
      highlightNodes(step.focus, "node-focus");
    }
    
    if (step.swap && step.swap.length === 2) {
      highlightHeapOperation({ type: "swap", indexA: step.swap[0], indexB: step.swap[1] });
    }
  }
};

const runStepAnimation = () => {
  clearStepTimers();
  if (!state.steps.length) return;

  state.steps.forEach((step, idx) => {
    const timer = setTimeout(() => {
      handleStepClick(idx);
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
  
  // Initialize animation nếu vào tab heap, pause nếu rời tab
  try {
    if (targetId === "tab-heap") {
      setTimeout(() => {
        initAnimation();
      }, 100);
    } else {
      pauseAnimation();
    }
  } catch (error) {
    // Ignore errors if animation not initialized yet
  }
};

const initTabs = () => {
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.tab));
  });
  activateTab("tab-overview");
};

// ==================== Animation Controller ====================
let animationFrames = [];
let currentFrameIndex = -1;
let animationInterval = null;
let animationSpeed = 1;
let initialHeapState = [];

// Build snapshots từ steps
const buildAnimationFrames = (steps, currentHeapArray) => {
  try {
    const frames = [];
    
    if (!steps || steps.length === 0) return frames;
    
    // Tìm initial state: nếu step đầu tiên là "Thêm vào mảng", thì initial là array trước khi thêm
    let initialHeap = [];
    const firstStep = steps[0];
    
    if (firstStep && firstStep.array && Array.isArray(firstStep.array)) {
      // Nếu step đầu là "Thêm vào mảng", initial state là array trừ phần tử cuối
      if (firstStep.title && firstStep.title.includes("Thêm vào mảng")) {
        initialHeap = firstStep.array.slice(0, -1).map((item, i) => {
          const existingNode = (state && state.queue) ? state.queue.find(n => n.code === item.code) 
            : ((state && state.heapArray) ? state.heapArray.find(n => n.code === item.code) : null);
          return {
            index: i,
            code: item.code || "",
            name: existingNode?.name || "",
            severity: item.severity || 0,
            label: item.label || getSeverityLabel(item.severity || 0),
          };
        });
      } else {
        // Nếu không phải insert, dùng array của step đầu làm initial
        initialHeap = firstStep.array.map((item, i) => {
          const existingNode = (state && state.queue) ? state.queue.find(n => n.code === item.code) 
            : ((state && state.heapArray) ? state.heapArray.find(n => n.code === item.code) : null);
          return {
            index: i,
            code: item.code || "",
            name: existingNode?.name || "",
            severity: item.severity || 0,
            label: item.label || getSeverityLabel(item.severity || 0),
          };
        });
      }
    }
    
    // Frame đầu tiên: initial state
    frames.push({
      heapArray: initialHeap,
      description: "Trạng thái ban đầu",
      highlight: null,
      stepIndex: -1,
    });
    
    // Build frames từ từng step
    steps.forEach((step, idx) => {
      // Lấy heap state từ step.array
      let heapState = initialHeap;
      if (step && step.array && Array.isArray(step.array) && step.array.length > 0) {
        heapState = step.array.map((item, i) => {
          // Tìm name từ state hiện tại (queue hoặc heapArray)
          const existingNode = (state && state.queue) ? state.queue.find(n => n.code === item.code) 
            : ((state && state.heapArray) ? state.heapArray.find(n => n.code === item.code) : null);
          return {
            index: i,
            code: item.code || "",
            name: existingNode?.name || "",
            severity: item.severity || 0,
            label: item.label || getSeverityLabel(item.severity || 0),
          };
        });
      }
      
      // Xác định highlight type từ step
      let highlight = null;
      if (step.swap && Array.isArray(step.swap) && step.swap.length === 2) {
        highlight = { type: "swap", indexA: step.swap[0], indexB: step.swap[1] };
      } else if (step.focus && Array.isArray(step.focus)) {
        if (step.focus.length >= 2) {
          highlight = { type: "compare", indexA: step.focus[0], indexB: step.focus[1] };
        } else if (step.focus.length === 1) {
          highlight = { type: "focus", indexA: step.focus[0] };
        }
      }
      
      frames.push({
        heapArray: JSON.parse(JSON.stringify(heapState)),
        description: step.title || step.description || `Bước ${idx + 1}`,
        highlight: highlight,
        stepIndex: idx,
      });
    });
    
    return frames;
  } catch (error) {
    console.error("Error building animation frames:", error);
    return [];
  }
};

// Render frame tại index
const renderFrame = (frameIndex) => {
  try {
    if (!animationFrames || animationFrames.length === 0) return;
    
    if (frameIndex < 0 || frameIndex >= animationFrames.length) {
      frameIndex = 0;
    }
    
    const frame = animationFrames[frameIndex];
    if (!frame) return;
    
    currentFrameIndex = frameIndex;
    
    // Render cây và mảng với heap array từ frame
    // Tạm thời override state.heapArray để render
    const originalHeapArray = state.heapArray;
    state.heapArray = frame.heapArray || [];
    
    if (elements.treeView) renderTree();
    if (elements.arrayView) renderArray();
    
    // Vẽ lại connectors sau khi render tree
    setTimeout(() => {
      try {
        const svg = elements.treeView?.querySelector(".heap-connectors");
        if (svg && frame.heapArray && frame.heapArray.length > 0) {
          drawConnectors(svg, frame.heapArray.length);
        }
      } catch (error) {
        console.error("Error drawing connectors:", error);
      }
    }, 50);
    
    // Restore original
    state.heapArray = originalHeapArray;
    
    // Clear previous highlights
    clearHighlightSync();
    document.querySelectorAll(".op-compare, .op-swap, .op-insert, .op-remove, .node-focus, .animating").forEach((el) => {
      el.classList.remove("op-compare", "op-swap", "op-insert", "op-remove", "node-focus", "animating");
    });
    
    // Apply highlight từ frame
    if (frame.highlight) {
      if (frame.highlight.type === "swap") {
        highlightHeapOperation({ type: "swap", indexA: frame.highlight.indexA, indexB: frame.highlight.indexB });
      } else if (frame.highlight.type === "compare") {
        highlightHeapOperation({ type: "compare", indexA: frame.highlight.indexA, indexB: frame.highlight.indexB });
      } else if (frame.highlight.type === "focus") {
        highlightNodes([frame.highlight.indexA], "node-focus");
      }
    }
    
    // Update steps panel - chỉ scroll trong container, không scroll cả trang
    if (elements.stepsList) {
      document.querySelectorAll(".step-item").forEach((item) => {
        item.classList.remove("active", "step-active", "animating");
      });
      
      if (frame.stepIndex >= 0 && state.steps && frame.stepIndex < state.steps.length) {
        const stepItems = elements.stepsList.querySelectorAll(".step-item");
        if (stepItems[frame.stepIndex]) {
          stepItems[frame.stepIndex].classList.add("active", "step-active", "animating");
          
          // Chỉ scroll trong container steps, không scroll cả trang
          setTimeout(() => {
            try {
              const stepsContainer = elements.stepsContainer;
              const activeStepEl = stepItems[frame.stepIndex];
              
              if (stepsContainer && activeStepEl) {
                // Tính toán vị trí scroll để step nằm giữa container
                const containerTop = stepsContainer.scrollTop;
                const containerHeight = stepsContainer.clientHeight;
                const stepTop = activeStepEl.offsetTop;
                const stepHeight = activeStepEl.offsetHeight;
                
                // Scroll để step nằm ở giữa container (hoặc gần đầu nếu ở đầu)
                const targetScroll = stepTop - (containerHeight / 2) + (stepHeight / 2);
                
                stepsContainer.scrollTo({
                  top: Math.max(0, targetScroll),
                  behavior: "smooth"
                });
              }
            } catch (error) {
              // Ignore scroll errors
            }
          }, 50);
        }
      }
    }
    
    // Update progress
    if (elements.animProgress) {
      elements.animProgress.textContent = `Bước ${frameIndex + 1} / ${animationFrames.length}`;
    }
  } catch (error) {
    console.error("Error rendering frame:", error);
  }
};

// Animation controls
const startAnimation = () => {
  if (animationFrames.length === 0) return;
  
  if (currentFrameIndex >= animationFrames.length - 1) {
    currentFrameIndex = -1;
  }
  
  const baseDelay = 1000; // 1 second base
  const delay = baseDelay / animationSpeed;
  
  animationInterval = setInterval(() => {
    currentFrameIndex++;
    if (currentFrameIndex >= animationFrames.length) {
      pauseAnimation();
      return;
    }
    renderFrame(currentFrameIndex);
  }, delay);
  
  // Show pause button, hide play
  if (elements.animPlayBtn) elements.animPlayBtn.style.display = "none";
  if (elements.animPauseBtn) elements.animPauseBtn.style.display = "flex";
};

const pauseAnimation = () => {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
  
  // Show play button, hide pause
  if (elements.animPlayBtn) elements.animPlayBtn.style.display = "flex";
  if (elements.animPauseBtn) elements.animPauseBtn.style.display = "none";
};

const stepForward = () => {
  pauseAnimation();
  if (currentFrameIndex < animationFrames.length - 1) {
    currentFrameIndex++;
    renderFrame(currentFrameIndex);
  }
};

const stepBackward = () => {
  pauseAnimation();
  if (currentFrameIndex > 0) {
    currentFrameIndex--;
    renderFrame(currentFrameIndex);
  }
};

const resetAnimation = () => {
  pauseAnimation();
  currentFrameIndex = 0;
  if (animationFrames.length > 0) {
    renderFrame(0);
  }
};

// Initialize animation từ state hiện tại
const initAnimation = () => {
  try {
    pauseAnimation();
    
    if (!state || !state.steps) return;
    
    if (state.steps.length === 0) {
      animationFrames = [];
      currentFrameIndex = -1;
      if (elements.animProgress) {
        elements.animProgress.textContent = "Bước 0 / 0";
      }
      return;
    }
    
    // Build frames từ steps và current heap array
    let initialHeap = [];
    
    initialHeap = state.heapArray && state.heapArray.length > 0 
      ? JSON.parse(JSON.stringify(state.heapArray))
      : [];
    
    // Build frames
    animationFrames = buildAnimationFrames(state.steps, initialHeap);
    
    // Reset về frame đầu tiên
    if (animationFrames.length > 0) {
      currentFrameIndex = 0;
      renderFrame(0);
    }
  } catch (error) {
    console.error("Error initializing animation:", error);
  }
};

// Handle demo button
const handleHeapDemo = async () => {
  const count = Number(elements.heapDemoCount?.value || 5);
  const severity = elements.heapDemoSeverity?.value || "random";
  
  try {
    pauseAnimation();
    const data = await request("/api/patients/demo", {
      method: "POST",
      body: JSON.stringify({ count, severity }),
    });
    showToast(data.message);
    updateState(data.state);
    
    // Initialize animation sau khi có data mới
    setTimeout(() => {
      initAnimation();
      // Auto play
      startAnimation();
    }, 500);
  } catch (error) {
    showToast(error.message);
  }
};

// Event listeners cho animation controls
if (elements.animPlayBtn) {
  elements.animPlayBtn.addEventListener("click", startAnimation);
}

if (elements.animPauseBtn) {
  elements.animPauseBtn.addEventListener("click", pauseAnimation);
}

if (elements.animStepForwardBtn) {
  elements.animStepForwardBtn.addEventListener("click", stepForward);
}

if (elements.animStepBackBtn) {
  elements.animStepBackBtn.addEventListener("click", stepBackward);
}

if (elements.animResetBtn) {
  elements.animResetBtn.addEventListener("click", resetAnimation);
}

if (elements.animSpeedSlider) {
  elements.animSpeedSlider.addEventListener("input", (e) => {
    animationSpeed = parseFloat(e.target.value);
    if (elements.animSpeedValue) {
      elements.animSpeedValue.textContent = `${animationSpeed}x`;
    }
    // Restart animation với speed mới nếu đang chạy
    if (animationInterval) {
      pauseAnimation();
      startAnimation();
    }
  });
}

if (elements.heapDemoBtn) {
  elements.heapDemoBtn.addEventListener("click", handleHeapDemo);
}

// Update initAnimation khi state thay đổi - override sau khi updateState được định nghĩa
// Sẽ được gọi trong window load event

window.addEventListener("load", () => {
  initTabs();
  fetchDashboard();
});
