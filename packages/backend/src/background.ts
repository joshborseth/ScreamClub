import type * as Cloudflare from "alchemy/Cloudflare";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";

type WaitUntil = Cloudflare.Workers.WorkerExecutionContext["Service"]["waitUntil"];

/**
 * Runs work after the response is sent. The Worker's `fetch` provides the live
 * `waitUntil`: HttpRouter handlers run with the context captured at startup,
 * where Alchemy's WorkerExecutionContext cannot be used.
 */
export const RunInBackground = Context.Reference<WaitUntil>(
  "scream-club/RunInBackground",
  { defaultValue: () => (effect) => Effect.ignore(Effect.asVoid(effect)) },
);
