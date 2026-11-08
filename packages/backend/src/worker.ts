import * as Cloudflare from "alchemy/Cloudflare";
import * as Http from "alchemy/Http";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import { Api } from "@scream-club/api";
import { RunInBackground } from "./background.ts";
import { SignupsLive } from "./signups/index.ts";

export default Cloudflare.Worker(
  "Api",
  { main: import.meta.url },
  Effect.gen(function* () {
    const signups = yield* SignupsLive;
    const api = yield* HttpRouter.toHttpEffect(
      HttpApiBuilder.layer(Api).pipe(
        Layer.provide(signups),
        Layer.provide(Http.Platform),
        Layer.provide(
          HttpRouter.cors({
            allowedOrigins: ["*"],
            allowedMethods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type"],
          }),
        ),
      ),
    );

    return {
      fetch: Effect.gen(function* () {
        const execution = yield* Cloudflare.Workers.WorkerExecutionContext;
        return yield* api.pipe(
          Effect.provideService(RunInBackground, execution.waitUntil),
        );
      }),
    };
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        Cloudflare.D1.QueryDatabaseBinding,
        Cloudflare.Workers.RateLimitBinding,
      ),
    ),
  ),
);
