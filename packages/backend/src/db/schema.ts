import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const signups = sqliteTable("signups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  /** Stays NULL if the email failed, so missed confirmations can be found later. */
  confirmationSentAt: text("confirmation_sent_at"),
});
