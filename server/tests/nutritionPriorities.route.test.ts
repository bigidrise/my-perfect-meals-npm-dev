const auth = { user: null as { id: string } | null };
const state = {
  userDocument: null as any,
  householdDocument: null as any,
  childDocument: null as any,
  householdOwned: true,
  childOwned: true,
};

jest.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!auth.user) return res.status(401).json({ error: "Authentication required" });
    req.authUser = auth.user;
    next();
  },
}));

jest.mock("../services/pediatric/authoritativeChildAccess", () => ({
  loadOwnedActiveChildProfile: jest.fn(async (_userId: string, childId: string) =>
    state.childOwned
      ? { id: childId, food_inclusion_priorities: state.childDocument }
      : null,
  ),
}));

jest.mock("../db", () => ({
  db: {
    select: () => ({
      from: (table: any) => ({
        where: () => ({
          limit: async () => {
            const name = table?.[Symbol.for("drizzle:Name")] ?? table?._?.name;
            if (name === "users") return [{ document: state.userDocument }];
            return state.householdOwned ? [{ document: state.householdDocument }] : [];
          },
        }),
      }),
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: () => ({
          returning: async () => {
            const name = table?.[Symbol.for("drizzle:Name")] ?? table?._?.name;
            if (name === "users") {
              state.userDocument = values.foodInclusionPriorities;
              return [{ document: state.userDocument }];
            }
            if (!state.householdOwned) return [];
            state.householdDocument = values.foodInclusionPriorities;
            return [{ document: state.householdDocument }];
          },
        }),
      }),
    }),
    execute: async () => {
      if (!state.childOwned) return { rows: [] };
      return { rows: [{ id: "child" }] };
    },
  },
}));

import express from "express";
import request from "supertest";
import router from "../routes/nutritionPriorities";

const profileId = "11111111-1111-4111-8111-111111111111";
const childA = "22222222-2222-4222-8222-222222222222";
const write = (ids: string[] = []) => ({
  schemaVersion: 1,
  registryVersion: "nutrition-priorities.v1",
  selectedPriorityIds: ids,
});

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/nutrition-priorities", router);
  return instance;
}

beforeEach(() => {
  auth.user = null;
  state.userDocument = null;
  state.householdDocument = null;
  state.childDocument = null;
  state.householdOwned = true;
  state.childOwned = true;
});

describe("Nutrition Priorities subject-owned API", () => {
  it("requires authentication", async () => {
    expect((await request(app()).get("/api/nutrition-priorities")).status).toBe(401);
  });

  it("keeps adult and household documents isolated", async () => {
    auth.user = { id: "owner-a" };
    expect((await request(app()).put("/api/nutrition-priorities").send(write(["fiber_rich_foods"]))).status).toBe(200);
    expect((await request(app()).put(`/api/nutrition-priorities/household/${profileId}`).send(write(["calcium_rich_foods"]))).status).toBe(200);
    expect((await request(app()).get("/api/nutrition-priorities")).body.document.selectedPriorityIds).toEqual(["fiber_rich_foods"]);
    expect((await request(app()).get(`/api/nutrition-priorities/household/${profileId}`)).body.document.selectedPriorityIds).toEqual(["calcium_rich_foods"]);
  });

  it("fails closed for an inaccessible household or child", async () => {
    auth.user = { id: "owner-a" };
    state.householdOwned = false;
    expect((await request(app()).get(`/api/nutrition-priorities/household/${profileId}`)).status).toBe(404);
    expect((await request(app()).put(`/api/nutrition-priorities/household/${profileId}`).send(write())).status).toBe(404);
    state.childOwned = false;
    expect((await request(app()).get(`/api/nutrition-priorities/child/${childA}`)).status).toBe(404);
    expect((await request(app()).put(`/api/nutrition-priorities/child/${childA}`).send(write())).status).toBe(404);
  });

  it("stores each child's own document and rejects inactive IDs", async () => {
    auth.user = { id: "owner-a" };
    state.childDocument = {
      ...write(["iron_rich_foods"]),
      updatedAt: "2026-09-21T00:00:00.000Z",
    };
    expect((await request(app()).get(`/api/nutrition-priorities/child/${childA}`)).body.document.selectedPriorityIds).toEqual(["iron_rich_foods"]);
    expect((await request(app()).put(`/api/nutrition-priorities/child/${childA}`).send(write(["potassium_rich_foods"]))).status).toBe(400);
  });

  it("accepts an empty selection and ignores spoofed identity fields", async () => {
    auth.user = { id: "owner-a" };
    const response = await request(app()).put("/api/nutrition-priorities").send({
      ...write([]),
      userId: "owner-b",
      actorUserId: "owner-b",
      subjectUserId: "owner-b",
    });
    expect(response.status).toBe(200);
    expect(response.body.document.selectedPriorityIds).toEqual([]);
  });
});