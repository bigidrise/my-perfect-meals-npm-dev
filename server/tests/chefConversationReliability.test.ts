import { PgDialect } from "drizzle-orm/pg-core";
import { chefMessageOrder, chefOlderMessageCursor, isUnambiguousChefClosing,
  chefClosingAcknowledgement } from "../services/coaching/conversationReliability";

const environment = process.env.NODE_ENV;
const dialect = new PgDialect();
afterEach(() => { process.env.NODE_ENV = environment; });

test.each(["asc", "desc"] as const)("Development %s history and cursor use the same stable tie-breaking tuple", direction => {
  process.env.NODE_ENV = "development";
  const order = dialect.sqlToQuery(chefMessageOrder(direction)).sql;
  expect(order).toBe(`created_at ${direction.toUpperCase()}, CASE role WHEN 'user' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END ${direction.toUpperCase()}, id ${direction.toUpperCase()}`);
  const cursor = dialect.sqlToQuery(chefOlderMessageCursor("synthetic-conversation", "synthetic-message"));
  expect(cursor.sql).toContain("(created_at, CASE role WHEN 'user' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END, id) <");
  expect(cursor.sql).toContain("AND conversation_id = $2");
  expect(cursor.params).toEqual(["synthetic-message", "synthetic-conversation"]);
});
test.each(["production", "test"])("%s uses the same stable history and conversation-scoped cursor", environment => {
  process.env.NODE_ENV = environment;
  expect(dialect.sqlToQuery(chefMessageOrder("asc")).sql).toBe("created_at ASC, CASE role WHEN 'user' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END ASC, id ASC");
  expect(dialect.sqlToQuery(chefMessageOrder("desc")).sql).toBe("created_at DESC, CASE role WHEN 'user' THEN 0 WHEN 'assistant' THEN 1 ELSE 2 END DESC, id DESC");
  const cursor = dialect.sqlToQuery(chefOlderMessageCursor("synthetic-conversation", "synthetic-message"));
  expect(cursor.sql).toContain("AND conversation_id = $2");
  expect(cursor.params).toEqual(["synthetic-message", "synthetic-conversation"]);
});
test.each([
  "Thanks", "Thank you, how do I get more protein", "I'm done with dieting",
  "Thanks, that's all I needed?", "Goodbye, I can't breathe", "Bye. I need help",
  "That's all I needed\nPlease open Craving Creator", "No thanks, not all",
])("the whole-message closing matcher rejects ambiguous or substantive content: %s", message => {
  expect(isUnambiguousChefClosing(message)).toBe(false);
});
test("the brief acknowledgement preserves supported language selection", () => {
  expect(chefClosingAcknowledgement()).toBe("You're welcome. Take care!");
  expect(chefClosingAcknowledgement("es-MX")).toBe("De nada. ¡Cuídate!");
  expect(chefClosingAcknowledgement("tl")).toBe("Walang anuman. Ingat!");
});
