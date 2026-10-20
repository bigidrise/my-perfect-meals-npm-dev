import { DemoStore } from "./state";
import { installDemoIsolation } from "./isolation";

declare global {
  interface Window {
    __mpmDemoInitialState?: unknown;
    __mpmDemoChannel?: string;
    __mpmDemoStore?: DemoStore;
    __mpmDemoPath?: string;
    __mpmDemoSearch?: string;
  }
}

try {
  const store = new DemoStore(window.__mpmDemoInitialState);
  installDemoIsolation(store);
  window.__mpmDemoStore = store;
  let cachedUser: unknown;
  store.subscribe(() => {
    window.__mpmDemoPath = store.state.path.split("?")[0];
    window.__mpmDemoSearch = store.state.path.includes("?") ? `?${store.state.path.split("?")[1]}` : "";
    if (cachedUser !== store.state.user) {
      cachedUser = store.state.user;
      // For real components which still read the legacy cached-user helper.
      // These keys exist ONLY in the frame's memory Storage implementation.
      localStorage.setItem("mpm_current_user", JSON.stringify(store.state.user));
      localStorage.setItem("userId", store.state.user.id);
      localStorage.setItem("isAuthenticated", "true");
    }
    window.parent.postMessage({
      type: "mpm-demo-state", channel: window.__mpmDemoChannel, state: store.state,
    }, "*");
  });
  store.changed();
  // Only import real components AFTER all browser barriers are installed.
  void import("./DemoRuntime").then(({ mountDemo }) => mountDemo(store)).catch(fail);
} catch (error) { fail(error); }

function fail(error: unknown) {
  const root = document.getElementById("root")!;
  root.replaceChildren();
  const heading = document.createElement("h1");
  heading.textContent = "Demo Studio could not start safely";
  const message = document.createElement("pre");
  message.textContent = error instanceof Error ? error.message : String(error);
  root.append(heading, message);
}
