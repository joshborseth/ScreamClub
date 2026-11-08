import { SITE_URL } from "@scream-club/api/site";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import type { Signup } from "./signup.ts";

const RESEND_URL = "https://api.resend.com/emails";
const TO_BE_ANNOUNCED = "to be announced";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

interface EventDetails {
  readonly date: Option.Option<string>;
  readonly location: Option.Option<string>;
}

const render = (signup: Signup, event: EventDetails) => {
  const firstName = signup.name.split(" ")[0] ?? signup.name;
  const when = Option.getOrElse(event.date, () => TO_BE_ANNOUNCED);
  const where = Option.getOrElse(event.location, () => TO_BE_ANNOUNCED);

  return {
    text: [
      `Hi ${firstName},`,
      "",
      "You're on the sheet for Scream Club.",
      "",
      `When: ${when}`,
      `Where: ${where}`,
      "",
      `See the sheet any time: ${SITE_URL}`,
      "",
      "Changed your mind? Reply to this email and we'll take you off the list.",
    ].join("\n"),
    html: `<div style="background:#F5F0E5;color:#2F4230;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;padding:32px 24px">
  <p style="margin:0 0 16px;font-size:24px;font-weight:bold;letter-spacing:.04em;text-transform:uppercase">You're on the list</p>
  <p style="margin:0 0 16px">Hi ${escapeHtml(firstName)}, you're on the sheet for Scream Club.</p>
  <p style="margin:0 0 16px"><strong>When:</strong> ${escapeHtml(when)}<br><strong>Where:</strong> ${escapeHtml(where)}</p>
  <p style="margin:0 0 16px"><a href="${escapeHtml(SITE_URL)}" style="color:#AE4F2A">See the sheet any time</a></p>
  <p style="margin:0;font-size:14px">Changed your mind? Reply to this email and we'll take you off the list.</p>
</div>`,
  };
};

/**
 * Sends confirmations through Resend. Emails tell people to reply to get off
 * the list, so nothing is sent until both the key and reply-to address are set.
 */
export const makeConfirmationSender = Effect.gen(function* () {
  const apiKey = yield* Config.option(Config.Redacted("RESEND_API_KEY"));
  const replyTo = yield* Config.option(Config.NonEmptyString("EMAIL_REPLY_TO"));
  const from = yield* Config.String("EMAIL_FROM").pipe(
    Config.withDefault("Scream Club <hello@screamclub.joshborseth.com>"),
  );

  return Effect.fn("Confirmation.send")(function* (
    signup: Signup & { readonly id: number },
    event: EventDetails,
  ) {
    if (Option.isNone(apiKey) || Option.isNone(replyTo)) {
      yield* Effect.logInfo("Skipping confirmation email: email is not configured");
      return false;
    }

    const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient);
    yield* HttpClientRequest.post(RESEND_URL).pipe(
      HttpClientRequest.bearerToken(Redacted.value(apiKey.value)),
      HttpClientRequest.setHeader("idempotency-key", `signup-confirmation-${signup.id}`),
      HttpClientRequest.bodyJsonUnsafe({
        from,
        to: [signup.email],
        reply_to: replyTo.value,
        subject: "You're on the list for Scream Club",
        ...render(signup, event),
      }),
      client.execute,
      Effect.timeout("10 seconds"),
    );
    return true;
  }, Effect.provide(FetchHttpClient.layer));
});
