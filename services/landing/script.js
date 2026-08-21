(function () {
  "use strict";

  /* ---------------- Theme toggle ---------------- */
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  var STORAGE_KEY = "nexusretail-theme";

  function getPreferredTheme() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    if (toggle) {
      toggle.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
    }
  }

  applyTheme(getPreferredTheme());

  if (toggle) {
    toggle.addEventListener("click", function () {
      var current = root.getAttribute("data-theme");
      var next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
    });
  }

  if (!localStorage.getItem(STORAGE_KEY) && window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
      if (!localStorage.getItem(STORAGE_KEY)) {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
  }

  /* ---------------- Live manifest ticker ---------------- */
  var events = [
    { text: "PO-1001 · TechVision Distributors · matched · stock updated", cls: "ok" },
    { text: "Invoice INV-140 · Textract extraction complete · 2.1s", cls: "" },
    { text: "PO-1042 · Sunrise Coffee Supply Co · flagged for review", cls: "flag" },
    { text: "WAF · blocked 1 request · SQLi pattern · eu-central-1", cls: "flag" },
    { text: "CloudWatch · ECS running task count 1/1 · healthy", cls: "ok" },
    { text: "ALB · p99 response time 37ms", cls: "" },
    { text: "RDS · nexusretail-dev-db · available", cls: "ok" },
    { text: "CI/CD · deploy to nexusretail-dev-api-service · stable", cls: "ok" }
  ];

  var track = document.getElementById("ticker-track");

  function renderTicker() {
    if (!track) return;
    var html = "";
    for (var pass = 0; pass < 2; pass++) {
      events.forEach(function (evt) {
        html +=
          '<span class="ticker-item ' + evt.cls + '">' +
          escapeHtml(evt.text) +
          "</span>";
      });
    }
    track.innerHTML = html;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  renderTicker();

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion && track) {
    track.style.animation = "none";
  }
})();
