import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle";
import { asc, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { signups } from "../db/schema.ts";
import type { Signup } from "./signup.ts";

/** The signups table, reached through Drizzle's Effect driver for D1. */
export const makeSignupStore = Effect.gen(function* () {
  const schema = yield* Drizzle.Schema("SignupsSchema", {
    schema: "./packages/backend/src/db/schema.ts",
    out: "./migrations",
    dialect: "sqlite",
  });
  const database = yield* Cloudflare.D1.Database("Signups", {
    primaryLocationHint: "wnam",
    migrations: schema,
  });
  const d1 = yield* Cloudflare.D1.QueryDatabase(database);
  const db = yield* Drizzle.D1(d1);

  return {
    names: Effect.fn("SignupStore.names")(function* () {
      const rows = yield* db
        .select({ name: signups.name })
        .from(signups)
        .orderBy(asc(signups.id));
      return rows.map((row) => row.name);
    }, Effect.orDie),

    /** The new row's id, or undefined when the email is already on the sheet. */
    insert: Effect.fn("SignupStore.insert")(function* (signup: Signup) {
      const rows = yield* db
        .insert(signups)
        .values(signup)
        .onConflictDoNothing({ target: signups.email })
        .returning({ id: signups.id });
      return rows[0]?.id;
    }, Effect.orDie),

    markConfirmationSent: Effect.fn("SignupStore.markConfirmationSent")(function* (id: number) {
      yield* db
        .update(signups)
        .set({ confirmationSentAt: sql`(datetime('now'))` })
        .where(eq(signups.id, id));
    }, Effect.orDie),
  };
});
