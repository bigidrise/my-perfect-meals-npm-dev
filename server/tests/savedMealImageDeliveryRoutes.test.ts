import fs from "node:fs";
import ts from "typescript";
import { z } from "zod";
import * as delivery from "../services/imageDeliveryRecovery";

// Exercise the actual registered handlers without booting workers, opening the
// shared database, signing in, or writing any real saved meals/media.
const source = ts.createSourceFile(
  "server/routes.ts", fs.readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true,
);
function handler(method: string, path: string, scope: Record<string, unknown>) {
  let found: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === method && node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === path) {
      found = node.arguments[node.arguments.length - 1];
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!found) throw new Error(`Missing registered ${method} ${path}`);
  const js = ts.transpileModule(`return (${found.getText(source)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(scope), js)(...Object.values(scope));
}

const thumb = "/public-objects/replit-objstore-test/meal-images/original-thumb.jpg";
const display = "/public-objects/replit-objstore-test/meal-images/original-display.jpg";
const row = {
  id: "saved-meal", mediaAssetId: "owned-asset", userId: "viewer",
  title: "Original recipe", sourceType: "create-dish", createdAt: new Date(),
  assetStatus: "failed", assetProcessingError: "delivery_missing",
  assetThumbnailUrl: thumb, assetDisplayUrl: display,
  mealData: { imageUrl: thumb, ingredients: ["salmon"], servings: 2 },
};
const meals = { id: "meal-id", userId: "owner-id", mediaAssetId: "asset-id" };
const assets = { id: "media-id" };
const users = { id: "user-id" };
function response() {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}
const writes = () => ({
  update: jest.fn(() => { throw new Error("Viewing an image must not update shared records"); }),
  insert: jest.fn(() => { throw new Error("Viewing an image must not insert records"); }),
  delete: jest.fn(() => { throw new Error("Viewing an image must not delete records"); }),
});
const baseScope = () => ({
  ...delivery, z, savedMealsTable: meals, mediaAssetsTable: assets, users,
  eq: jest.fn((column, value) => [column, value]),
  and: (...conditions: unknown[]) => conditions,
  desc: (column: unknown) => column,
  sql: () => "count",
});

test.each(["/api/saved-meals", "/api/saved-meals/:id"])(
  "%s returns the existing image for a stale delivery failure, without a write", async path => {
    const scope = baseScope();
    const db = {
      ...writes(),
      select: jest.fn((fields: Record<string, unknown>) => {
        let table: unknown;
        const query: any = {
          from: (value: unknown) => { table = value; return query; },
          then: (resolve: any, reject: any) => Promise.resolve(table === users ? [] :
            "count" in fields ? [{ count: 1 }] :
            [Object.fromEntries(Object.keys(fields).map(key => [key, (row as any)[key]]))])
            .then(resolve, reject),
        };
        for (const name of ["where", "leftJoin", "orderBy", "limit", "offset"]) query[name] = () => query;
        return query;
      }),
    };
    const res = response();
    await handler("get", path, { ...scope, db })(
      { authUser: { id: "viewer" }, query: {}, params: { id: row.id } }, res,
    );
    const body = res.json.mock.calls[0][0];
    const result = path.endsWith(":id") ? body : body.meals[0];
    expect(result).toMatchObject({
      thumbnailUrl: thumb, displayUrl: display,
      mealData: { ...row.mealData, imageUrl: display },
    });
    expect(result).not.toHaveProperty("assetProcessingError");
    expect(scope.eq).toHaveBeenCalledWith("owner-id", "viewer");
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  },
);

test.each(["available", "missing", "alternate", "unavailable", "not-owned", "wrong-asset", "wrong-url"])(
  "delivery recovery is owner-bound and read-only for %s", async scenario => {
    const scope = baseScope();
    const rows = [
      scenario === "not-owned" ? [] : [{ id: row.id, mediaAssetId: row.mediaAssetId }],
      [{ id: row.mediaAssetId, thumbnailUrl: thumb,
        displayUrl: scenario === "alternate" ? display : thumb, originalObjectKey: null }],
    ];
    const db = { ...writes(), select: jest.fn(() => ({
      from: () => ({ where: () => ({ limit: async () => rows.shift() }) }),
    })) };
    class StorageUnavailableError extends Error {}
    const resolve = jest.fn(async (path: string) => {
      if (scenario === "unavailable") throw new StorageUnavailableError("temporary outage");
      return scenario === "available" || scenario === "alternate" && path.endsWith("display.jpg")
        ? { bucketId: "test", objectName: path } : null;
    });
    class ObjectStorageService { resolvePublicObjectPath = resolve; }
    const res = response();
    await handler("post", "/api/media/image-delivery-recovery", {
      ...scope, db, ObjectStorageService, StorageUnavailableError,
    })({ authUser: { id: "viewer" }, body: {
      savedMealId: row.id,
      mediaAssetId: scenario === "wrong-asset" ? "another-asset" : row.mediaAssetId,
      imageUrl: scenario === "wrong-url" ? "/public-objects/another-image.jpg" : thumb,
    } }, res);
    if (scenario === "not-owned" || scenario === "wrong-asset") {
      expect(res.status).toHaveBeenCalledWith(404);
      expect(resolve).not.toHaveBeenCalled();
    } else if (scenario === "wrong-url") {
      expect(res.status).toHaveBeenCalledWith(409);
      expect(resolve).not.toHaveBeenCalled();
    } else {
      expect(res.json.mock.calls[0][0]).toMatchObject(scenario === "missing"
        ? { status: "unavailable", reason: "missing" }
        : scenario === "alternate" ? { status: "recovered", imageUrl: display }
        : { status: "retry", imageUrl: thumb });
    }
    expect(scope.eq).toHaveBeenCalledWith("owner-id", "viewer");
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  },
);
