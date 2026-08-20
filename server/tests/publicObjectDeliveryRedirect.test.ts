import {
  GENERATED_DEPLOYMENT_ORIGIN,
  getPublicObjectDeliveryRedirect,
} from "../services/publicObjectDeliveryRedirect";

let failed = 0;

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    failed += 1;
    console.error(`FAIL: ${message}\n  expected: ${expected}\n  actual:   ${actual}`);
  } else {
    console.log(`PASS: ${message}`);
  }
}

const objectPath =
  "/public-objects/replit-objstore-2a68d585-4c50-4c2e-a7ff-a9973358bc5b/meal-images/sample.jpg?image-retry=1";

assertEqual(
  getPublicObjectDeliveryRedirect("app.myperfectmeals.ai", objectPath),
  `${GENERATED_DEPLOYMENT_ORIGIN}${objectPath}`,
  "redirects custom-domain public objects to the generated deployment host",
);
assertEqual(
  getPublicObjectDeliveryRedirect("APP.MYPERFECTMEALS.AI.", objectPath),
  `${GENERATED_DEPLOYMENT_ORIGIN}${objectPath}`,
  "normalizes custom-domain host casing and trailing dot",
);
assertEqual(
  getPublicObjectDeliveryRedirect("my-perfect-meals-npm-dev-1.replit.app", objectPath),
  null,
  "never redirects requests already on the generated deployment host",
);
assertEqual(
  getPublicObjectDeliveryRedirect("app.myperfectmeals.ai", "/api/user/profile"),
  null,
  "never redirects non-image application requests",
);

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log("All public object delivery redirect checks passed.");
}