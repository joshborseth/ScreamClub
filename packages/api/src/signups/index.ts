import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import { GetSheet } from "./get-sheet.ts";
import { SignUp } from "./sign-up.ts";

export class Signups extends HttpApiGroup.make("Signups")
  .add(GetSheet)
  .add(SignUp) {}
