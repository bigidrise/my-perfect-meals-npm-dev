import { ChefFlowImageRequests, restaurantImageContentIdentity } from "../chefFlowImageRequests";

const deferred = () => {
  let resolve!: (value: string | null) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string | null>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("the default queue starts three requests, then releases exactly one slot per completion", async () => {
  const queue = new ChefFlowImageRequests();
  const work = Array.from({ length: 7 }, deferred);
  const starts = work.map(item => jest.fn(() => item.promise));
  const results = starts.map(generate => queue.request({ generate }));
  expect(starts.filter(start => start.mock.calls.length)).toHaveLength(3);
  work[0].resolve("/first.jpg");
  await results[0];
  expect(starts.filter(start => start.mock.calls.length)).toHaveLength(4);
  work.forEach(item => item.resolve("/done.jpg"));
  await Promise.all(results);
});

test("six-request scheduling remains bounded even with more than six meals", async () => {
  const queue = new ChefFlowImageRequests();
  const work = Array.from({ length: 9 }, deferred);
  const starts = work.map(item => jest.fn(() => item.promise));
  const results = starts.map(generate => queue.request({ concurrency: 6, generate }));
  expect(starts.filter(start => start.mock.calls.length)).toHaveLength(6);
  work[0].resolve("/first.jpg");
  await results[0];
  expect(starts.filter(start => start.mock.calls.length)).toHaveLength(7);
  work.forEach(item => item.resolve("/done.jpg"));
  await Promise.all(results);
});

test("a shared exact-recipe request runs once and returns the same result to every card", async () => {
  const queue = new ChefFlowImageRequests();
  const work = deferred();
  const generate = jest.fn(() => work.promise);
  const first = queue.request({ key: "owner/recipe", concurrency: 6, generate });
  const second = queue.request({ key: "owner/recipe", concurrency: 6, generate });
  expect(first).toBe(second);
  expect(generate).toHaveBeenCalledTimes(1);
  work.resolve("/verified.jpg");
  expect(await first).toEqual({ status: "complete", photograph: "/verified.jpg" });
  expect(await second).toEqual({ status: "complete", photograph: "/verified.jpg" });
});

test("queued obsolete requests are skipped without generating or marking them failed", async () => {
  const queue = new ChefFlowImageRequests();
  const work = Array.from({ length: 3 }, deferred);
  const active = work.map(item => queue.request({ generate: () => item.promise }));
  let current = true;
  const generate = jest.fn(async () => "/unwanted.jpg");
  const obsolete = queue.request({ key: "old/recipe", isCurrent: () => current, generate });
  current = false;
  work[0].resolve("/first.jpg");
  await active[0];
  expect(await obsolete).toEqual({ status: "skipped" });
  expect(generate).not.toHaveBeenCalled();
  work.forEach(item => item.resolve("/done.jpg"));
  await Promise.all(active);
});

test("a queued shared request stays active if another current card still needs it", async () => {
  const queue = new ChefFlowImageRequests();
  const work = Array.from({ length: 3 }, deferred);
  const active = work.map(item => queue.request({ generate: () => item.promise }));
  let firstCurrent = true;
  const generate = jest.fn(async () => "/shared.jpg");
  const first = queue.request({ key: "shared", isCurrent: () => firstCurrent, generate });
  const second = queue.request({ key: "shared", isCurrent: () => true, generate });
  firstCurrent = false;
  work[0].resolve("/first.jpg");
  expect(await first).toEqual({ status: "complete", photograph: "/shared.jpg" });
  expect(await second).toEqual({ status: "complete", photograph: "/shared.jpg" });
  expect(generate).toHaveBeenCalledTimes(1);
  work.forEach(item => item.resolve("/done.jpg"));
  await Promise.all(active);
});

test("failed requests release slots without automatic retries", async () => {
  const queue = new ChefFlowImageRequests();
  const work = Array.from({ length: 3 }, deferred);
  const active = work.map(item => queue.request({ generate: () => item.promise }));
  const rejected = expect(active[0]).rejects.toThrow("offline failure");
  const next = jest.fn(async () => "/next.jpg");
  const pending = queue.request({ generate: next });
  work[0].reject(new Error("offline failure"));
  await rejected;
  expect(await pending).toEqual({ status: "complete", photograph: "/next.jpg" });
  expect(next).toHaveBeenCalledTimes(1);
  work.slice(1).forEach(item => item.resolve("/done.jpg"));
  await Promise.all(active.slice(1));
});

test("a null validation outcome never becomes a photograph", async () => {
  const queue = new ChefFlowImageRequests();
  expect(await queue.request({ generate: async () => null })).toEqual({ status: "complete", photograph: null });
});

test("cache identity ignores presentation IDs, but retains every ingredient and account", () => {
  const recipe = { name: "Soup", ingredients: Array.from({ length: 12 }, (_, i) => `ingredient ${i}`) };
  const key = restaurantImageContentIdentity(recipe, "restaurant", "owner-a");
  expect(restaurantImageContentIdentity({ ...recipe }, "restaurant", "owner-a")).toBe(key);
  expect(restaurantImageContentIdentity({ ...recipe, ingredients: [...recipe.ingredients, "peanut"] }, "restaurant", "owner-a")).not.toBe(key);
  expect(restaurantImageContentIdentity(recipe, "restaurant", "owner-b")).not.toBe(key);
  expect(restaurantImageContentIdentity(recipe, "beverage", "owner-a")).not.toBe(key);
});

test("controlled timing removes the second-wave wait without changing provider durations", async () => {
  jest.useFakeTimers();
  try {
    async function measure(concurrency: 3 | 6) {
      const queue = new ChefFlowImageRequests();
      const started = Date.now();
      let active = 0;
      let peak = 0;
      const requests = [12000, 12000, 24000, 12000, 16000, 11000].map(duration => queue.request({
        concurrency,
        generate: async () => {
          active++; peak = Math.max(peak, active);
          await new Promise(resolve => setTimeout(resolve, duration));
          active--;
          return "/fixture.jpg";
        },
      }));
      await jest.runAllTimersAsync();
      await Promise.all(requests);
      return { elapsed: Date.now() - started, peak };
    }
    expect(await measure(3)).toEqual({ elapsed: 35000, peak: 3 });
    expect(await measure(6)).toEqual({ elapsed: 24000, peak: 6 });
  } finally { jest.useRealTimers(); }
});
