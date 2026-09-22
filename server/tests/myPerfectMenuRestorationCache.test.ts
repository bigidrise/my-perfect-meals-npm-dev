import express from "express";
import request from "supertest";
import { requireFullMyPerfectMenuRestorationPayload } from "../routes/myPerfectMenu";

const concepts = [
  { id: "breakfast-a", title: "A" },
  { id: "breakfast-b", title: "B" },
  { id: "breakfast-c", title: "C" },
];

function restorationApp() {
  const app = express();
  app.set("etag", "strong");
  app.get(
    "/api/my-perfect-menu/effective-builder",
    requireFullMyPerfectMenuRestorationPayload,
    (_req, res) => res.json({
      builder: { key: "general_nutrition", namespace: "generalNutrition" },
    }),
  );
  app.get(
    "/api/my-perfect-menu/concepts",
    requireFullMyPerfectMenuRestorationPayload,
    (_req, res) => res.json({
      categories: { breakfast: concepts },
      subject: { id: "adult-subject" },
      builder: { key: "general_nutrition", namespace: "generalNutrition" },
    }),
  );
  return app;
}

describe("My Perfect Menu repeated restoration HTTP contract", () => {
  it.each([
    "/api/my-perfect-menu/effective-builder",
    "/api/my-perfect-menu/concepts",
  ])("always returns a complete 200 JSON response for %s", async (path) => {
    const app = restorationApp();
    const first = await request(app).get(path).expect(200);
    expect(first.headers["cache-control"]).toContain("no-store");
    expect(first.headers["surrogate-control"]).toBe("no-store");
    expect(first.body).toBeTruthy();

    for (let remount = 0; remount < 4; remount += 1) {
      const restored = await request(app)
        .get(path)
        .set("If-None-Match", first.headers.etag)
        .set("If-Modified-Since", new Date().toUTCString())
        .expect(200);
      expect(restored.body).toEqual(first.body);
      expect(restored.text.length).toBeGreaterThan(0);
    }
  });

  it("restores the exact A/B/C set after inspecting A, B, and C in sequence", async () => {
    const app = restorationApp();
    let validator: string | undefined;
    for (const selectedId of ["breakfast-a", "breakfast-b", "breakfast-c"]) {
      const response = await request(app)
        .get("/api/my-perfect-menu/concepts")
        .set("If-None-Match", validator ?? '"older-representation"')
        .expect(200);
      validator = response.headers.etag;
      expect(response.body.categories.breakfast).toEqual(concepts);
      expect(response.body.categories.breakfast.map((item: { id: string }) => item.id))
        .toContain(selectedId);
    }
  });
});