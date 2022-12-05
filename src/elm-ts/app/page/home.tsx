import type { ConvexReactClient } from "convex/react";
import { cmd, html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { array, either, eq, map, option, readonlyArray, tuple } from "fp-ts";
import { apply, constVoid, flow, identity, pipe } from "fp-ts/function";
import type { Either } from "fp-ts/lib/Either";
import type { IO } from "fp-ts/lib/IO";
import { useStableEffect } from "fp-ts-react-stable-hooks";
import { Lens } from "monocle-ts";
import type { Dispatch, ReactElement } from "react";
import React from "react";
import { match, P } from "ts-pattern";

import type { API } from "~src/convex/_generated/api";
import type { Document, Id } from "~src/convex/_generated/dataModel";
import { usePaginatedQuery, useQuery } from "~src/convex/_generated/react";
import * as cmdExtra from "~src/elm-ts/cmd-extra";
import { runMutation } from "~src/elm-ts/convex-elm-ts";
import { LoadingSpinner } from "~src/elm-ts/loading-spinner";
import type { LogMessage } from "~src/elm-ts/log-message";
import * as logMessage from "~src/elm-ts/log-message";
import * as note from "~src/elm-ts/note";
import type { Stage } from "~src/elm-ts/stage";
import * as id from "~src/id";
import * as usePaginatedQueryResultExtra from "~src/use-paginated-query-result-extra";
import type { VersionedNote } from "~src/versioned-note";
import * as versionedNote from "~src/versioned-note";

// MODEl

export type Model = LoadingNotesModel | LoadedNotesModel;

type LoadingNotesModel = { _tag: "LoadingNotes" };

type LoadedNotesModel = {
  _tag: "LoadedNotes";
  noteModels: note.Model[];
};

export const init: Model = {
  _tag: "LoadingNotes",
};

// UPDATE

export type Msg =
  | { _tag: "CreateNoteButtonClicked" }
  | {
      _tag: "GotNotes";
      noteIds: Id<"notes">[];
      loadMore: Cmd<Msg>;
    }
  | {
      _tag: "GotUnexpectedPaginationState";
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
            noteIds: P.select(),
          },
          { _tag: "LoadingNotes" },
        ],
        flow(
          noteIdsToNoteModels,
          tuple.bimap(
            (cmd_) => cmd.batch([cmd_, scrollToBottom]),
            (noteModels): LoadedNotesModel => ({
              _tag: "LoadedNotes",
              noteModels,
            })
          )
        )
      )
      .with(
        [
          {
            _tag: "GotNotes",
            noteIds: P.select("noteIds"),
          },
          P.select("loadedNotesModel", { _tag: "LoadedNotes" }),
        ],
        ({ noteIds, loadedNotesModel }) =>
          either.match(
            (logMessage_: LogMessage): [Model, Cmd<Msg>] => [
              loadedNotesModel,
              logMessage.report(stage)(logMessage_),
            ],
            ([noteModels, cmd]: [note.Model[], Cmd<Msg>]): [
              Model,
              Cmd<Msg>
            ] => [{ _tag: "LoadedNotes", noteModels }, cmd]
          )(reconcileNotes(noteIds, loadedNotesModel.noteModels))
      )
      .with(
        [{ _tag: "GotUnexpectedPaginationState" }, { _tag: "LoadingNotes" }],
        () => [
          model,
          logMessage.report(stage)(
            logMessage.error("Got unexpected pagination state")
          ),
        ]
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
            either.Do,
            either.bind("noteIndex", () =>
              pipe(
                loadedNotesModel.noteModels,
                array.findIndex<note.Model>((noteModel) =>
                  id.getEq<"notes">().equals(noteId, note.noteId(noteModel))
                ),
                either.fromOption(() =>
                  logMessage.error("Failed to find note index by ID")
                )
              )
            ),
            either.bind("noteModel", ({ noteIndex }) =>
              pipe(
                loadedNotesModel.noteModels,
                array.lookup(noteIndex),
                either.fromOption(() =>
                  logMessage.error("Failed to find note by index")
                )
              )
            ),
            either.chain(({ noteIndex, noteModel }) =>
              pipe(
                note.update(stage, convex)(noteMsg, noteModel),
                ([noteModel_, noteCmd]): Either<
                  LogMessage,
                  [LoadedNotesModel, Cmd<Msg>]
                > =>
                  pipe(
                    loadedNotesModel.noteModels,
                    array.updateAt(noteIndex, noteModel_),
                    either.fromOption(() =>
                      logMessage.error("Failed to update note by index")
                    ),
                    either.map((noteModels): [LoadedNotesModel, Cmd<Msg>] => [
                      Lens.fromProp<LoadedNotesModel>()("noteModels").set(
                        noteModels
                      )(loadedNotesModel),
                      cmd.map(
                        (noteMsg_: note.Msg): Msg => ({
                          _tag: "GotNoteMsg",
                          noteId: note.noteId(noteModel),
                          msg: noteMsg_,
                        })
                      )(noteCmd),
                    ])
                  )
              )
            ),
            either.match(
              (logMessage_: LogMessage) => [
                loadedNotesModel,
                logMessage.report(stage)(logMessage_),
              ],
              identity
            )
          )
      )
      .otherwise(() => [
        model,
        logMessage.report(stage)(
          logMessage.error("Failed to match model with msg", { model, msg })
        ),
      ]);

const reconcileNotes = (
  latestNoteIds: Id<"notes">[],
  currentNoteModels: note.Model[]
): Either<LogMessage, [note.Model[], Cmd<Msg>]> =>
  pipe(
    latestNoteIds,
    array.difference(id.getEq<"notes">())(
      array.map(note.noteId)(currentNoteModels)
    ),
    array.reduce<Id<"notes">, [note.Model[], Cmd<Msg>[]]>(
      [[], []],
      (result, noteId) =>
        pipe(
          noteId,
          note.init,
          tuple.bimap(
            (noteCmd) =>
              array.prepend(
                cmd.map(
                  (noteMsg_: note.Msg): Msg => ({
                    _tag: "GotNoteMsg",
                    noteId,
                    msg: noteMsg_,
                  })
                )(noteCmd)
              )(tuple.snd(result)),
            (noteModel) => array.prepend(noteModel)(tuple.fst(result))
          )
        )
    ),
    (newNoteModelCmds) =>
      pipe(
        latestNoteIds,
        either.traverseArray((latestNoteId) =>
          pipe(
            newNoteModelCmds,
            tuple.fst,
            array.findFirst((noteModel: note.Model): boolean =>
              id.getEq<"notes">().equals(note.noteId(noteModel), latestNoteId)
            ),
            option.match(
              () =>
                pipe(
                  currentNoteModels,
                  array.findFirst((noteModel: note.Model): boolean =>
                    id
                      .getEq<"notes">()
                      .equals(note.noteId(noteModel), latestNoteId)
                  )
                ),
              (noteModel) => option.some(noteModel)
            ),
            either.fromOption(() =>
              logMessage.error(
                "Failed to find a note model corresponding to a given note ID"
              )
            )
          )
        ),
        either.map((noteModels) => [
          readonlyArray.toArray(noteModels),
          cmd.batch(tuple.snd(newNoteModelCmds)),
        ])
      )
  );

const noteIdsToNoteModels = (
  noteIds: Id<"notes">[]
): [note.Model[], Cmd<Msg>] =>
  pipe(
    noteIds,
    array.reduce<Id<"notes">, [note.Model[], Cmd<Msg>[]]>(
      [[], []],
      (result, noteId) =>
        pipe(
          noteId,
          note.init,
          tuple.bimap(
            flow(
              cmd.map(
                (noteMsg): Msg => ({
                  _tag: "GotNoteMsg",
                  noteId: noteId,
                  msg: noteMsg,
                })
              ),
              (noteCmd) => array.append(noteCmd)(tuple.snd(result))
            ),
            (noteModel) => array.append(noteModel)(tuple.fst(result))
          )
        )
    ),
    tuple.mapSnd(cmd.batch)
  );

const scrollToBottom: Cmd<never> = pipe(
  cmdExtra.fromIOVoid(() =>
    // I haven't been able to figure out why, but we need to wait one more animation frame here to ensure that everything is rendered before we try to scroll to the bottom.
    window.scrollTo({
      top: document.body.scrollHeight,
    })
  ),
  cmdExtra.scheduleForNextAnimationFrame
);

// VIEW

export const view: (currentTime: number) => (model: Model) => Html<Msg> =
  (currentTime) => (model) => (dispatch) =>
    <View currentTime={currentTime} model={model} dispatch={dispatch} />;

const View = ({
  currentTime,
  model,
  dispatch,
}: {
  currentTime: number;
  model: Model;
  dispatch: Dispatch<Msg>;
}): ReactElement => {
  const paginatedNoteIds = usePaginatedQuery("getNotes", {
    initialNumItems: 10,
  });

  useStableEffect(
    () => {
      match(paginatedNoteIds)
        .with({ status: "LoadingMore", results: [] }, constVoid)
        .with(
          {
            status: P.union("CanLoadMore", "Exhausted"),
            results: P.select("noteIds"),
            loadMore: P.select("loadMore"),
          },
          ({ noteIds, loadMore }) =>
            dispatch({
              _tag: "GotNotes",
              noteIds,
              loadMore: cmdExtra.fromIOVoid(
                pipe(
                  loadMore,
                  option.fromNullable,
                  option.match(
                    () => constVoid,
                    (loadMore_: (numItems: number) => void) => () =>
                      loadMore_(5)
                  )
                )
              ),
            })
        )
        .otherwise(() => dispatch({ _tag: "GotUnexpectedPaginationState" }));
    },
    [paginatedNoteIds],
    eq.tuple(usePaginatedQueryResultExtra.getEq(id.getEq<"notes">()))
  );

  return (
    // We set the height to the viewport height minus the height of the header.
    // Source: https://stackoverflow.com/a/72673613
    <div className="flex flex-col items-center">
      <div className="flex flex-col grow justify-end max-w-3xl w-full mt-6">
        {match<Model, ReactElement>(model)
          .with({ _tag: "LoadingNotes" }, () => <LoadingNotes />)
          .with({ _tag: "LoadedNotes", noteModels: P.select() }, (noteModels) =>
            pipe(
              noteModels,
              array.last,
              option.match(
                () => <NoNotes dispatch={dispatch} />,
                () => (
                  <LoadedNotes
                    dispatch={dispatch}
                    currentTime={currentTime}
                    noteModels={noteModels}
                  />
                )
              )
            )
          )
          .exhaustive()}
      </div>
    </div>
  );
};

const LoadingNotes = (): ReactElement => (
  <LoadingSpinner className="place-self-center m-8" />
);

const LoadedNotes = ({
  dispatch,
  currentTime,
  noteModels,
}: {
  dispatch: Dispatch<Msg>;
  currentTime: number;
  noteModels: note.Model[];
}): ReactElement => (
  <>
    <div className="flex flex-col gap-y-8">
      {pipe(
        noteModels,
        array.map((noteModel) => (
          <React.Fragment key={note.noteId(noteModel).toString()}>
            {pipe(
              noteModel,
              note.view(currentTime),
              html.map(
                (noteMsg): Msg => ({
                  _tag: "GotNoteMsg",
                  noteId: note.noteId(noteModel),
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
  </>
);

const NoNotes = ({ dispatch }: { dispatch: Dispatch<Msg> }): ReactElement => (
  <CreateNoteButton dispatch={dispatch} />
);

const CreateNoteButton = ({
  dispatch,
}: {
  dispatch: Dispatch<Msg>;
}): ReactElement => (
  <button
    className="sticky shadow-lg shadow-yellow-600/50 bottom-4 p-4 mt-4 mb-4 text-xl font-bold text-yellow-600 bg-yellow-50 hover:text-yellow-50 hover:bg-yellow-600 active:text-yellow-50 active:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 rounded-lg transition duration-100"
    onClick={() => dispatch({ _tag: "CreateNoteButtonClicked" })}
  >
    Create Note
  </button>
);

// SUBSCRIPTIONS

export const subscriptions = (model: Model) => {
  return match<Model, Sub<Msg>>(model)
    .with({ _tag: "LoadingNotes" }, () => sub.none)
    .with({ _tag: "LoadedNotes", noteModels: P.select() }, (noteModels) =>
      pipe(
        noteModels,
        array.reduce<note.Model, Sub<Msg>[]>([], (subs, noteModel) =>
          array.append(
            pipe(
              noteModel,
              note.subscriptions,
              sub.map(
                (editorMsg): Msg => ({
                  _tag: "GotNoteMsg",
                  noteId: note.noteId(noteModel),
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
