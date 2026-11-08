import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import { Sheet } from "./sheet.ts";

/** GET the public sign-up sheet. */
export const GetSheet = HttpApiEndpoint.get("getSheet", "/api/signups", {
  success: Sheet,
});
