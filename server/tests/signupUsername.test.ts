import {
  createWithUniqueSignupUsername,
  isSignupEmailConflict,
  signupDatabaseError,
} from "../services/signupUsername";

function conflict(constraint: string, code = "23505") {
  return Object.assign(new Error("fixture database failure"), { code, constraint });
}

test("uses the preferred username when the database accepts it", async () => {
  const create = jest.fn().mockResolvedValue({ id: "new-fixture" });
  expect(await createWithUniqueSignupUsername("support", create)).toEqual({ id: "new-fixture" });
  expect(create).toHaveBeenCalledTimes(1);
  expect(create).toHaveBeenCalledWith("support");
});

test("handles multiple wrapped username collisions with independent random suffixes", async () => {
  const create = jest.fn()
    .mockRejectedValueOnce(new Error("wrapper", { cause: conflict("users_username_unique") }))
    .mockRejectedValueOnce(conflict("users_username_unique"))
    .mockRejectedValueOnce(conflict("users_username_unique"))
    .mockResolvedValue({ id: "new-fixture" });
  expect(await createWithUniqueSignupUsername("support", create)).toEqual({ id: "new-fixture" });
  const names = create.mock.calls.map(([name]) => name);
  expect(names[0]).toBe("support");
  expect(names.slice(1)).toEqual(expect.arrayContaining([
    expect.stringMatching(/^support-[a-f0-9]{24}$/),
  ]));
  expect(names.slice(1).every(name => /^support-[a-f0-9]{24}$/.test(name))).toBe(true);
  expect(new Set(names).size).toBe(4);
});

test("bounds retries even if every random candidate collides", async () => {
  const failure = conflict("users_username_unique");
  const create = jest.fn().mockRejectedValue(failure);
  await expect(createWithUniqueSignupUsername("support", create)).rejects.toBe(failure);
  expect(create).toHaveBeenCalledTimes(5);
});

test.each([
  ["users_email_unique", "23505"],
  ["unrelated_table_unique", "23505"],
  ["users_username_unique", "40P01"],
  ["users_username_unique", "08006"],
])("never retries %s with database code %s", async (constraint, code) => {
  const failure = conflict(constraint, code);
  const create = jest.fn().mockRejectedValue(failure);
  await expect(createWithUniqueSignupUsername("support", create)).rejects.toBe(failure);
  expect(create).toHaveBeenCalledTimes(1);
});

test("recognizes only the actual email constraint through wrapped errors", () => {
  expect(isSignupEmailConflict(new Error("wrapper", {
    cause: new Error("inner", { cause: conflict("users_email_unique") }),
  }))).toBe(true);
  expect(isSignupEmailConflict(conflict("users_username_unique"))).toBe(false);
  expect(isSignupEmailConflict(new Error("users_email_unique mentioned in a message"))).toBe(false);
});

test("error inspection is cycle-safe and exposes no query values", () => {
  const cyclic: any = { message: "private fixture values" };
  cyclic.cause = cyclic;
  expect(signupDatabaseError(cyclic)).toEqual({});
  const error = Object.assign(conflict("users_username_unique"), {
    detail: "private fixture values", params: ["private fixture values"],
  });
  expect(signupDatabaseError(error)).toEqual({ code: "23505", constraint: "users_username_unique" });
});
