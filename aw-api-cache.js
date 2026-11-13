/*
  The status page (Upptime) asks api.github.com for incidents and response-time
  history on every visit. Without a login GitHub allows 60 requests an hour per
  IP address, after which the page shows "rate limit exceeded".

  The "Status page data" workflow saves the same data into api-cache/ in the
  repository. This script answers the page's API requests from those files,
  which are not rate limited. Anything it has no file for goes to the real API
  as before.

  Loaded before the page's own code: from .upptimerc.yml (status-website.scripts)
  on the front page, and from assets/history/<service>.html on service pages.
*/
(function () {
  if (typeof window === "undefined" || window.__awApiCache || !window.fetch) return;
  window.__awApiCache = true;

  var REPO = "shhuzen/anyworker-status";
  var API = "https://api.github.com/repos/" + REPO + "/";
  var FILES = "https://raw.githubusercontent.com/" + REPO + "/master/api-cache/";
  var realFetch = window.fetch.bind(window);
  var loaded = {};

  function file(name) {
    if (!loaded[name]) {
      loaded[name] = realFetch(FILES + name).then(function (res) {
        if (!res.ok) throw new Error(name + " " + res.status);
        return res.json();
      });
      loaded[name]["catch"](function () {
        delete loaded[name];
      });
    }
    return loaded[name];
  }

  function hasLabels(issue, wanted) {
    var names = (issue.labels || []).map(function (label) {
      return label.name;
    });
    return wanted.every(function (name) {
      return names.indexOf(name) > -1;
    });
  }

  /* A promise of the data for this API address, or null to use the real API. */
  function fromFiles(address) {
    var url;
    try {
      url = new URL(address);
    } catch (error) {
      return null;
    }
    var path = url.pathname.replace(/^\/repos\/[^/]+\/[^/]+\//, "");
    var query = url.searchParams;

    if (path === "issues") {
      var state = query.get("state") || "open";
      if (state !== "open" && state !== "closed") return null;
      var wanted = (query.get("labels") || "").split(",").filter(Boolean);
      return file("issues-" + state + ".json").then(function (issues) {
        return issues.filter(function (issue) {
          return hasLabels(issue, wanted);
        });
      });
    }

    var single = path.match(/^issues\/(\d+)$/);
    if (single) {
      var number = Number(single[1]);
      return Promise.all([file("issues-open.json"), file("issues-closed.json")]).then(function (lists) {
        var found = lists[0].concat(lists[1]).filter(function (issue) {
          return issue.number === number;
        })[0];
        if (!found) throw new Error("issue " + number + " is not in the saved data");
        return found;
      });
    }

    if (path === "commits") {
      var history = (query.get("path") || "").match(/^history\/(.+)\.yml$/);
      if (!history) return null;
      return file("commits.json").then(function (bySlug) {
        if (!bySlug[history[1]]) throw new Error("no saved history for " + history[1]);
        return bySlug[history[1]];
      });
    }

    return null;
  }

  window.fetch = function (input, init) {
    var address = typeof input === "string" ? input : input && input.url;
    var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    if (address && method === "GET" && address.indexOf(API) === 0) {
      var saved = fromFiles(address);
      if (saved) {
        return saved.then(
          function (data) {
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: { "content-type": "application/json; charset=utf-8" },
            });
          },
          function () {
            return realFetch(input, init);
          }
        );
      }
    }
    return realFetch(input, init);
  };
})();
