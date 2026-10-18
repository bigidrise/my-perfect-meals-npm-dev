import type { Request, Response } from "express";
const mockAuthorize = jest.fn();
jest.mock("../middleware/requireWorkspaceAccess", () => ({
  requireClientWorkspaceAccess: (...args: unknown[]) => mockAuthorize(...args),
}));
import {
  authorizedDevelopmentStudio,
  developmentClientConversationEnabled,
  requireDevelopmentClientConversation,
} from "../middleware/developmentClientConversation";

describe("authorized client conversation in every runtime", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
    mockAuthorize.mockReset();
  });
  it.each([
    ["development", undefined, true],
    ["development", "1", true],
    ["production", undefined, true],
    ["production", "1", true],
    ["test", undefined, true],
    [undefined, undefined, true],
  ])("enables runtime %s / deployment %s", (mode, deployment, expected) => {
    expect(developmentClientConversationEnabled({ NODE_ENV: mode as string, REPLIT_DEPLOYMENT: deployment as string })).toBe(expected);
  });
  it.each(["development", "production"])("delegates %s text authorization to the existing workspace middleware", mode => {
    process.env.NODE_ENV = mode;
    if (mode === "production") process.env.REPLIT_DEPLOYMENT = "1";
    else delete process.env.REPLIT_DEPLOYMENT;
    const req = {} as Request, res = {} as Response, next = jest.fn();
    requireDevelopmentClientConversation(req, res, next);
    expect(mockAuthorize).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
  it("preserves relationship denials in published Production", () => {
    process.env.NODE_ENV = "production";
    process.env.REPLIT_DEPLOYMENT = "1";
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    mockAuthorize.mockImplementation((_req, response) => {
      response.status(403).json({ error: "No active workspace access" });
    });
    requireDevelopmentClientConversation({} as Request, res as unknown as Response, next);
    expect(mockAuthorize).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it("uses only the authorized workspace, never account roles or a fallback Studio", () => {
    expect(authorizedDevelopmentStudio({ workspace: { studioId: "authorized-studio" }, authUser: { professionalRole: "business" } } as unknown as Request)).toBe("authorized-studio");
    expect(authorizedDevelopmentStudio({ authUser: { professionalRole: "physician" } } as unknown as Request)).toBeNull();
  });
});
