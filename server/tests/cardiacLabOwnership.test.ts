const mockSelect = jest.fn();
const mockTransaction = jest.fn();
const mockResolve = jest.fn();
jest.mock("../db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));
jest.mock("../services/resolveProtocolFromLabs", () => ({
  resolveProtocolFromLabs: (...args: unknown[]) => mockResolve(...args),
  resolveThyroidFromLabs: jest.fn(),
  resolveHormoneFromLabs: jest.fn(),
}));

import {
  discontinueLabDrivenCardiac, getLabDrivenConditions,
} from "../services/labProtocolOwnership";

const chain = (rows: unknown[]) => ({
  from: () => ({
    where: () => ({
      orderBy: () => ({ limit: async () => rows }),
      limit: async () => rows,
      for: () => ({ limit: async () => rows }),
    }),
  }),
});

describe("lab-derived Cardiac choice", () => {
  let latestChoice: { status: string } | undefined;
  let labRows: unknown[];
  const insertValues = jest.fn();
  const updateWhere = jest.fn();
  const updateSet = jest.fn(() => ({ where: updateWhere }));
  beforeEach(() => {
    jest.clearAllMocks();
    latestChoice = undefined;
    labRows = [{ ldl: 190, recordedAt: new Date() }];
    mockResolve.mockReturnValue({ protocol: "heart-failure" });
    mockSelect.mockImplementation((fields?: Record<string, unknown>) => {
      if (fields?.assignedBuilder) return chain([]);
      if (fields?.status) return chain(latestChoice ? [latestChoice] : []);
      return chain(labRows);
    });
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        select: () => chain([{
          specialtyConditions: ["cardiac", "renal"],
          specialtyCondition: "cardiac",
        }]),
        insert: () => ({ values: insertValues }),
        update: () => ({ set: updateSet }),
      }));
  });

  it("uses a current lab signal until the subject explicitly turns it off", async () => {
    expect(await getLabDrivenConditions("subject")).toEqual(["cardiac"]);
    latestChoice = { status: "removed" };
    expect(await getLabDrivenConditions("subject")).toEqual([]);
    labRows = [{ ldl: 210, recordedAt: new Date() }];
    expect(await getLabDrivenConditions("subject")).toEqual([]);
    expect(mockResolve).toHaveBeenCalledWith(expect.objectContaining({ ldl: 190 }));
  });

  it("keeps other conditions and lab rows untouched while recording a durable off decision", async () => {
    expect(await discontinueLabDrivenCardiac("subject")).toEqual(["renal"]);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: "subject",
      recommendedProtocol: "heart-failure",
      status: "removed",
      reason: "subject_disabled_lab_cardiac_support",
    }));
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      specialtyConditions: ["renal"], specialtyCondition: "renal",
    }));
    expect(updateWhere).toHaveBeenCalled();
  });

  it("refuses to remove Cardiac while a physician controls the protocol", async () => {
    mockSelect.mockImplementation((fields?: Record<string, unknown>) =>
      fields?.assignedBuilder ? chain([{ assignedBuilder: "anti_inflammatory" }]) : chain([]));
    await expect(discontinueLabDrivenCardiac("subject")).rejects.toThrow(/Physician/);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("fails closed if the physician lock cannot be checked", async () => {
    mockSelect.mockImplementation(() => {
      throw new Error("database unavailable");
    });
    await expect(discontinueLabDrivenCardiac("subject")).rejects.toThrow("database unavailable");
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});