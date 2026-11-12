import { getTableConfig } from "drizzle-orm/pg-core";
import { mblAvatarState } from "../db/schema/mybestlife";

test("avatar state retains id primary key and the existing unique per-user relationship", () => {
  const config = getTableConfig(mblAvatarState);
  expect(config.columns.filter(column => column.primary).map(column => column.name)).toEqual(["id"]);
  expect(config.primaryKeys).toHaveLength(0);
  const user = config.columns.find(column => column.name === "user_id")!;
  expect(user.notNull).toBe(true);
  expect(user.isUnique).toBe(true);
  expect(user.uniqueName).toBe("mbl_avatar_state_user_id_unique");
});
