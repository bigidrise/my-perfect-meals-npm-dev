// This validates read readiness, never upload durability. Keep the existing
// write/read canary endpoint separate; release checks must not create objects.
function isReadableStorageResponse(status, body) {
  return status === 200 && body !== null && typeof body === "object" &&
    body.objectStorage === "readable" && body.probe === "read-only" &&
    body.writeVerified === false;
}

async function checkStorageHealth(baseUrl) {
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Invalid storage health target");
  }
  const response = await fetch(new URL("/api/health/storage", url), {
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  const body = await response.json();
  if (!isReadableStorageResponse(response.status, body)) {
    throw new Error("Object Storage configuration/read probe failed or returned an invalid contract");
  }
}

module.exports = { isReadableStorageResponse, checkStorageHealth };
if (require.main === module) {
  checkStorageHealth(process.argv[2]).then(
    () => console.log("Object Storage configuration and read access verified; uploads not tested"),
    () => { console.error("Object Storage configuration/read probe failed"); process.exitCode = 1; },
  );
}
