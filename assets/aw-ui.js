/*
  Finishing touches on top of the Upptime status page, which we cannot edit:
  - the light / dark / system theme choice, kept in this browser;
  - the period switch and the theme switch drawn as ui-sdk segmented controls
    (https://ui-sdk.dev, loaded from its CDN at the pinned major version);
  - a plain-language line under each service name.

  Everything here is optional: if this file or ui-sdk does not load, the page
  shows Upptime's own period switch and follows the system theme.

  Loaded from .upptimerc.yml (status-website.scripts) on the front page and
  from assets/history/<service>.html on service pages, before the page paints,
  so a saved theme applies without a flash.
*/
(function () {
  if (typeof window === "undefined" || window.__awUi) return;
  window.__awUi = true;

  var THEME_KEY = "aw-status-theme";
  var UI_SDK = "https://ui-sdk.dev/web@0";
  var root = document.documentElement;

  var ABOUT = {
    "anyworker-ai": "Сайт и вход в сервис",
    "app-readiness": "Приложение готово принимать запросы",
    "app-liveness": "Приложение запущено",
    "deploy-panel": "Панель обновлений",
    "error-tracker": "Сбор ошибок",
    "files-nextcloud": "Файловое хранилище",
    mail: "Почта",
  };

  function savedTheme() {
    try {
      var value = localStorage.getItem(THEME_KEY);
      return value === "light" || value === "dark" ? value : "system";
    } catch (error) {
      return "system";
    }
  }

  function applyTheme(value) {
    if (value === "light" || value === "dark") root.setAttribute("data-theme", value);
    else root.removeAttribute("data-theme");
  }

  applyTheme(savedTheme());

  var requested = false;
  function loadUiSdk() {
    if (requested || !document.head) return;
    requested = true;
    var styles = document.createElement("link");
    styles.rel = "stylesheet";
    styles.href = UI_SDK + ".css";
    var script = document.createElement("script");
    script.type = "module";
    script.src = UI_SDK + ".js";
    document.head.appendChild(styles);
    document.head.appendChild(script);
  }

  function segmented(label, value, options) {
    var control = document.createElement("ui-segmented-control");
    control.setAttribute("aria-label", label);
    control.setAttribute("default-value", value);
    control.appendChild(document.createElement("ui-segmented-control-indicator"));
    options.forEach(function (option) {
      var item = document.createElement("ui-segmented-control-item");
      item.setAttribute("value", option.value);
      item.textContent = option.text;
      control.appendChild(item);
    });
    return control;
  }

  /* Shows `holder` in its ui-sdk form only once the element really works. */
  function whenReady(holder) {
    if (!window.customElements) return;
    customElements.whenDefined("ui-segmented-control").then(function () {
      holder.classList.add("aw-ready");
    });
  }

  function periodSwitch() {
    var form = document.querySelector(".f > form.r");
    if (!form || form.parentNode.querySelector("ui-segmented-control")) return;
    var inputs = Array.prototype.slice.call(form.querySelectorAll("input[type=radio]"));
    if (!inputs.length) return;
    var checked = inputs.filter(function (input) {
      return input.checked;
    })[0];
    var control = segmented(
      "Период",
      (checked || inputs[0]).value,
      inputs.map(function (input) {
        var label = form.querySelector('label[for="' + input.id + '"]');
        return { value: input.value, text: label ? label.textContent : input.value };
      })
    );
    control.addEventListener("valuechange", function (event) {
      var target = inputs.filter(function (input) {
        return input.value === event.detail.value;
      })[0];
      if (target && !target.checked) target.click();
    });
    form.parentNode.appendChild(control);
    whenReady(form.parentNode);
    loadUiSdk();
  }

  function themeSwitch() {
    var footer = document.querySelector("footer");
    if (!footer || footer.querySelector(".aw-theme")) return;
    var holder = document.createElement("div");
    holder.className = "aw-theme";
    var caption = document.createElement("span");
    caption.textContent = "Тема";
    caption.setAttribute("aria-hidden", "true");
    var control = segmented("Тема оформления", savedTheme(), [
      { value: "system", text: "Как в системе" },
      { value: "light", text: "Светлая" },
      { value: "dark", text: "Тёмная" },
    ]);
    control.addEventListener("valuechange", function (event) {
      var value = event.detail.value;
      try {
        if (value === "system") localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, value);
      } catch (error) {}
      applyTheme(value);
    });
    holder.appendChild(caption);
    holder.appendChild(control);
    footer.appendChild(holder);
    whenReady(holder);
    loadUiSdk();
  }

  function about(slug, after) {
    if (!ABOUT[slug] || !after || !after.parentNode) return;
    var next = after.nextElementSibling;
    if (next && next.classList.contains("aw-about")) return;
    var line = document.createElement("p");
    line.className = "aw-about";
    line.textContent = ABOUT[slug];
    after.parentNode.insertBefore(line, after.nextSibling);
  }

  function descriptions() {
    var links = document.querySelectorAll(".live-status article h4 a");
    Array.prototype.forEach.call(links, function (link) {
      about((link.getAttribute("href") || "").split("/").pop(), link.parentNode);
    });
    var page = location.pathname.match(/\/history\/([^/]+?)\/?$/);
    if (page) about(page[1], document.querySelector("main > section h1"));
  }

  var queued = false;
  function enhance() {
    queued = false;
    periodSwitch();
    themeSwitch();
    descriptions();
  }

  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    (window.requestAnimationFrame || setTimeout)(enhance);
  }).observe(root, { childList: true, subtree: true });
  if (document.readyState !== "loading") enhance();
  else document.addEventListener("DOMContentLoaded", enhance);
})();
