type ImageValue = string | null;
type RequestResult = { status: "complete"; photograph: ImageValue } | { status: "skipped" };
interface RequestOptions {
  /** Only the Development Find Meals caller opts into six; default stays three. */
  concurrency?: 3 | 6;
  key?: string;
  isCurrent?: () => boolean;
  generate: () => Promise<ImageValue>;
}
interface PendingImage {
  key?: string;
  limit: number;
  consumers: Set<() => boolean>;
  generate: () => Promise<ImageValue>;
  promise: Promise<RequestResult>;
  resolve: (value: RequestResult) => void;
  reject: (error: unknown) => void;
}

/** Shared bounded queue: coalescing never changes the image validation contract. */
export class ChefFlowImageRequests {
  private active = 0;
  private queue: PendingImage[] = [];
  private shared = new Map<string, PendingImage>();

  request(options: RequestOptions): Promise<RequestResult> {
    const isCurrent = options.isCurrent ?? (() => true);
    const existing = options.key ? this.shared.get(options.key) : undefined;
    if (existing) {
      existing.consumers.add(isCurrent);
      return existing.promise;
    }
    let resolve!: PendingImage["resolve"];
    let reject!: PendingImage["reject"];
    const promise = new Promise<RequestResult>((yes, no) => { resolve = yes; reject = no; });
    const pending: PendingImage = {
      key: options.key, limit: options.concurrency === 6 ? 6 : 3,
      consumers: new Set([isCurrent]), generate: options.generate, promise, resolve, reject,
    };
    if (pending.key) this.shared.set(pending.key, pending);
    this.queue.push(pending);
    this.drain();
    return promise;
  }

  private forget(pending: PendingImage) {
    if (pending.key && this.shared.get(pending.key) === pending) this.shared.delete(pending.key);
  }

  private drain() {
    // Remove obsolete queued work before it makes any paid request. An already
    // running request is allowed to finish and be cached, not aborted/restarted.
    this.queue = this.queue.filter(pending => {
      if ([...pending.consumers].some(current => current())) return true;
      this.forget(pending);
      pending.resolve({ status: "skipped" });
      return false;
    });
    let index: number;
    while ((index = this.queue.findIndex(pending => this.active < pending.limit)) !== -1) {
      const [pending] = this.queue.splice(index, 1);
      this.active++;
      void this.execute(pending);
    }
  }

  private async execute(pending: PendingImage) {
    try {
      const photograph = await pending.generate();
      pending.resolve({ status: "complete", photograph });
    } catch (error) {
      pending.reject(error);
    } finally {
      this.forget(pending);
      this.active--;
      this.drain();
    }
  }
}

export const chefFlowImageRequests = new ChefFlowImageRequests();

/** Presentation/restaurant card IDs must not prevent exact-recipe image reuse. */
export function restaurantImageContentIdentity(
  meal: { name?: string; meal?: string; ingredients?: string[] },
  mealType: string,
  ownerId: string,
): string {
  // Keep ALL ingredients, quantities and ordering. Do not use fuzzy food-name
  // matches, truncate the recipe or share account-specific browser entries.
  return `restaurant-recipe-v1:${JSON.stringify([
    ownerId, mealType, meal.name || meal.meal || "", meal.ingredients ?? [],
  ])}`;
}
