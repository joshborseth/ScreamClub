import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";

const MAX_FIELD_CHARS = 1024;
const Field = Schema.String.check(Schema.isMaxLength(MAX_FIELD_CHARS));

/** What the form sends. The handler cleans and validates it into a Signup. */
export const SignUpForm = Schema.Struct({
  name: Field,
  email: Field,
  /** Honeypot: hidden from people, so anything in it came from a bot. */
  website: Schema.optional(Field),
});
export type SignUpForm = typeof SignUpForm.Type;

export class InvalidSignup extends Schema.TaggedError<InvalidSignup>()(
  "InvalidSignup",
  { message: Schema.String },
  { httpApiStatus: 400 },
) {}

export class RateLimited extends Schema.TaggedError<RateLimited>()(
  "RateLimited",
  { message: Schema.String },
  { httpApiStatus: 429 },
) {}

/** POST a name to the sheet. A repeat email succeeds without adding a row. */
export const SignUp = HttpApiEndpoint.post("signUp", "/api/signups", {
  payload: SignUpForm,
  success: HttpApiSchema.Created,
  error: [InvalidSignup, RateLimited],
});
