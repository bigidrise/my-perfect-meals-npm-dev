
import http from "http";
import { log } from "../vite";

class WarmupService {
  private warmupInterval: NodeJS.Timeout | null = null;
  private isWarming = false;

  start() {
    if (this.warmupInterval) return;

    // Ping ourselves every 4 minutes to prevent cold starts
    this.warmupInterval = setInterval(() => {
      this.performWarmup();
    }, 4 * 60 * 1000); // 4 minutes

    log("warmup", "🔥 Warmup service started - preventing cold starts");
  }

  stop() {
    if (this.warmupInterval) {
      clearInterval(this.warmupInterval);
      this.warmupInterval = null;
      log("warmup", "❄️ Warmup service stopped");
    }
  }

  private async performWarmup() {
    if (this.isWarming) return;

    this.isWarming = true;
    try {
      const start = Date.now();
      await this.pingHealthEndpoint();
      const duration = Date.now() - start;

      if (duration < 200) {
        log("warmup", `✅ Warmup successful (${duration}ms)`);
      } else {
        log("warmup", `⚠️ Warmup slow (${duration}ms)`);
      }
    } catch (error) {
      log("warmup", `❌ Warmup failed: ${error}`);
    } finally {
      this.isWarming = false;
    }
  }

  private pingHealthEndpoint(): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = parseInt(process.env.PORT || "5000", 10);
      const req = http.get(
        { hostname: "127.0.0.1", port, path: "/api/health", timeout: 5000 },
        (res) => {
          // Drain the response so the socket closes cleanly
          res.resume();
          res.on("end", resolve);
        }
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("warmup ping timed out"));
      });
    });
  }
}

export const warmupService = new WarmupService();
