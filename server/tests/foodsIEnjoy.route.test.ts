const auth = { user: null as { id: string } | null };
const state = {
  userDocument: null as any,
  householdDocument: null as any,
  householdExists: true,
};

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!auth.user) return res.status(401).json({ error: "Authentication required" });
    req.authUser = auth.user;
    next();
  },
}));

jest.mock("../db", () => ({
  db: {
    select: () => ({
      from: (table: any) => ({
        where: () => ({
          limit: async () => {
            const name = table?.[Symbol.for("drizzle:Name")] ?? table?._?.name;
            if (name === "users") return [{ foodsIEnjoy: state.userDocument }];
            if (!state.householdExists) return [];
            return [{ foodsIEnjoy: state.householdDocument }];
          },
        }),
      }),
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: () => {
          const name = table?.[Symbol.for("drizzle:Name")] ?? table?._?.name;
          if (name === "users") state.userDocument = values.foodsIEnjoy;
          if (name === "household_profiles") state.householdDocument = values.foodsIEnjoy;
          return {
            returning: async () => [{
              foodsIEnjoy: name === "users" ? state.userDocument : state.householdDocument,
            }],
          };
        },
      }),
    }),
  },
}));

import express from "express";
import request from "supertest";
import foodsIEnjoyRouter, { householdFoodsIEnjoyRouter } from "../routes/foodsIEnjoy";

const document = (label = "Pizza") => ({
  version: 1 as const,
  configured: true,
  updatedAt: new Date().toISOString(),
  items: [{
    id: "pizza",
    conceptId: "dish.pizza",
    kind: "dish" as const,
    category: "meals-dishes",
    displayLabel: label,
    originalText: null,
    locale: "en-US",
    source: "catalog" as const,
    provenance: "explicit" as const,
    selectedAt: new Date().toISOString(),
    revokedAt: null,
  }],
});

async function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/foods-i-enjoy", foodsIEnjoyRouter);
  instance.use("/api/household", householdFoodsIEnjoyRouter);
  return instance;
}

beforeEach(() => {
  auth.user = null;
  state.userDocument = null;
  state.householdDocument = null;
  state.householdExists = true;
});

describe("Foods I Enjoy route authorization and persistence", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await request(await app()).get("/api/foods-i-enjoy")).status).toBe(401);
    expect((await request(await app()).put("/api/foods-i-enjoy").send(document())).status).toBe(401);
  });

  it("uses authenticated self identity and ignores spoofed body/query IDs", async () => {
    auth.user = { id: "authenticated-user" };
    const response = await request(await app())
      .put("/api/foods-i-enjoy?userId=spoofed-user")
      .send({ ...document(), userId: "spoofed-user" });
    expect(response.status).toBe(200);
    expect(state.userDocument.items[0].displayLabel).toBe("Pizza");
  });

  it("supports self GET/PUT roundtrip and removal", async () => {
    auth.user = { id: "user-1" };
    expect((await request(await app()).get("/api/foods-i-enjoy")).body.document.items).toEqual([]);
    expect((await request(await app()).put("/api/foods-i-enjoy").send(document())).status).toBe(200);
    expect((await request(await app()).get("/api/foods-i-enjoy")).body.document.items).toHaveLength(1);
    const removed = { ...document(), configured: true, items: [] };
    expect((await request(await app()).put("/api/foods-i-enjoy").send(removed)).body.document.items).toEqual([]);
  });

  it("returns useful schema details for invalid PUT", async () => {
    auth.user = { id: "user-1" };
    const response = await request(await app()).put("/api/foods-i-enjoy").send({
      version: 1, configured: true, updatedAt: new Date().toISOString(),
      items: [{ id: "x", conceptId: null, kind: "custom", category: "custom", displayLabel: "X",
        originalText: null, locale: null, source: "free_text", provenance: "explicit",
        selectedAt: new Date().toISOString(), revokedAt: null }],
    });
    expect(response.status).toBe(400);
    expect(response.body.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: expect.arrayContaining(["items", 0, "originalText"]) }),
    ]));
  });

  it("allows owned household GET/PUT and rejects a cross-owner profile", async () => {
    auth.user = { id: "owner-1" };
    const profileId = "11111111-1111-4111-8111-111111111111";
    expect((await request(await app()).put(`/api/household/profiles/${profileId}/foods-i-enjoy`).send(document("Mango"))).status).toBe(200);
    expect((await request(await app()).get(`/api/household/profiles/${profileId}/foods-i-enjoy`)).body.document.items[0].displayLabel).toBe("Mango");
    state.householdExists = false;
    expect((await request(await app()).get(`/api/household/profiles/${profileId}/foods-i-enjoy`)).status).toBe(404);
    expect((await request(await app()).put(`/api/household/profiles/${profileId}/foods-i-enjoy`).send(document())).status).toBe(404);
  });
});