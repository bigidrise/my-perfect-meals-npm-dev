
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
      // Quick internal health check
      const start = Date.now();
      await this.internalHealthCheck();
      const duration = Date.now() - start;
      
      if (duration < 100) {
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

  private async internalHealthCheck(): Promise<void> {
    return new Promise((resolve) => {
      // Simple async operation to keep event loop active
      setImmediate(() => {
        // Touch some core systems lightly
        const now = new Date().toISOString();
        resolve();
      });
    });
  }
}

export const warmupService = new WarmupService();
