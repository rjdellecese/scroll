import type { NamedQuery } from "convex/browser";
import type { ConvexReactClient } from "convex/react";
import { cmd, html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { array, either, map, option, tuple } from "fp-ts";
import { apply, constVoid, flow, pipe } from "fp-ts/function";
import type { IO } from "fp-ts/lib/IO";
import { Lens } from "monocle-ts";
import type { Dispatch, ReactElement } from "react";
import React from "react";
import { match, P } from "ts-pattern";

import type { API } from "~src/convex/_generated/api";
import type { Document, Id } from "~src/convex/_generated/dataModel";
import { useQuery } from "~src/convex/_generated/react";
import * as cmdExtra from "~src/elm-ts/cmd-extra";
import { runMutation } from "~src/elm-ts/convex-elm-ts";
import { LoadingSpinner } from "~src/elm-ts/loading-spinner";
import type { LogMessage } from "~src/elm-ts/log-message";
import * as logMessage from "~src/elm-ts/log-message";
import * as note from "~src/elm-ts/note";
import type { Stage } from "~src/elm-ts/stage";
import * as id from "~src/id";

// MODEl

export type Model = LoadingNotesModel | LoadedNotesModel;

type LoadingNotesModel = { _tag: "LoadingNotes" };

type LoadedNotesModel = {
  _tag: "LoadedNotes";
  idsToNoteModels: Map<Id<"notes">, note.Model>;
};

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
      _tag: "GotNotesSince";
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
      .with(
        [{ _tag: "CreateNoteButtonClicked" }, { _tag: "LoadedNotes" }],
        () => [
          model,
          runMutation(convex.mutation("createEmptyNote"), () => option.none),
        ]
      )
      .with(
        [
          {
            _tag: "GotNotes",
            idsToNotes: P.select(),
          },
          { _tag: P.union("LoadingNotes", "LoadedNotes") },
        ],
        flow(
          idsToNotesToIdsToNoteModels,
          tuple.bimap(
            (cmd_) => cmd.batch([cmd_, scrollToBottom]),
            (idsToNoteModels): LoadedNotesModel => ({
              _tag: "LoadedNotes",
              idsToNoteModels,
            })
          )
        )
      )
      .with(
        [
          {
            _tag: "GotNotesSince",
            idsToNotes: P.select("idsToNotes"),
          },
          P.select("loadedNotesModel", {
            _tag: "LoadedNotes",
          }),
        ],
        ({ idsToNotes, loadedNotesModel }) =>
          pipe(
            idsToNotes,
            idsToNotesToIdsToNoteModels,
            tuple.bimap(
              (cmd_) =>
                // We need to `scheduleForNextAnimationFrame` here again to ensure the note has loaded.
                cmdExtra.scheduleForNextAnimationFrame(
                  cmd.batch([cmd_, scrollToBottom])
                ),
              (idsToNoteModels) =>
                Lens.fromProp<LoadedNotesModel>()("idsToNoteModels").modify(
                  (idsToNoteModels_) =>
                    map.union(
                      id.getEq<"notes">(),
                      note.Magma
                    )(idsToNoteModels_)(idsToNoteModels)
                )(loadedNotesModel)
            )
          )
      )
      .with(
        [
          {
            _tag: "GotNoteMsg",
            noteId: P.select("noteId"),
            msg: P.select("noteMsg"),
          },
          P.select("loadedNotesModel", {
            _tag: "LoadedNotes",
          }),
        ],
        ({ noteId, noteMsg, loadedNotesModel }) =>
          pipe(
            loadedNotesModel.idsToNoteModels,
            map.lookup(id.getEq<"notes">())(noteId),
            either.fromOption(() =>
              logMessage.error("Failed to find note by ID")
            ),
            either.match(
              (logMessage_: LogMessage) => [
                loadedNotesModel,
                logMessage.report(stage)(logMessage_),
              ],
              (noteModel) =>
                pipe(
                  note.update(stage, convex)(noteMsg, noteModel),
                  tuple.bimap(
                    cmd.map(
                      (noteMsg_): Msg => ({
                        _tag: "GotNoteMsg",
                        noteId,
                        msg: noteMsg_,
                      })
                    ),
                    (noteModel): LoadedNotesModel =>
                      Lens.fromProp<LoadedNotesModel>()(
                        "idsToNoteModels"
                      ).modify(
                        map.upsertAt(id.getEq<"notes">())(noteId, noteModel)
                      )(loadedNotesModel)
                  )
                )
            )
          )
      )
      .otherwise(() => [
        model,
        logMessage.report(stage)(
          logMessage.error("Failed to match model with msg", { model, msg })
        ),
      ]);

const idsToNotesToIdsToNoteModels = (
  idsToNotes: Map<
    Id<"notes">,
    {
      proseMirrorDoc: Document<"notes">["proseMirrorDoc"];
      creationTime: number;
      version: number;
    }
  >
): [Map<Id<"notes">, note.Model>, Cmd<Msg>] =>
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
    ({ idsToNoteModels, cmds }) => [idsToNoteModels, cmd.batch(cmds)]
  );

const scrollToBottom: Cmd<never> = pipe(
  cmdExtra.fromIOVoid(() =>
    // I haven't been able to figure out why, but we need to wait one more animation frame here to ensure that everything is rendered before we try to scroll to the bottom. This works, but isn't ideal.
    window.scrollTo({
      top: document.body.scrollHeight,
    })
  ),
  cmdExtra.scheduleForNextAnimationFrame
);

// VIEW

export const view: (model: Model) => Html<Msg> = (model) => (dispatch) =>
  (
    <div className="flex justify-center">
      {match<Model, ReactElement>(model)
        .with({ _tag: "LoadingNotes" }, () => (
          <LoadingNotes dispatch={dispatch} />
        ))
        .with(
          { _tag: "LoadedNotes", idsToNoteModels: P.select() },
          (idsToNoteModels) =>
            pipe(
              idsToNoteModels,
              map.values(note.Ord),
              array.last,
              option.match(
                () => <NoNotes dispatch={dispatch} />,
                ({ creationTime }) => (
                  <LoadedNotes
                    dispatch={dispatch}
                    idsToNoteModels={idsToNoteModels}
                    latestCreationTime={creationTime}
                  />
                )
              )
            )
        )
        .exhaustive()}
    </div>
  );

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
          constVoid,
          (idsToNotes: ReturnType<NamedQuery<API, "getNotes">>): void =>
            dispatch({
              _tag: "GotNotes",
              idsToNotes,
            })
        )
      ),
    [notes, dispatch]
  );

  return <LoadingSpinner className="m-8" />;
};

const LoadedNotes = ({
  dispatch,
  idsToNoteModels,
  latestCreationTime,
}: {
  dispatch: Dispatch<Msg>;
  idsToNoteModels: Map<Id<"notes">, note.Model>;
  latestCreationTime: number;
}): ReactElement => {
  const notesSince = option.fromNullable(
    useQuery("getNotesSince", latestCreationTime)
  );

  React.useEffect(
    () =>
      option.match(
        constVoid,
        (idsToNotes: ReturnType<NamedQuery<API, "getNotes">>): void =>
          match(map.isEmpty(idsToNotes))
            .with(false, () =>
              dispatch({
                _tag: "GotNotesSince",
                idsToNotes,
              })
            )
            .with(true, constVoid)
            .exhaustive()
      )(notesSince),
    [notesSince, dispatch]
  );

  return (
    <div className="flex flex-col max-w-3xl mt-6">
      <div className="flex flex-col">
        {pipe(
          idsToNoteModels,
          map.values(note.Ord),
          array.map((noteModel) => (
            <React.Fragment key={noteModel.noteId.toString()}>
              {pipe(
                noteModel,
                note.view,
                html.map(
                  (noteMsg): Msg => ({
                    _tag: "GotNoteMsg",
                    noteId: noteModel.noteId,
                    msg: noteMsg,
                  })
                ),
                apply(dispatch)
              )}
            </React.Fragment>
          ))
        )}
      </div>
      <CreateNoteButton dispatch={dispatch} />
    </div>
  );
};

const NoNotes = ({ dispatch }: { dispatch: Dispatch<Msg> }): ReactElement => {
  const notes = option.fromNullable(useQuery("getNotes"));

  React.useEffect(
    () =>
      option.match(
        () => constVoid,
        (idsToNotes: ReturnType<NamedQuery<API, "getNotes">>): IO<void> =>
          match(map.isEmpty(idsToNotes))
            .with(
              false,
              () => () =>
                dispatch({
                  _tag: "GotNotes",
                  idsToNotes,
                })
            )
            .with(true, () => constVoid)
            .exhaustive()
      )(notes)(),
    [notes, dispatch]
  );

  return <CreateNoteButton dispatch={dispatch} />;
};

const CreateNoteButton = ({
  dispatch,
}: {
  dispatch: Dispatch<Msg>;
}): ReactElement => (
  <button
    className="sticky shadow-lg shadow-yellow-600/50 bottom-4 p-4 mt-4 mb-4 text-xl font-bold text-yellow-600 border-yellow-600 bg-yellow-50 hover:text-yellow-50 hover:bg-yellow-600 hover:border-yellow-600 active:text-yellow-50 active:bg-yellow-500 active:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 border-2 rounded-lg transition"
    onClick={() => dispatch({ _tag: "CreateNoteButtonClicked" })}
  >
    Create Note
  </button>
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
