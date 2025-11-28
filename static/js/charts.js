(() => {
  const COLORS = ["#FF6384", "#36A2EB", "#4BC0C0", "#FFCD56", "#9966FF"];
  const LABELS = ["Nguy kịch", "Nguy hiểm cao", "Trung bình", "Nhẹ", "Rất nhẹ"];
  let barChart = null;
  let donutChart = null;
  let defaultsConfigured = false;

  const ensureDefaults = () => {
    if (defaultsConfigured || typeof Chart === "undefined") return;
    Chart.defaults.color = "#cfd6e2";
    Chart.defaults.font.family = '"Inter","Segoe UI",system-ui,sans-serif';
    Chart.defaults.borderColor = "rgba(207, 214, 226, 0.15)";
    defaultsConfigured = true;
  };

  const buildDataset = (stats) => [
    stats.critical || 0,
    stats.high || 0,
    stats.medium || 0,
    stats.light || 0,
    stats.veryLight || 0,
  ];

  window.updateStatisticsCharts = (stats = {}) => {
    if (typeof Chart === "undefined") return;
    const barCanvas = document.getElementById("statsBarChart");
    const donutCanvas = document.getElementById("statsDonutChart");
    if (!barCanvas || !donutCanvas) return;

    ensureDefaults();
    const dataPoints = buildDataset(stats);

    if (barChart) barChart.destroy();
    barChart = new Chart(barCanvas, {
      type: "bar",
      data: {
        labels: LABELS,
        datasets: [
          {
            label: "Số bệnh nhân",
            data: dataPoints,
            backgroundColor: COLORS.map((c) => `${c}dd`),
            borderRadius: 8,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000, easing: "easeOutQuart" },
        scales: {
          x: {
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label(context) {
                return ` ${context.parsed.y || 0} bệnh nhân`;
              },
            },
          },
        },
      },
    });

    if (donutChart) donutChart.destroy();
    donutChart = new Chart(donutCanvas, {
      type: "doughnut",
      data: {
        labels: LABELS,
        datasets: [
          {
            data: dataPoints,
            backgroundColor: COLORS.map((c) => `${c}cc`),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "65%",
        animation: { duration: 1200, easing: "easeOutQuart" },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#cfd6e2",
              boxWidth: 12,
            },
          },
          tooltip: {
            callbacks: {
              label(context) {
                const value = context.parsed || 0;
                const percent = stats.total
                  ? ((value / stats.total) * 100).toFixed(1)
                  : 0;
                return ` ${value} ca (${percent}%)`;
              },
            },
          },
        },
      },
    });
  };
})();


