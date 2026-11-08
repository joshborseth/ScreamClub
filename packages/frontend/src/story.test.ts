import { Option } from 'effect'
import { Command, given, message, model, story } from 'foldkit/story'
import { modifyFields } from 'foldkit/struct'
import { describe, expect, test } from 'vitest'

import {
  FetchSheet,
  FocusDoneTitle,
  FocusNameInput,
  Message,
  Model,
  SheetState,
  Submission,
  SubmitSignup,
  update,
} from './main'

const sheet = {
  event: { date: Option.none(), location: Option.none() },
  count: 1,
  names: ['Maya R.'],
}

const editing = Model.make({
  name: 'Maya',
  email: 'maya@example.com',
  website: '',
  sheet: SheetState.Loaded({ sheet }),
  submission: Submission.Editing(),
})

describe('update', () => {
  test('submitting sends the form', () => {
    story(
      update,
      given(editing),
      message(Message.SubmittedForm()),
      model(next => {
        expect(next.submission).toEqual(Submission.Submitting())
      }),
      Command.expectExact(
        SubmitSignup({
          name: 'Maya',
          email: 'maya@example.com',
          website: '',
        }),
      ),
      Command.resolve(
        SubmitSignup,
        Message.FailedSubmitSignup({ message: 'nope' }),
      ),
    )
  })

  test('a second submit while one is in flight does nothing', () => {
    story(
      update,
      given(
        modifyFields(editing, { submission: () => Submission.Submitting() }),
      ),
      message(Message.SubmittedForm()),
      model(next => {
        expect(next.submission).toEqual(Submission.Submitting())
      }),
    )
  })

  test('success clears the form, focuses the heading, and reloads the sheet', () => {
    story(
      update,
      given(
        modifyFields(editing, { submission: () => Submission.Submitting() }),
      ),
      message(Message.SucceededSubmitSignup()),
      model(next => {
        expect(next.submission).toEqual(Submission.Done())
        expect(next.name).toBe('')
        expect(next.email).toBe('')
      }),
      Command.expectExact(FocusDoneTitle(), FetchSheet()),
      Command.resolve(FocusDoneTitle, Message.CompletedFocusDoneTitle()),
      Command.resolve(
        FetchSheet,
        Message.SucceededFetchSheet({ sheet }),
      ),
    )
  })

  test('a failed reload keeps the names already on screen', () => {
    story(
      update,
      given(editing),
      message(Message.FailedFetchSheet()),
      model(next => {
        expect(next.sheet).toEqual(
          SheetState.Failed({ maybeSheet: Option.some(sheet) }),
        )
      }),
    )
  })

  test('adding someone else returns to the form and focuses the name', () => {
    story(
      update,
      given(modifyFields(editing, { submission: () => Submission.Done() })),
      message(Message.ClickedAddSomeoneElse()),
      model(next => {
        expect(next.submission).toEqual(Submission.Editing())
      }),
      Command.expectExact(FocusNameInput()),
      Command.resolve(FocusNameInput, Message.CompletedFocusNameInput()),
    )
  })
})
