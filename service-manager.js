(function (root) {
  "use strict";

  class ServiceManager {
    constructor() {
      this.installPrompt = null;
      this.registration = null;
      this.started = false;
      this.online = typeof navigator === "undefined" ? true : navigator.onLine;
      this._boundHandlers = null;
    }

    start(options) {
      if (this.started || typeof window === "undefined") return this;
      this.started = true;
      const config = options || {};

      this._boundHandlers = {
        beforeInstallPrompt: (event) => {
          event.preventDefault();
          this.installPrompt = event;
          this._emit("installavailable");
        },
        appInstalled: () => {
          this.installPrompt = null;
          this._emit("installed");
        },
        online: () => {
          this.online = true;
          this._emit("online");
        },
        offline: () => {
          this.online = false;
          this._emit("offline");
        }
      };

      window.addEventListener("beforeinstallprompt", this._boundHandlers.beforeInstallPrompt);
      window.addEventListener("appinstalled", this._boundHandlers.appInstalled);
      window.addEventListener("online", this._boundHandlers.online);
      window.addEventListener("offline", this._boundHandlers.offline);

      const workerUrl = config.serviceWorkerUrl || "service-worker.js";
      this.registerServiceWorker(workerUrl, config.serviceWorkerOptions)
        .catch((error) => this._emit("serviceworkererror", { error }));

      return this;
    }

    async registerServiceWorker(url, options) {
      if (!url) throw new TypeError("A service worker URL is required.");
      if (typeof navigator === "undefined" || !navigator.serviceWorker) {
        this._emit("serviceworkerunsupported");
        return null;
      }

      try {
        this.registration = await navigator.serviceWorker.register(url, options || {});
        this._emit("serviceworkerready", { registration: this.registration });
        return this.registration;
      } catch (error) {
        this._emit("serviceworkererror", { error });
        throw error;
      }
    }

    async install() {
      if (!this.installPrompt) return { outcome: "unavailable" };

      const promptEvent = this.installPrompt;
      this.installPrompt = null;
      await promptEvent.prompt();
      const result = await promptEvent.userChoice;
      this._emit("installresult", { outcome: result.outcome });
      return result;
    }

    getStatus() {
      return {
        online: this.online,
        installAvailable: Boolean(this.installPrompt),
        serviceWorkerSupported: typeof navigator !== "undefined" && Boolean(navigator.serviceWorker),
        serviceWorkerRegistered: Boolean(this.registration)
      };
    }

    stop() {
      if (!this.started || typeof window === "undefined" || !this._boundHandlers) return;
      window.removeEventListener("beforeinstallprompt", this._boundHandlers.beforeInstallPrompt);
      window.removeEventListener("appinstalled", this._boundHandlers.appInstalled);
      window.removeEventListener("online", this._boundHandlers.online);
      window.removeEventListener("offline", this._boundHandlers.offline);
      this._boundHandlers = null;
      this.started = false;
    }

    _emit(name, detail) {
      if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
      const event = typeof window.CustomEvent === "function"
        ? new CustomEvent("nova:" + name, { detail: detail || {} })
        : new Event("nova:" + name);
      window.dispatchEvent(event);
    }
  }

  const manager = new ServiceManager();
  root.NOVAServiceManager = manager;
  root.NOVAServiceManagerClass = ServiceManager;
  manager.start();
})(typeof window !== "undefined" ? window : this);
