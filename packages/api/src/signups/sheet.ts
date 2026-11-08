import * as Schema from "effect/Schema";

/** The public sheet. Names are shortened to "Maya R."; emails never appear. */
export const Sheet = Schema.Struct({
  event: Schema.Struct({
    date: Schema.OptionFromNullOr(Schema.String),
    location: Schema.OptionFromNullOr(Schema.String),
  }),
  count: Schema.Number,
  names: Schema.Array(Schema.String),
});
export type Sheet = typeof Sheet.Type;
