import { Option } from 'effect'
import {
  Command,
  click,
  expect as sceneExpect,
  given,
  label,
  role,
  scene,
  text,
  type,
} from 'foldkit/scene'
import { describe, test } from 'vitest'

import {
  FetchSheet,
  FocusDoneTitle,
  Message,
  Model,
  SheetState,
  Submission,
  SubmitSignup,
  update,
  view,
} from './main'

const sheet = {
  event: { date: Option.some('Friday'), location: Option.none() },
  count: 1,
  names: ['Maya R.'],
}

const loaded = Model.make({
  name: '',
  email: '',
  website: '',
  sheet: SheetState.Loaded({ sheet }),
  submission: Submission.Editing(),
})

describe('sign-up sheet', () => {
  test('shows the names, count, and event details', () => {
    scene(
      { update, view },
      given(loaded),
      sceneExpect(text('Maya R.')).toExist(),
      sceneExpect(text('1 so far')).toExist(),
      sceneExpect(text('Friday')).toExist(),
      sceneExpect(text('Location TBD')).toExist(),
    )
  })

  test('filling in the form puts the visitor on the list', () => {
    scene(
      { update, view },
      given(loaded),
      type(label('Your name'), 'Dev'),
      type(label('Email'), 'dev@example.com'),
      click(role('button', { name: 'Put me on the list' })),
      Command.expectExact(
        SubmitSignup({ name: 'Dev', email: 'dev@example.com', website: '' }),
      ),
      Command.resolve(SubmitSignup, Message.SucceededSubmitSignup()),
      Command.resolve(FocusDoneTitle, Message.CompletedFocusDoneTitle()),
      Command.resolve(FetchSheet, Message.SucceededFetchSheet({ sheet })),
      sceneExpect(text("You're on the list")).toExist(),
    )
  })

  test('a rejected signup shows the reason', () => {
    scene(
      { update, view },
      given(loaded),
      click(role('button', { name: 'Put me on the list' })),
      Command.resolve(
        SubmitSignup,
        Message.FailedSubmitSignup({
          message: 'Please enter a valid email address.',
        }),
      ),
      sceneExpect(role('alert')).toHaveText(
        'Please enter a valid email address.',
      ),
    )
  })
})
