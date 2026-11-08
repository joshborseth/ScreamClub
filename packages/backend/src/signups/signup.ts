import * as Effect from "effect/Effect";
import { InvalidSignup, type SignUpForm } from "@scream-club/api/signups/sign-up";

const MAX_NAME_CHARS = 80;
const MAX_EMAIL_CHARS = 254;
const MAX_FIRST_NAME_CHARS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Signup {
  readonly name: string;
  readonly email: string;
}

const cleanName = (value: string): string =>
  value
    .normalize("NFC")
    .replace(/\p{C}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Cleans what the form sent, or fails with a message to show the visitor. */
export const validate = Effect.fn("Signups.validate")(function* (form: SignUpForm) {
  const name = cleanName(form.name);
  if (!/\p{L}/u.test(name) || [...name].length > MAX_NAME_CHARS) {
    return yield* new InvalidSignup({ message: "Please enter your name." });
  }

  const email = form.email.trim().toLowerCase();
  if (email.length > MAX_EMAIL_CHARS || !EMAIL_PATTERN.test(email)) {
    return yield* new InvalidSignup({ message: "Please enter a valid email address." });
  }

  const signup: Signup = { name, email };
  return signup;
});

/** What the public sheet shows: "Maya Rodriguez" becomes "Maya R." */
export const toDisplayName = (name: string): string => {
  const parts = name.split(" ");
  const first = [...(parts[0] ?? "")].slice(0, MAX_FIRST_NAME_CHARS).join("");
  const initial = parts.length > 1 ? parts.at(-1)?.match(/\p{L}/u)?.[0] : undefined;
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
};
