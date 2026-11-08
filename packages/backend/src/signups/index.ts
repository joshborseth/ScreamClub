import { Api } from "@scream-club/api";
import { RateLimited } from "@scream-club/api/signups/sign-up";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { RunInBackground } from "../background.ts";
import { makeConfirmationSender } from "./confirmation.ts";
import { toDisplayName, validate } from "./signup.ts";
import { makeSignupStore } from "./store.ts";

const optionalText = (name: string) =>
  Config.option(Config.NonEmptyString(name));

export const SignupsLive = Effect.gen(function* () {
  const store = yield* makeSignupStore;
  const sendConfirmation = yield* makeConfirmationSender;
  const limiter = yield* Cloudflare.RateLimit("SIGNUP_LIMITER", {
    namespaceId: 1001,
    simple: { limit: 5, period: 60 },
  });
  const event = {
    date: yield* optionalText("EVENT_DATE"),
    location: yield* optionalText("EVENT_LOCATION"),
  };

  const confirm = Effect.fn("Signups.confirm")(function* (signup: Parameters<typeof sendConfirmation>[0]) {
    if (yield* sendConfirmation(signup, event)) {
      yield* store.markConfirmationSent(signup.id);
    }
  }, Effect.catchCause((cause) => Effect.logError("Confirmation email failed", cause)));

  return HttpApiBuilder.group(Api, "Signups", (handlers) =>
    handlers
      .handle(
        "getSheet",
        Effect.fn("Signups.getSheet")(function* () {
          const names = yield* store.names();
          return { event, count: names.length, names: names.map(toDisplayName) };
        }),
      )
      .handle(
        "signUp",
        Effect.fn("Signups.signUp")(function* ({ payload, request }) {
          const key = Option.getOrElse(
            Option.fromNullishOr(request.headers["cf-connecting-ip"]),
            () => "unknown",
          );
          const { success } = yield* limiter.limit({ key }).pipe(Effect.orDie);
          if (!success) {
            return yield* new RateLimited({
              message: "Too many tries. Give it a minute and try again.",
            });
          }

          if (payload.website) {
            return;
          }

          const signup = yield* validate(payload);
          // A repeat email gets the same response, so this can't reveal who has signed up.
          const id = yield* store.insert(signup);
          if (id !== undefined) {
            const runInBackground = yield* RunInBackground;
            yield* runInBackground(confirm({ ...signup, id }));
          }
        }),
      ),
  );
});
