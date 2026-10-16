import type { Request, Response, NextFunction } from "express";
const mockAuthorize = jest.fn();
jest.mock("../middleware/requireWorkspaceAccess", () => ({
  requireClientWorkspaceAccess: (...args: unknown[]) => mockAuthorize(...args),
}));
import {
  authorizedDevelopmentStudio,
  developmentClientConversationEnabled,
  requireDevelopmentClientConversation,
} from "../middleware/developmentClientConversation";

describe("Development-only authorized client conversation", () => {
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
    ["development", "1", false],
    ["production", undefined, false],
    ["test", undefined, false],
    [undefined, undefined, false],
  ])("gates runtime %s / deployment %s", (mode, deployment, expected) => {
    expect(developmentClientConversationEnabled({ NODE_ENV: mode as string, REPLIT_DEPLOYMENT: deployment as string })).toBe(expected);
  });
  it("delegates Development text authorization to the existing workspace middleware", () => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    const req = {} as Request, res = {} as Response, next = jest.fn();
    requireDevelopmentClientConversation(req, res, next);
    expect(mockAuthorize).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });
  it("does not alter deployed authorization registration", () => {
    process.env.NODE_ENV = "production";
    const next = jest.fn();
    requireDevelopmentClientConversation({} as Request, {} as Response, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockAuthorize).not.toHaveBeenCalled();
  });
  it("uses only the authorized workspace, never account roles or a fallback Studio", () => {
    expect(authorizedDevelopmentStudio({ workspace: { studioId: "authorized-studio" }, authUser: { professionalRole: "business" } } as unknown as Request)).toBe("authorized-studio");
    expect(authorizedDevelopmentStudio({ authUser: { professionalRole: "physician" } } as unknown as Request)).toBeNull();
  });
});
