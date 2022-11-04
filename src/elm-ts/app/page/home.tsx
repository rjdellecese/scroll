import type { NamedQuery } from "convex/browser";
import type { ConvexReactClient } from "convex/react";
import { cmd, html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { array, map, option, tuple } from "fp-ts";
import { apply, constVoid, identity, pipe } from "fp-ts/function";
import type { IO } from "fp-ts/lib/IO";
import type { Dispatch, ReactElement } from "react";
import React from "react";
import { match, P } from "ts-pattern";

import type { API } from "~src/convex/_generated/api";
import type { Document, Id } from "~src/convex/_generated/dataModel";
import { useQuery } from "~src/convex/_generated/react";
import { runMutation } from "~src/elm-ts/convex-elm-ts";
import * as logMessage from "~src/elm-ts/log-message";
import * as note from "~src/elm-ts/note";
import type { Stage } from "~src/elm-ts/stage";
import * as id from "~src/id";

// MODEl

export type Model =
  | { _tag: "LoadingNotes" }
  | { _tag: "LoadedNotes"; idsToNoteModels: Map<Id<"notes">, note.Model> };

export const init: Model = {
  _tag: "LoadingNotes",
};

// UPDATE

export type Msg =
  | { _tag: "CreateNoteButtonClicked" }
  | {
      _tag: "GotNotes";
      idsToNotes: Map<
        Id<"notes">,
        { proseMirrorDoc: string; creationTime: number; version: number }
      >;
    }
  | {
      _tag: "GotNoteMsg";
      noteId: Id<"notes">;
      msg: note.Msg;
    };

export const update =
  (stage: Stage, convex: ConvexReactClient<API>) =>
  (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
    match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
      .with([{ _tag: "CreateNoteButtonClicked" }, P.any], () => [
        model,
        runMutation(convex.mutation("createEmptyNote"), () => option.none),
      ])
      .with(
        [
          {
            _tag: "GotNotes",
            idsToNotes: P.select(),
          },
          { _tag: "LoadingNotes" },
        ],
        (idsToNotes) =>
          pipe(
            idsToNotes,
            map.reduceWithIndex<Id<"notes">>(id.getOrd<"notes">())<
              {
                idsToNoteModels: Map<Id<"notes">, note.Model>;
                cmds: Cmd<Msg>[];
              },
              {
                proseMirrorDoc: Document<"notes">["proseMirrorDoc"];
                creationTime: number;
                version: number;
              }
            >(
              {
                idsToNoteModels: new Map(),
                cmds: [],
              },
              (
                noteId,
                { idsToNoteModels, cmds },
                { proseMirrorDoc, creationTime, version }
              ) =>
                pipe(
                  note.init({ noteId, creationTime, proseMirrorDoc, version }),
                  tuple.mapSnd(
                    cmd.map(
                      (noteMsg): Msg => ({
                        _tag: "GotNoteMsg",
                        noteId,
                        msg: noteMsg,
                      })
                    )
                  ),
                  ([noteModel, cmd_]) => ({
                    idsToNoteModels: map.upsertAt(id.getEq<"notes">())(
                      noteId,
                      noteModel
                    )(idsToNoteModels),
                    cmds: array.append(cmd_)(cmds),
                  })
                )
            ),
            ({ idsToNoteModels, cmds }) => [
              { _tag: "LoadedNotes", idsToNoteModels },
              cmd.batch(cmds),
            ]
          )
      )
      .with(
        [
          {
            _tag: "GotNoteMsg",
            noteId: P.select("noteId"),
            msg: P.select("noteMsg"),
          },
          { _tag: "LoadedNotes", idsToNoteModels: P.select("idsToNoteModels") },
        ],
        ({ noteId, noteMsg, idsToNoteModels }) =>
          pipe(
            idsToNoteModels,
            map.lookup(id.getEq<"notes">())(noteId),
            option.map((noteModel) =>
              pipe(
                note.update(stage, convex)(noteMsg, noteModel),
                tuple.bimap(
                  cmd.map(
                    (editorMsg_): Msg => ({
                      _tag: "GotNoteMsg",
                      noteId,
                      msg: editorMsg_,
                    })
                  ),
                  (noteModel_): Model => ({
                    _tag: "LoadedNotes",
                    idsToNoteModels: map.upsertAt(id.getEq<"notes">())(
                      noteId,
                      noteModel_
                    )(idsToNoteModels),
                  })
                )
              )
            ),
            option.match(() => [model, cmd.none], identity)
          )
      )
      .otherwise(() => [
        model,
        logMessage.report(stage)(
          logMessage.error("Failed to match model with msg", { model, msg })
        ),
      ]);

// VIEW

export const view: (model: Model) => Html<Msg> = (model) =>
  match<Model, Html<Msg>>(model)
    .with({ _tag: "LoadingNotes" }, () => (dispatch) => (
      <LoadingNotes dispatch={dispatch} />
    ))
    .with(
      { _tag: "LoadedNotes", idsToNoteModels: P.select() },
      (idsToNoteModels) => (dispatch) =>
        <LoadedNotes dispatch={dispatch} idsToNoteModels={idsToNoteModels} />
    )
    .exhaustive();

const LoadingNotes = ({
  dispatch,
}: {
  dispatch: Dispatch<Msg>;
}): ReactElement => {
  const notes = option.fromNullable(useQuery("getNotes"));

  React.useEffect(
    () =>
      pipe(
        notes,
        option.match(
          () => constVoid,
          (idsToNotes: ReturnType<NamedQuery<API, "getNotes">>): IO<void> =>
            () =>
              dispatch({
                _tag: "GotNotes",
                idsToNotes,
              })
        )
      )(),
    [notes, dispatch]
  );

  return <p>Loading notes…</p>;
};

const LoadedNotes = ({
  dispatch,
  idsToNoteModels: editors,
}: {
  dispatch: Dispatch<Msg>;
  idsToNoteModels: Map<Id<"notes">, note.Model>;
}): ReactElement => (
  <>
    {pipe(
      editors,
      map.values(note.Ord),
      array.map((editorModel) => (
        <React.Fragment key={editorModel.noteId.toString()}>
          {pipe(
            editorModel,
            note.view,
            html.map(
              (editorMsg): Msg => ({
                _tag: "GotNoteMsg",
                noteId: editorModel.noteId,
                msg: editorMsg,
              })
            ),
            apply(dispatch)
          )}
        </React.Fragment>
      ))
    )}
    <button onClick={() => dispatch({ _tag: "CreateNoteButtonClicked" })}>
      Create note
    </button>
  </>
);

// SUBSCRIPTIONS

export const subscriptions = (model: Model) => {
  return match<Model, Sub<Msg>>(model)
    .with({ _tag: "LoadingNotes" }, () => sub.none)
    .with({ _tag: "LoadedNotes" }, ({ idsToNoteModels: editors }) =>
      pipe(
        editors,
        map.reduceWithIndex<Id<"notes">>(id.getOrd<"notes">())<
          Sub<Msg>[],
          note.Model
        >([], (noteId, subs, editorModel) =>
          array.append(
            pipe(
              editorModel,
              note.subscriptions,
              sub.map(
                (editorMsg): Msg => ({
                  _tag: "GotNoteMsg",
                  noteId,
                  msg: editorMsg,
                })
              )
            )
          )(subs)
        ),
        sub.batch
      )
    )
    .exhaustive();
};
