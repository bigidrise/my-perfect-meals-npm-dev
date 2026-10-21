import express, { type Request, type RequestHandler, type Response } from "express";
import { IncomingMessage, ServerResponse } from "node:http";
import { Duplex } from "node:stream";
import type { Socket } from "node:net";
import { csrfProtection } from "../../lib/csrfProtection";
import { createAuthorityAdapter } from "../../services/pairingAdvisor/authorityAdapter";
import { createSafetyAdapter } from "../../services/pairingAdvisor/safetyAdapter";
import { registerPairingAdvisor } from "../../services/pairingAdvisor/register";
import { createAdvisorRouter, ADVISOR_PATH, type RuntimeSnapshot } from "../../routes/pairingAdvisor";
import { createAdvisorRequestLimits } from "../../services/pairingAdvisor/requestLimits";
import { type IntentAssessment } from "../../../shared/pairingAdvisor/contracts";
import { assessment, educational, recommendation, request, reviewed } from "../pairingAdvisorOffline/fixtures";

if (!(globalThis as typeof globalThis & { __PAIRING_ADVISOR_OFFLINE__?: boolean }).__PAIRING_ADVISOR_OFFLINE__) {
  throw new Error("Use the guarded pairingAdvisorIntegration Jest configuration.");
}

export function snapshot() {
  return {
    source: "synthetic_fixture", ownerId: "synthetic-owner", subjectId: "synthetic-owner",
    scope: "account_owner",
    required: { allergies: true, protocols: true, clinical: true, nestedResolution: true },
    sideEffects: "none", constraints: "SYNTHETIC consumption constraints",
    consumptionGate: "eligible",
    envelope: { userId: "synthetic-owner", activeHouseholdProfileId: "synthetic-household", restricted: false },
  };
}

export function scenario() {
  const state: { authority: unknown; assessment: unknown } = { authority: snapshot(), assessment: { ...assessment } };
  const loadOwner = jest.fn(async (_options: { userId: string; personalSubject: true }) => state.authority);
  const ingredientGate = jest.fn((envelope: unknown) => (envelope as { restricted: boolean }).restricted);
  const inputCheck = jest.fn(async () => "pass" as "pass" | "restricted" | "unavailable");
  const protocolScan = jest.fn(async () => true);
  const alcoholScan = jest.fn(async () => true);
  const classify = jest.fn(async () => state.assessment);
  const generate = jest.fn(async (input: { prompt: { kind: string } }): Promise<unknown> => {
    if (input.prompt.kind === "education") return educational();
    const response = recommendation();
    response.recommendations[0].listEntryId = null;
    response.recommendations[0].claims = [];
    return response;
  });
  const review = jest.fn(async (response: Parameters<typeof reviewed>[0]): Promise<unknown> => reviewed(response));
  const deps = {
    mode: "synthetic_test_only" as const,
    resolveAuthority: createAuthorityAdapter({ mode: "synthetic_test_only", loadOwner, requiresVerifiedIngredients: ingredientGate }),
    safety: createSafetyAdapter({ mode: "synthetic_test_only", checkInput: inputCheck, scanGeneratedOutput: protocolScan, scanAlcohol: alcoholScan }),
    classify, generate, review,
  };
  return { state, loadOwner, ingredientGate, inputCheck, protocolScan, alcoholScan, classify, generate, review, deps };
}

/** Synthetic security exercises order/denial, not a replacement for existing middleware. */
function syntheticSecurity() {
  const authenticate = jest.fn<ReturnType<RequestHandler>, Parameters<RequestHandler>>((req, res, next) => {
    const token = req.get("x-auth-token");
    if (!["owner", "inactive", "essential", "other"].includes(token ?? "")) {
      res.status(401).json({ code: "AUTH_REQUIRED" });
      return;
    }
    Object.assign(req, { authUser: {
      id: token === "other" ? "synthetic-other" : "synthetic-owner",
      active: token !== "inactive", pro: token !== "essential",
    } });
    next();
  });
  const activeAccess = jest.fn<ReturnType<RequestHandler>, Parameters<RequestHandler>>((req, res, next) => {
    if (!(req as Request & { authUser: { active: boolean } }).authUser.active) {
      res.status(403).json({ code: "AI_REQUIRES_SUBSCRIPTION" });
      return;
    }
    next();
  });
  const proAccess = jest.fn<ReturnType<RequestHandler>, Parameters<RequestHandler>>((req, res, next) => {
    if (!(req as Request & { authUser: { pro: boolean } }).authUser.pro) {
      res.status(403).json({ code: "PRO_REQUIRED" });
      return;
    }
    next();
  });
  return { authenticate, activeAccess, proAccess };
}

export function harness(options: {
  scenario?: ReturnType<typeof scenario>;
  runtime?: RuntimeSnapshot;
  defaultBinding?: boolean;
  directFactory?: boolean;
  now?: () => number;
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  const fixture = options.scenario ?? scenario();
  let runtime = options.runtime ?? { nodeEnv: "development" };
  const security = syntheticSecurity();
  app.use(csrfProtection);
  const routerOptions = {
    getRuntime: () => runtime, security,
    limits: createAdvisorRequestLimits(options.now),
    ...(options.defaultBinding ? {} : { synthetic: fixture.deps }),
  };
  const registered = options.directFactory
    ? (app.use(ADVISOR_PATH, createAdvisorRouter(routerOptions)), true)
    : registerPairingAdvisor(app, routerOptions);
  app.use((_req, res) => { res.status(404).json({ code: "NOT_FOUND" }); });
  app.use((_error: unknown, _req: Request, res: Response, _next: unknown) => {
    res.status(500).json({ code: "HARNESS_ERROR" });
  });

  return {
    fixture, security, registered,
    setRuntime(next: RuntimeSnapshot) { runtime = next; },
    async send(options: {
      body?: unknown; token?: string | null; origin?: string | null;
      csrf?: string | null; cookie?: boolean; path?: string; method?: string;
      extraHeaders?: Record<string, string>;
    } = {}): Promise<{ status: number; body: any; headers: ReturnType<ServerResponse["getHeaders"]> }> {
      // Real Express dispatch, but no listen(), supertest(), socket connect, or session store.
      const stream = new Duplex({ read() {}, write(_chunk, _encoding, done) { done(); } });
      const incoming = new IncomingMessage(stream as Socket);
      incoming.method = options.method ?? "POST";
      incoming.url = options.path ?? ADVISOR_PATH;
      incoming.headers = {
        host: "localhost:5000", "content-type": "application/json",
        ...options.extraHeaders,
      };
      if (options.token !== null) incoming.headers["x-auth-token"] = options.token ?? "owner";
      if (options.origin !== null) incoming.headers.origin = options.origin ?? "http://localhost:5000";
      if (options.csrf !== null) incoming.headers["x-csrf-token"] = options.csrf ?? "synthetic-csrf";
      Object.assign(incoming, {
        body: options.body ?? request(),
        session: options.cookie === false ? undefined : { userId: "synthetic-owner", csrfToken: "synthetic-csrf" },
      });
      const outgoing = new ServerResponse(incoming);
      return new Promise((resolve, reject) => {
        outgoing.end = ((chunk?: string | Buffer) => {
          try {
            const body = chunk ? JSON.parse(chunk.toString()) : null;
            outgoing.finished = true;
            resolve({ status: outgoing.statusCode, body, headers: outgoing.getHeaders() });
          } catch (error) { reject(error); }
          return outgoing;
        }) as ServerResponse["end"];
        app(incoming as Request, outgoing as Response);
      });
    },
  };
}

export function assessmentFor(intent: IntentAssessment["intent"]): IntentAssessment {
  return { ...assessment, intent };
}
