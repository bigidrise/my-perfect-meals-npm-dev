// No import-time effects, credentials, default network transport or application imports.
import { comparisonPlan, assertRequest, safeRequestId, LIMITS } from "./contract.mjs";
import { MODELS, SETTINGS, VERIFIER } from "./recipes.mjs";
import { inflateSync } from "node:zlib";

export function pngCRC(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i=0;i<8;i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function validateAuthorization(authorization, manifest, now = Date.now()) {
  comparisonPlan(manifest);
  if (authorization?.kind !== "explicit-image-comparison-authorization" ||
      authorization.context !== "development" ||
      authorization.manifestSha256 !== manifest.digest ||
      JSON.stringify(authorization.models) !== JSON.stringify(MODELS) ||
      JSON.stringify(authorization.settings) !== JSON.stringify(SETTINGS) ||
      JSON.stringify(authorization.limits) !== JSON.stringify(LIMITS) ||
      authorization.verifier !== VERIFIER ||
      authorization.acceptsNonGuaranteedBillingCap !== true ||
      authorization.allowTemporaryPrivateArtifacts !== true ||
      !/^[a-z0-9-]{8,64}$/.test(authorization.runId ?? "") ||
      !Number.isFinite(Date.parse(authorization.expiresAt)) ||
      Date.parse(authorization.expiresAt) <= now ||
      Date.parse(authorization.expiresAt) > now + 60 * 60 * 1000) {
    throw new Error("Explicit, matching, unexpired Development authorization required");
  }
}
async function limitedJSON(response) {
  const max = 32 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > max ||
      !response.headers.get("content-type")?.includes("application/json")) throw new Error("Response contract failed");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response stream unavailable");
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new Error("Response exceeds review limit");
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    await reader.cancel().catch(() => {});
    throw new Error("Invalid or oversized provider response");
  }
}
export function validatePNG(image) {
  if (typeof image !== "string" || !/^[A-Za-z0-9+/]+=*$/.test(image)) throw new Error("PNG required");
  const bytes = Buffer.from(image, "base64");
  if (bytes.length < 33 || bytes.length > 20 * 1024 * 1024 ||
      bytes.subarray(0,8).toString("hex") !== "89504e470d0a1a0a" ||
      bytes.subarray(12,16).toString() !== "IHDR" ||
      bytes.readUInt32BE(16) !== 1024 || bytes.readUInt32BE(20) !== 1024) throw new Error("1024 square PNG required");
  let offset=8, ended=false;
  const compressed=[];
  while (offset < bytes.length) {
    const length=bytes.readUInt32BE(offset);
    if (length > bytes.length-offset-12) throw new Error("Truncated PNG");
    const type=bytes.subarray(offset+4,offset+8).toString();
    const chunk=bytes.subarray(offset+4,offset+8+length);
    if (pngCRC(chunk) !== bytes.readUInt32BE(offset+8+length)) throw new Error("PNG checksum mismatch");
    if (type==="IDAT") compressed.push(bytes.subarray(offset+8,offset+8+length));
    offset += length+12;
    if (type==="IEND") { ended=length===0 && offset===bytes.length; break; }
  }
  if (!ended || !compressed.length || !inflateSync(Buffer.concat(compressed),{maxOutputLength:16*1024*1024}).length) throw new Error("Incomplete PNG image");
  return bytes;
}
export function createLiveTransport({ manifest, authorization, fetchImpl, loadCredential, now = () => Date.now() }) {
  validateAuthorization(authorization, manifest, now());
  if (typeof fetchImpl !== "function" || typeof loadCredential !== "function") throw new Error("Explicit dependencies required");
  const plan = comparisonPlan(structuredClone(manifest));
  let stopped = false, inFlight = false, generations = 0, verifications = 0;
  let currentImage, reserved = 0, phase = "generation", currentCell;
  return async (stage, request, cell, signal) => {
    validateAuthorization(authorization, manifest, now());
    if (stopped || inFlight || signal.aborted) throw new Error("Transport stopped or busy");
    const approvedCell = stage === "generation" ? plan[generations] : plan[generations-1];
    if (!approvedCell || cell.id !== approvedCell.id) throw new Error("Unapproved comparison cell");
    assertRequest(stage, request, approvedCell);
    if (stage === "generation") {
      if (phase !== "generation" || generations >= LIMITS.generationRequests ||
          cell.id !== plan[generations]?.id ||
          JSON.stringify(request) !== JSON.stringify(plan[generations].generation) ||
          reserved + LIMITS.reservationUSD > LIMITS.runAllowanceUSD) throw new Error("Run scope exceeded");
      reserved += LIMITS.reservationUSD; generations++; currentCell = cell.id; phase = "verification";
    } else {
      if (phase !== "verification" || currentCell !== cell.id ||
          verifications >= LIMITS.verificationRequests ||
          request.body.messages[0].content[1].image_url.url !== `data:image/png;base64,${currentImage}`) throw new Error("Verification scope exceeded");
      verifications++; phase = "generation";
    }
    inFlight = true;
    signal.addEventListener("abort", () => { stopped = true; }, { once: true });
    try {
      // Never return, log, persist or interpolate this credential into errors.
      const key = loadCredential();
      if (typeof key !== "string" || !key.length || /[\r\n]/.test(key)) throw new Error("Credential unavailable");
      const response = await fetchImpl(request.url, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(request.body), signal, redirect: "manual",
      });
      if (signal.aborted) throw new Error("Unconfirmed abort");
      if (response.status !== 200) {
        stopped = true;
        await response.body?.cancel().catch(() => {});
        return { status: response.status, requestId: safeRequestId(response.headers.get("x-request-id")), body: {} };
      }
      const body = await limitedJSON(response);
      if (signal.aborted) throw new Error("Unconfirmed abort");
      if (stage === "generation") {
        try {
          if (body.data?.length !== 1 || body.data[0].url) throw new Error("Single inline image required");
          validatePNG(body.data[0].b64_json);
          currentImage = body.data[0].b64_json;
        } catch {
          stopped = true;
          body.data = []; // Preserve safe request/usage evidence, never publish bad bytes.
        }
      }
      const requestId = safeRequestId(response.headers.get("x-request-id"));
      if (!requestId) throw new Error("Request evidence unavailable");
      return { status: response.status, requestId, body };
    } catch {
      stopped = true;
      throw new Error("Comparison transport failed; reservation retained; no retry");
    } finally { inFlight = false; }
  };
}
