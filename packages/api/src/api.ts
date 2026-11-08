import * as HttpApi from "effect/http-api/HttpApi";
import { Signups } from "./signups/index.ts";

export class Api extends HttpApi.make("Api").add(Signups) {}
