import { Array, Effect, Match, Option, Schema } from 'effect'
import { HttpApiClient } from 'effect/http-api'
import { Command, Dom, Http, Runtime, type Update } from 'foldkit'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'
import { modifyFields } from 'foldkit/struct'

import { Api } from '@scream-club/api'
import { Sheet } from '@scream-club/api/signups/sheet'

const API_URL = import.meta.env.VITE_API_URL

const MIN_ROWS = 7
const SPARE_ROWS = 2
const MAX_NAME_CHARS = 80
const MAX_EMAIL_CHARS = 254

const DONE_TITLE_ID = 'done-title'
const NAME_INPUT_ID = 'signup-name'

const CONNECTION_ERROR =
  "Couldn't reach the sheet. Check your connection and try again."
const GENERIC_ERROR = 'Something went wrong. Please try again.'

// MODEL

export const SheetState = defineTaggedUnion({
  Loading: {},
  Loaded: { sheet: Sheet },
  Failed: { maybeSheet: Schema.Option(Sheet) },
})
export type SheetState = typeof SheetState.Type

export const Submission = defineTaggedUnion({
  Editing: {},
  Submitting: {},
  Rejected: { message: Schema.String },
  Done: {},
})
export type Submission = typeof Submission.Type

export const Model = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  website: Schema.String,
  sheet: SheetState,
  submission: Submission,
})
export type Model = typeof Model.Type

// MESSAGE

export const Message = defineMessageUnion({
  UpdatedName: { value: Schema.String },
  UpdatedEmail: { value: Schema.String },
  UpdatedWebsite: { value: Schema.String },
  SubmittedForm: {},
  ClickedAddSomeoneElse: {},
  SucceededFetchSheet: { sheet: Sheet },
  FailedFetchSheet: {},
  SucceededSubmitSignup: {},
  FailedSubmitSignup: { message: Schema.String },
  CompletedFocusDoneTitle: {},
  CompletedFocusNameInput: {},
})
export type Message = typeof Message.Type

// COMMAND

const makeClient = HttpApiClient.make(Api, { baseUrl: API_URL })

export const FetchSheet = Command.define('FetchSheet', {
  messages: [Message.SucceededFetchSheet, Message.FailedFetchSheet],
  execute: makeClient.pipe(
    Effect.flatMap(client => client.Signups.getSheet()),
    Effect.map(sheet => Message.SucceededFetchSheet({ sheet })),
    Effect.catch(() => Effect.succeed(Message.FailedFetchSheet())),
    Effect.provide(Http.layer),
  ),
})

export const SubmitSignup = Command.define('SubmitSignup', {
  args: {
    name: Schema.String,
    email: Schema.String,
    website: Schema.String,
  },
  messages: [Message.SucceededSubmitSignup, Message.FailedSubmitSignup],
  execute: payload =>
    makeClient.pipe(
      Effect.flatMap(client => client.Signups.signUp({ payload })),
      Effect.as(Message.SucceededSubmitSignup()),
      Effect.catch(error =>
        Effect.succeed(
          Message.FailedSubmitSignup({
            message: Match.value(error).pipe(
              Match.withReturnType<string>(),
              Match.tag('InvalidSignup', 'RateLimited', ({ message }) => message),
              Match.tag('HttpClientError', ({ reason }) =>
                reason._tag === 'TransportError'
                  ? CONNECTION_ERROR
                  : GENERIC_ERROR,
              ),
              Match.orElse(() => GENERIC_ERROR),
            ),
          }),
        ),
      ),
      Effect.provide(Http.layer),
    ),
})

export const FocusDoneTitle = Command.define('FocusDoneTitle', {
  messages: [Message.CompletedFocusDoneTitle],
  execute: Dom.focus(`#${DONE_TITLE_ID}`).pipe(
    Effect.ignore,
    Effect.as(Message.CompletedFocusDoneTitle()),
  ),
})

export const FocusNameInput = Command.define('FocusNameInput', {
  messages: [Message.CompletedFocusNameInput],
  execute: Dom.focus(`#${NAME_INPUT_ID}`).pipe(
    Effect.ignore,
    Effect.as(Message.CompletedFocusNameInput()),
  ),
})

// UPDATE

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    UpdatedName: ({ value }) => ({
      model: modifyFields(model, { name: () => value }),
    }),

    UpdatedEmail: ({ value }) => ({
      model: modifyFields(model, { email: () => value }),
    }),

    UpdatedWebsite: ({ value }) => ({
      model: modifyFields(model, { website: () => value }),
    }),

    SubmittedForm: () =>
      model.submission._tag === 'Submitting'
        ? { model }
        : {
            model: modifyFields(model, {
              submission: () => Submission.Submitting(),
            }),
            commands: [
              SubmitSignup({
                name: model.name,
                email: model.email,
                website: model.website,
              }),
            ],
          },

    ClickedAddSomeoneElse: () => ({
      model: modifyFields(model, { submission: () => Submission.Editing() }),
      commands: [FocusNameInput()],
    }),

    SucceededFetchSheet: ({ sheet }) => ({
      model: modifyFields(model, { sheet: () => SheetState.Loaded({ sheet }) }),
    }),

    FailedFetchSheet: () => ({
      model: modifyFields(model, {
        sheet: current =>
          SheetState.Failed({ maybeSheet: currentSheet(current) }),
      }),
    }),

    SucceededSubmitSignup: () => ({
      model: modifyFields(model, {
        name: () => '',
        email: () => '',
        website: () => '',
        submission: () => Submission.Done(),
      }),
      commands: [FocusDoneTitle(), FetchSheet()],
    }),

    FailedSubmitSignup: ({ message: failure }) => ({
      model: modifyFields(model, {
        submission: () => Submission.Rejected({ message: failure }),
      }),
    }),

    CompletedFocusDoneTitle: () => ({ model }),

    CompletedFocusNameInput: () => ({ model }),
  })

const currentSheet = (state: SheetState): Option.Option<Sheet> =>
  SheetState.match(state, {
    Loading: () => Option.none(),
    Loaded: ({ sheet }) => Option.some(sheet),
    Failed: ({ maybeSheet }) => maybeSheet,
  })

// INIT

export const init: Runtime.ApplicationInit<Model, Message> = () => ({
  model: {
    name: '',
    email: '',
    website: '',
    sheet: SheetState.Loading(),
    submission: Submission.Editing(),
  },
  commands: [FetchSheet()],
})

// VIEW

const SCREAM_LETTERS: ReadonlyArray<readonly [string, string]> = [
  ['S', 'rotate(-3deg)'],
  ['c', 'translateY(3%) rotate(2deg)'],
  ['r', 'translateY(-3%) rotate(-1deg)'],
  ['e', 'translateY(2%) rotate(2deg)'],
  ['a', 'translateY(-2%) rotate(-2deg)'],
  ['m', 'rotate(3deg)'],
]

const CLUB_LETTERS: ReadonlyArray<readonly [string, string]> = [
  ['C', 'rotate(2deg)'],
  ['l', 'translateY(-3%) rotate(-2deg)'],
  ['u', 'translateY(2%) rotate(1deg)'],
  ['b', 'translateY(-2%) rotate(-3deg)'],
]

const SQUIGGLE_PATH =
  'M4 40 C 30 34, 44 46, 70 40 S 112 34, 136 40 S 172 46, 190 40 L 200 28 L 209 54 L 219 16 L 230 64 L 241 6 L 253 69 L 266 3 L 279 68 L 291 8 L 303 62 L 314 17 L 324 54 L 333 30 L 344 40 C 366 46, 384 34, 410 40 S 452 46, 478 40 S 530 34, 556 40'

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: 'Scream Club',
  body: h.main(
    [],
    [
      heroView(model.sheet, h),
      h.section(
        [h.Class('wood'), h.AriaLabelledBy('sheet-title')],
        [
          h.div(
            [h.Class('sheet-wrap')],
            [
              h.div([h.Class('clip'), h.AriaHidden(true)]),
              h.div(
                [h.Class('sheet')],
                [
                  h.h2(
                    [h.Class('title'), h.Id('sheet-title')],
                    ['Sign-up sheet'],
                  ),
                  model.submission._tag === 'Done'
                    ? doneView(h)
                    : formView(model, h),
                  listHeadView(model.sheet, h),
                  namesView(currentSheet(model.sheet), h),
                  loadErrorView(model.sheet, h),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  ),
})

const lettersView = (
  letters: ReadonlyArray<readonly [string, string]>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  Array.map(letters, ([letter, transform]) =>
    h.span([h.Style({ transform })], [letter]),
  )

const heroView = (sheet: SheetState, h: HtmlBuilder<Message>): Html => {
  const maybeSheet = currentSheet(sheet)
  const date = Option.flatMap(maybeSheet, ({ event }) => event.date)
  const location = Option.flatMap(maybeSheet, ({ event }) => event.location)

  return h.section(
    [h.Class('hero')],
    [
      h.h1(
        [h.Class('logo')],
        [
          h.span([h.Class('sr-only')], ['Scream Club']),
          h.span(
            [h.AriaHidden(true)],
            [
              h.span([h.Class('row')], lettersView(SCREAM_LETTERS, h)),
              h.span([h.Class('row club')], lettersView(CLUB_LETTERS, h)),
            ],
          ),
        ],
      ),
      h.svg(
        [
          h.Class('squiggle'),
          h.ViewBox('0 0 560 72'),
          h.Fill('none'),
          h.AriaHidden(true),
        ],
        [
          h.path([
            h.D(SQUIGGLE_PATH),
            h.Stroke('#AE4F2A'),
            h.StrokeWidth('4'),
            h.StrokeLinecap('round'),
            h.StrokeLinejoin('round'),
          ]),
        ],
      ),
      h.p(
        [h.Class('tagline')],
        ['Come as you are. Scream it out. Leave a little lighter.'],
      ),
      h.p(
        [h.Class('mantra')],
        [
          'Scream Club is a women-centered space, open to cis and trans women, and anyone who identifies as a woman. You don’t need to look a certain way to belong.',
        ],
      ),
      h.div(
        [h.Class('when')],
        [
          h.span(
            [h.Class('chip label')],
            [Option.getOrElse(date, () => 'Date TBD')],
          ),
          h.span(
            [h.Class('chip alt label')],
            [Option.getOrElse(location, () => 'Location TBD')],
          ),
        ],
      ),
    ],
  )
}

const formView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.form(
    [h.OnSubmit(Message.SubmittedForm())],
    [
      h.label(
        [h.Class('field')],
        [
          h.span([h.Class('label')], ['Your name']),
          h.input([
            h.Id(NAME_INPUT_ID),
            h.Name('name'),
            h.Type('text'),
            h.Autocomplete('name'),
            h.Maxlength(MAX_NAME_CHARS),
            h.Required(true),
            h.Value(model.name),
            h.OnInput(value => Message.UpdatedName({ value })),
          ]),
        ],
      ),
      h.label(
        [h.Class('field')],
        [
          h.span([h.Class('label')], ['Email']),
          h.input([
            h.Name('email'),
            h.Type('email'),
            h.Placeholder('you@example.com'),
            h.Autocomplete('email'),
            h.Maxlength(MAX_EMAIL_CHARS),
            h.Required(true),
            h.Value(model.email),
            h.OnInput(value => Message.UpdatedEmail({ value })),
          ]),
        ],
      ),
      h.div(
        [h.Class('trap'), h.AriaHidden(true)],
        [
          h.label(
            [],
            [
              'Website ',
              h.input([
                h.Name('website'),
                h.Type('text'),
                h.Tabindex(-1),
                h.Autocomplete('off'),
                h.Value(model.website),
                h.OnInput(value => Message.UpdatedWebsite({ value })),
              ]),
            ],
          ),
        ],
      ),
      h.button(
        [
          h.Class('btn'),
          h.Type('submit'),
          h.Disabled(model.submission._tag === 'Submitting'),
        ],
        ['Put me on the list'],
      ),
      model.submission._tag === 'Rejected'
        ? h.p([h.Class('error'), h.Role('alert')], [model.submission.message])
        : h.empty,
    ],
  )

const doneView = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('done')],
    [
      h.h3([h.Id(DONE_TITLE_ID), h.Tabindex(-1)], ["You're on the list"]),
      h.p([], ['Keep an eye on your inbox for a confirmation.']),
      h.button(
        [
          h.Class('again label'),
          h.Type('button'),
          h.OnClick(Message.ClickedAddSomeoneElse()),
        ],
        ['Add someone else'],
      ),
    ],
  )

const countLabel = (sheet: SheetState): string =>
  Option.match(currentSheet(sheet), {
    onNone: () => '',
    onSome: ({ count }) => (count === 0 ? 'Be the first' : `${count} so far`),
  })

const listHeadView = (sheet: SheetState, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class('list-head')],
    [
      h.span([h.Class('label')], ['On the list']),
      h.span([h.Class('label')], [countLabel(sheet)]),
    ],
  )

const namesView = (
  maybeSheet: Option.Option<Sheet>,
  h: HtmlBuilder<Message>,
): Html => {
  const names = Option.match(maybeSheet, {
    onNone: (): ReadonlyArray<string> => [],
    onSome: sheet => sheet.names,
  })
  const rows = Math.max(MIN_ROWS, names.length + SPARE_ROWS)

  return h.ol(
    [h.Class('names')],
    Array.makeBy(rows, index =>
      h.li(
        [],
        [
          h.span([h.Class('n')], [`${index + 1}`]),
          Option.getOrElse(Array.get(names, index), () => ' '),
        ],
      ),
    ),
  )
}

const loadErrorView = (sheet: SheetState, h: HtmlBuilder<Message>): Html =>
  sheet._tag === 'Failed'
    ? h.p(
        [h.Class('load-error'), h.Role('status')],
        ["The sheet couldn't load. Refresh to try again."],
      )
    : h.empty
