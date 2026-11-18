import { startupEnglish, startupSpanish } from "../shared/consumerStartupCopy";
// This is a dependency-free, browser-safe preference contract, not a UI module.
import { LANGUAGE_PREFERENCE_KEY, CUSTOMER_UI_LANGUAGES } from "../client/src/i18n/languagePreference";

/**
 * Development-only first-paint presentation. Keep crawler-readable HTML intact:
 * without JavaScript, the splash stays hidden and public content stays visible.
 */
export function addDevelopmentStartupPresentation(html: string): string {
  if (process.env.NODE_ENV !== "development" || html.includes('id="mpm-development-startup"')) return html;
  const head = `
    <style>
      #mpm-development-startup { display: none; }
      html.mpm-starting #root { visibility: hidden; }
      html.mpm-starting #mpm-development-startup,
      html.mpm-startup-error #mpm-development-startup {
        box-sizing: border-box; position: fixed; inset: 0; z-index: 2147483000;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        overflow-y: auto; background: #000; color: #fff; text-align: center;
        padding: calc(24px + env(safe-area-inset-top, 0px))
          calc(24px + env(safe-area-inset-right, 0px))
          calc(24px + env(safe-area-inset-bottom, 0px))
          calc(24px + env(safe-area-inset-left, 0px));
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      #mpm-development-startup img { width: 80px; height: 80px; object-fit: contain; margin-bottom: 16px; }
      #mpm-development-startup p { max-width: 32rem; margin: 0 0 16px; line-height: 1.5; color: #bbb; }
      #mpm-startup-actions { display: none; gap: 12px; flex-wrap: wrap; justify-content: center; }
      html.mpm-startup-error #mpm-startup-actions { display: flex; }
      #mpm-startup-actions button { padding: 12px 16px; border: 1px solid #666; border-radius: 10px; background: #171717; color: white; cursor: pointer; font: inherit; }
    </style>
    <script data-mpm-startup-bootstrap>
      (function () {
        var page = document.documentElement;
        var timer, finished = false, failed = false;
        var preference = "auto", language = "en";
        var supported = ${JSON.stringify(CUSTOMER_UI_LANGUAGES)};
        try { preference = localStorage.getItem(${JSON.stringify(LANGUAGE_PREFERENCE_KEY)}) || "auto"; } catch (_) {}
        var chosen = preference.split("-")[0].toLowerCase();
        if (chosen !== "auto" && chosen !== "null" && supported.indexOf(chosen) < 0) chosen = "en";
        if (chosen === "null") chosen = "auto";
        language = chosen === "auto" ? (navigator.language || "en").split("-")[0].toLowerCase() : chosen;
        if (supported.indexOf(language) < 0) language = "en";
        var english = ${JSON.stringify(startupEnglish).replace(/</g, "\\u003c")};
        var spanish = ${JSON.stringify(startupSpanish).replace(/</g, "\\u003c")};
        var copy = language === "es" ? spanish : english;
        if (language === "es" || language === "en") { page.lang = language; page.dir = "ltr"; }
        if (document.title === english.publicTitle || document.title === spanish.publicTitle) document.title = copy.publicTitle;
        function applyCopy() {
          var splash = document.getElementById("mpm-development-startup");
          if (!splash) return;
          splash.setAttribute("aria-label", copy.label);
          document.getElementById("mpm-startup-message").textContent = failed ? copy.failed : copy.loading;
          document.getElementById("mpm-startup-reload").textContent = copy.reload;
          document.getElementById("mpm-startup-public").textContent = copy.publicPage;
        }
        window.addEventListener("mpm:startup-present", applyCopy);
        applyCopy();
        page.classList.add("mpm-starting");
        function clearLoading() {
          clearTimeout(timer);
          page.classList.remove("mpm-starting", "mpm-startup-error");
          var splash = document.getElementById("mpm-development-startup");
          if (splash) splash.remove();
          window.removeEventListener("mpm:startup-failed", failure);
          window.removeEventListener("mpm:app-mounted", complete);
          window.removeEventListener("error", moduleError, true);
          window.removeEventListener("mpm:startup-present", applyCopy);
          document.removeEventListener("click", startupAction);
        }
        function complete() { if (!failed) { finished = true; clearLoading(); } }
        function failure() {
          if (finished) return;
          failed = true;
          clearTimeout(timer);
          page.classList.remove("mpm-starting");
          page.classList.add("mpm-startup-error");
          var message = document.getElementById("mpm-startup-message");
          if (message) message.textContent = copy.failed;
        }
        function moduleError(event) {
          if (event.target && event.target.tagName === "SCRIPT" && event.target.type === "module") failure();
        }
        function startupAction(event) {
          var button = event.target && event.target.closest && event.target.closest("#mpm-startup-actions button");
          if (!button) return;
          if (button.id === "mpm-startup-reload") location.reload();
          if (button.id === "mpm-startup-public") { finished = true; clearLoading(); }
        }
        // Delegate immediately: a stalled module can hold DOMContentLoaded indefinitely.
        document.addEventListener("click", startupAction);
        window.addEventListener("mpm:startup-failed", failure);
        window.addEventListener("mpm:app-mounted", complete);
        window.addEventListener("error", moduleError, true);
        timer = setTimeout(function () {
          console.error("[MPM Boot] Startup presentation timed out after 30 seconds.");
          failure();
        }, 30000);
        document.addEventListener("DOMContentLoaded", function () {
          if (finished) return;
          if (!document.getElementById("root")) { failure(); return; }
          if (failed) failure();
          else applyCopy();
        }, { once: true });
      })();
    </script>`;
  const splash = `
    <div id="mpm-development-startup" role="status" aria-live="polite" aria-label="My Perfect Meals startup">
      <img src="/icons/chef.png?v=2026b" alt="My Perfect Meals" width="80" height="80" fetchpriority="high" />
      <p id="mpm-startup-message">Loading your personalized experience…</p>
      <div id="mpm-startup-actions">
        <button id="mpm-startup-reload" type="button">Reload</button>
        <button id="mpm-startup-public" type="button">View public page</button>
      </div>
    </div>
    <script data-mpm-startup-ready>window.dispatchEvent(new Event("mpm:startup-present"));</script>`;
  return html.replace("</head>", `${head}</head>`).replace(/<body([^>]*)>/, `<body$1>${splash}`);
}
