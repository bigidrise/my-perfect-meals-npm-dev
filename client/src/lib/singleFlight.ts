export interface SingleFlight<T> {
  run(operation: () => Promise<T>): Promise<T>;
}

export function createSingleFlight<T>(): SingleFlight<T> {
  let inFlight: Promise<T> | null = null;

  return {
    run(operation) {
      if (inFlight) return inFlight;

      const request = operation();
      inFlight = request;
      const clear = () => {
        if (inFlight === request) inFlight = null;
      };
      request.then(clear, clear);
      return request;
    },
  };
}