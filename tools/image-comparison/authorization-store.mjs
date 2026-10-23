import { readFileSync, lstatSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { validateAuthorization } from "./live-adapter.mjs";
import { privateDirectory, writePrivate } from "./review-artifacts.mjs";

export function claimAuthorization(file, manifest, root, now = Date.now()) {
  const dir = resolve(root,"authorizations"), authFile = resolve(file);
  if (dirname(authFile) !== dir || !/^[a-z0-9-]{8,64}\.json$/.test(authFile.split("/").pop())) throw new Error("Authorization path rejected");
  privateDirectory(dir);
  const stat = lstatSync(authFile);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) || stat.size > 16_384) throw new Error("Private authorization file required");
  const authorization = JSON.parse(readFileSync(authFile,"utf8"));
  validateAuthorization(authorization,manifest,now);
  // O_EXCL prevents simultaneous claims and replay, including after timeout/error.
  writePrivate(authFile+".consumed",JSON.stringify({
    runId:authorization.runId,manifestSha256:manifest.digest,
    reservedRiskUSD:authorization.limits.generationRequests*authorization.limits.reservationUSD,
    note:"One-shot claim. Execution may be uncertain after a crash. Risk reservation is NOT a provider billing cap or charge. Never automatically delete or replay.",
  }));
  return authorization;
}
