import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import Api from "@scream-club/backend";
import { SITE_HOSTNAME } from "@scream-club/api/site";

const JOSHBORSETH_ZONE_ID = "a943c3068fa975762a581cad7ba786c1";

/** What Resend asks for to send from screamclub.joshborseth.com. */
const RESEND_DNS_RECORDS = [
  {
    id: "ResendDkim",
    type: "TXT",
    name: "resend._domainkey.screamclub.joshborseth.com",
    content:
      "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDDz4WOu0BgFINeRNA5WdbYClOmTUHZtrLpcwiLBwuuaGd23L91kVjpEbyFOP+VS26fAHRa/P8MhGrEbk6Mn3a9fXYUB1IVKLv4ZCwa/Idx1u3E0KU5Ic7mSTqsvJaUVHRWNmeFUzd8+PuF09xdU8zSpX5m0vyDFrXHy/o+V/oz+QIDAQAB",
  },
  {
    id: "ResendSend",
    type: "CNAME",
    name: "send.screamclub.joshborseth.com",
    content: "send.forge.rmta.net",
  },
  {
    id: "ResendRsend",
    type: "CNAME",
    name: "rsend.screamclub.joshborseth.com",
    content: "rsend.forge.rmta.net",
  },
] as const;

export default Alchemy.Stack(
  "ScreamClub",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Drizzle.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const api = yield* Api;
    const stage = yield* Alchemy.Stage;
    // The custom domain needs the joshborseth.com zone to be active on Cloudflare.
    const skipDomain = yield* Config.Boolean("SKIP_CUSTOM_DOMAIN").pipe(
      Config.withDefault(false),
    );

    const web = yield* Cloudflare.Website.Foldkit("Web", {
      rootDir: "packages/frontend",
      env: {
        VITE_API_URL: api.url.as<string>(),
      },
      ...(stage === "prod" && !skipDomain ? { domain: SITE_HOSTNAME } : {}),
    });

    if (stage === "prod") {
      yield* Effect.forEach(RESEND_DNS_RECORDS, ({ id, ...record }) =>
        Cloudflare.DNS.Record(id, { zoneId: JOSHBORSETH_ZONE_ID, ...record }),
      );
    }

    return {
      apiUrl: api.url,
      url: web.url,
    };
  }),
);
