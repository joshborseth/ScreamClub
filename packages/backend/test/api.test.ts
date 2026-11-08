import { expect } from "@effect/vitest";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle";
import * as Test from "alchemy/Test/Vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpBody from "effect/http/HttpBody";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import { Sheet } from "@scream-club/api/signups/sheet";
import ApiWorker from "../src/worker.ts";

const providers = Layer.mergeAll(Cloudflare.providers(), Drizzle.providers());

const Stack = Alchemy.Stack(
  "ScreamClubApiTest",
  { providers, state: Alchemy.localState() },
  Effect.gen(function* () {
    const api = yield* ApiWorker;
    return { url: api.url.as<string>() };
  }),
);

const { test, beforeAll, afterAll, deploy, destroy } = Test.make({
  providers,
  state: Alchemy.localState(),
});

const stack = beforeAll(deploy(Stack));

const flag = (name: string) =>
  Effect.runSync(Config.Boolean(name).pipe(Config.withDefault(false)));

afterAll.skipIf(flag("NO_DESTROY") || flag("ALCHEMY_DEV"))(destroy(Stack));

const unique = () => crypto.randomUUID();
const uniqueEmail = () => `${unique()}@example.com`;

const post = Effect.fn("post")(function* (body: unknown, ip: string = unique()) {
  const { url } = yield* stack;
  return yield* HttpClient.execute(
    HttpClientRequest.post(`${url}/api/signups`, {
      body: HttpBody.jsonUnsafe(body),
      headers: { "cf-connecting-ip": ip },
    }),
  );
});

const sheet = Effect.gen(function* () {
  const { url } = yield* stack;
  const response = yield* HttpClient.get(`${url}/api/signups`);
  expect(response.status).toBe(200);
  const json = yield* response.json;
  return { body: yield* Schema.decodeUnknownEffect(Sheet)(json), raw: JSON.stringify(json) };
});

test(
  "a signup appears on the sheet as a first name and initial, without the email",
  Effect.gen(function* () {
    const email = uniqueEmail();
    const response = yield* post({ name: "  Maya   Rodriguez ", email });
    expect(response.status).toBe(201);

    const { body, raw } = yield* sheet;
    expect(body.names).toContain("Maya R.");
    expect(raw).not.toContain("@example.com");
  }),
);

test(
  "a single name stays as it is",
  Effect.gen(function* () {
    expect((yield* post({ name: "Cher", email: uniqueEmail() })).status).toBe(201);
    expect((yield* sheet).body.names).toContain("Cher");
  }),
);

test(
  "a repeat email in a different case succeeds without adding a row",
  Effect.gen(function* () {
    const id = unique();
    const first = yield* post({ name: "First Person", email: `${id}@example.com` });
    expect(first.status).toBe(201);
    const before = (yield* sheet).body.count;

    const repeat = yield* post({ name: "Someone Else", email: `${id}@EXAMPLE.com` });
    expect(repeat.status).toBe(201);
    expect((yield* sheet).body.count).toBe(before);
  }),
);

test(
  "a filled honeypot looks successful but adds nothing",
  Effect.gen(function* () {
    const before = (yield* sheet).body.count;
    const response = yield* post({
      name: "Bot Person",
      email: uniqueEmail(),
      website: "http://spam.example",
    });
    expect(response.status).toBe(201);
    expect((yield* sheet).body.count).toBe(before);
  }),
);

test(
  "a bad email gets a message to show the visitor",
  Effect.gen(function* () {
    const response = yield* post({ name: "Dev", email: "nope" });
    expect(response.status).toBe(400);
    const body = yield* response.json;
    expect(body).toMatchObject({ message: "Please enter a valid email address." });
  }),
);

test(
  "a name with no letters is rejected",
  Effect.gen(function* () {
    const response = yield* post({ name: "12345", email: uniqueEmail() });
    expect(response.status).toBe(400);
    expect(yield* response.json).toMatchObject({ message: "Please enter your name." });
  }),
);

test(
  "html in a name is stored as text",
  Effect.gen(function* () {
    const name = `<b${unique().slice(0, 8)}>`;
    expect((yield* post({ name, email: uniqueEmail() })).status).toBe(201);
    expect((yield* sheet).body.names).toContain(name);
  }),
);

test(
  "an oversized field is rejected",
  Effect.gen(function* () {
    const response = yield* post({ name: "x".repeat(5000), email: uniqueEmail() });
    expect(response.status).toBe(400);
  }),
);

test(
  "the sixth try from one visitor within a minute is rate limited",
  Effect.gen(function* () {
    const ip = unique();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((yield* post({ name: "Dev", email: "nope" }, ip)).status).toBe(400);
    }
    const blocked = yield* post({ name: "Too Many", email: uniqueEmail() }, ip);
    expect(blocked.status).toBe(429);
    expect(yield* blocked.json).toMatchObject({
      message: "Too many tries. Give it a minute and try again.",
    });
  }),
);
