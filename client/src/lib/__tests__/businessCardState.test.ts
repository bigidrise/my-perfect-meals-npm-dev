import {
  businessCardPresentation,
  INITIAL_BUSINESS_CARD_STATE,
  resolveBusinessCardState,
} from "../businessCardState";

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("More page organization card state", () => {
  test("initial and remounted state never offers organization purchase", () => {
    const firstMount = businessCardPresentation(INITIAL_BUSINESS_CARD_STATE);
    const remount = businessCardPresentation(INITIAL_BUSINESS_CARD_STATE);

    expect(firstMount.title).toBe("Checking Organization Access");
    expect(firstMount.destination).toBeNull();
    expect(remount.title).not.toBe("Start Your Organization");
  });

  test("active organization opens the dashboard", async () => {
    const state = await resolveBusinessCardState(async () =>
      response({ business: { name: "My Org", seatLimit: 10 }, usedSeats: 2 }),
    );
    expect(businessCardPresentation(state)).toMatchObject({
      title: "Open Organization Dashboard",
      destination: "/business-dashboard",
    });
  });

  test("incomplete organization offers setup completion", async () => {
    const responses = [
      response({}, 404),
      response({}, 403),
      response({
        exists: true,
        status: "pending_billing",
        name: "My Org",
        callerRole: "owner",
      }),
    ];
    const state = await resolveBusinessCardState(async () => responses.shift()!);
    expect(businessCardPresentation(state)).toMatchObject({
      title: "Complete Organization Setup",
      destination: "/business/start",
    });
  });

  test("authoritatively confirmed no organization offers creation", async () => {
    const responses = [
      response({}, 404),
      response({}, 403),
      response({ exists: false, status: null, name: null }),
    ];
    const state = await resolveBusinessCardState(async () => responses.shift()!);
    expect(businessCardPresentation(state)).toMatchObject({
      title: "Start Your Organization",
      destination: "/business/start",
    });
  });

  test.each([
    ["unauthorized", async () => response({}, 401)],
    ["server failure", async () => response({}, 500)],
    ["network failure", async () => { throw new Error("offline"); }],
  ])("%s check does not offer the purchase CTA", async (_label, finalRequest) => {
    let calls = 0;
    const state = await resolveBusinessCardState(async () => {
      calls += 1;
      if (calls < 3) return response({}, 404);
      return finalRequest();
    });
    const presentation = businessCardPresentation(state);
    expect(presentation.title).toBe("Organization Access Unavailable");
    expect(presentation.destination).toBeNull();
  });
});