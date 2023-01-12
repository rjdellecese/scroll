import { UserButton } from "@clerk/clerk-react";
import type { ConvexReactClient } from "convex/react";
import { cmd, html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { array, either, eq, option, readonlyArray, tuple } from "fp-ts";
import { apply, constVoid, flow, identity, pipe } from "fp-ts/function";
import type { Either } from "fp-ts/lib/Either";
import type { Option } from "fp-ts/lib/Option";
import { useStableEffect } from "fp-ts-react-stable-hooks";
import { Lens } from "monocle-ts";
import type { Dispatch, ReactElement } from "react";
import React from "react";
import { InView } from "react-intersection-observer";
import { match, P } from "ts-pattern";

import type { API } from "~src/convex/_generated/api";
import type { Id } from "~src/convex/_generated/dataModel";
import { usePaginatedQuery } from "~src/convex/_generated/react";
import * as cmdExtra from "~src/elm-ts/cmd-extra";
import { runMutation } from "~src/elm-ts/convex-elm-ts";
import * as dispatch from "~src/elm-ts/dispatch-extra";
import * as htmlId from "~src/elm-ts/html-id";
import { LoadingSpinner } from "~src/elm-ts/loading-spinner";
import type { LogMessage } from "~src/elm-ts/log-message";
import * as logMessage from "~src/elm-ts/log-message";
import * as note from "~src/elm-ts/note";
import type { Stage } from "~src/elm-ts/stage";
import * as id from "~src/id";
import * as usePaginatedQueryResultExtra from "~src/use-paginated-query-result-extra";

// MODEl

export type Model = LoadingNotesModel | LoadedNotesModel;

type LoadingNotesModel = { _tag: "LoadingNotes" };

type LoadedNotesModel = {
  _tag: "LoadedNotes";
  noteModels: note.Model[];
  loadMore: Option<Cmd<Msg>>;
  isTopInView: boolean;
};

export const init: Model = {
  _tag: "LoadingNotes",
};

// UPDATE

export type Msg =
  | { _tag: "CreateNoteButtonClicked" }
  | {
      _tag: "PaginatedNotesResultChanged";
      noteIds: Id<"notes">[];
      loadMore: Option<Cmd<Msg>>;
    }
  | {
      _tag: "GotUnexpectedPaginationState";
    }
  | {
      _tag: "GotNoteMsg";
      noteId: Id<"notes">;
      msg: note.Msg;
    }
  | {
      _tag: "InViewStatusChanged";
      isInView: boolean;
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
            _tag: "PaginatedNotesResultChanged",
            noteIds: P.select("noteIds"),
            loadMore: P.select("loadMore"),
          },
          { _tag: "LoadingNotes" },
        ],
        ({ noteIds, loadMore }) =>
          pipe(
            noteIds,
            array.reverse,
            noteIdsToNoteModels,
            tuple.mapFst(
              (noteModels): LoadedNotesModel => ({
                _tag: "LoadedNotes",
                noteModels,
                loadMore,
                isTopInView: false,
              })
            )
          )
      )
      .with(
        [
          {
            _tag: "PaginatedNotesResultChanged",
            noteIds: P.select("noteIds"),
            loadMore: P.select("loadMore"),
          },
          P.select("loadedNotesModel", { _tag: "LoadedNotes" }),
        ],
        ({ noteIds, loadMore, loadedNotesModel }) =>
          either.match(
            (logMessage_: LogMessage): [Model, Cmd<Msg>] => [
              loadedNotesModel,
              logMessage.report(stage)(logMessage_),
            ],
            ([noteModels, cmd_]: [note.Model[], Cmd<Msg>]): [
              Model,
              Cmd<Msg>
            ] => [
              pipe(
                loadedNotesModel,
                Lens.fromProp<LoadedNotesModel>()("noteModels").set(noteModels),
                Lens.fromProp<LoadedNotesModel>()("loadMore").set(loadMore)
              ),
              cmd_,
            ]
          )(reconcileNotes(array.reverse(noteIds), loadedNotesModel.noteModels))
      )
      .with([{ _tag: "GotUnexpectedPaginationState" }, P.any], () => [
        model,
        logMessage.report(stage)(
          logMessage.error("Got unexpected pagination state")
        ),
      ])
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
      .with(
        [
          { _tag: "InViewStatusChanged", isInView: P.select("isInView") },
          P.select("loadedNotesModel", { _tag: "LoadedNotes" }),
        ],
        ({ isInView, loadedNotesModel }) =>
          match<boolean, [Model, Cmd<Msg>]>(isInView)
            .with(true, () => [
              Lens.fromProp<LoadedNotesModel>()("isTopInView").set(isInView)(
                loadedNotesModel
              ),
              option.match<Cmd<Msg>, Cmd<Msg>>(
                () => cmd.none,
                identity
              )(loadedNotesModel.loadMore),
            ])
            .with(false, () => [model, cmd.none])
            .exhaustive()
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

// VIEW

export const view: (currentTime: number) => (model: Model) => Html<Msg> =
  (currentTime) => (model) => (dispatch_) =>
    <View dispatch={dispatch_} currentTime={currentTime} model={model} />;

const View = ({
  dispatch: dispatch_,
  currentTime,
  model,
}: {
  dispatch: Dispatch<Msg>;
  currentTime: number;
  model: Model;
}): ReactElement => {
  const paginatedNoteIds = usePaginatedQuery("getNotes", {
    initialNumItems: 10,
  });

  useStableEffect(
    () => {
      match(paginatedNoteIds)
        .with({ status: "LoadingMore" }, constVoid)
        .with(
          {
            status: P.union("CanLoadMore", "Exhausted"),
            results: P.select("noteIds"),
            loadMore: P.select("loadMore"),
          },
          ({ noteIds, loadMore }) =>
            dispatch_({
              _tag: "PaginatedNotesResultChanged",
              noteIds,
              loadMore: pipe(
                loadMore,
                option.fromNullable,
                option.map((loadMore_: (numItems: number) => void) =>
                  cmdExtra.fromIOVoid(() => loadMore_(5))
                )
              ),
            })
        )
        .otherwise(() => dispatch_({ _tag: "GotUnexpectedPaginationState" }));
    },
    [paginatedNoteIds, dispatch_],
    eq.tuple(
      usePaginatedQueryResultExtra.getEq(id.getEq<"notes">()),
      dispatch.getEq<Msg>()
    )
  );

  return (
    <div className="h-screen flex flex-col">
      <div className="fixed top-0 h-12 w-full z-50 px-4 py-2 flex flex-row content-center justify-end border-b border-b-stone-300 bg-stone-50">
        <UserButton appearance={{ elements: { rootBox: "self-center" } }} />
      </div>
      <div className="flex flex-col grow items-center mt-4">
        <div className="flex flex-col grow justify-end max-w-3xl w-full mt-6">
          {match<Model, Html<Msg>>(model)
            .with({ _tag: "LoadingNotes" }, () => loadingNotes)
            .with({ _tag: "LoadedNotes" }, ({ noteModels, loadMore }) =>
              pipe(
                noteModels,
                array.last,
                option.match(
                  () => noNotes,
                  () =>
                    loadedNotes({
                      currentTime,
                      noteModels,
                      canLoadMore: option.isSome(loadMore),
                    })
                )
              )
            )
            .exhaustive()(dispatch_)}
        </div>
      </div>
      {match(model)
        .with({ _tag: "LoadingNotes" }, () => null)
        .with({ _tag: "LoadedNotes" }, () => createNoteButton(dispatch_))
        .exhaustive()}
    </div>
  );
};

const loadingNotes: Html<Msg> = () => (
  <LoadingSpinner className="place-self-center m-8" />
);

const loadedNotes: ({
  currentTime,
  noteModels,
  canLoadMore,
}: {
  currentTime: number;
  noteModels: note.Model[];
  canLoadMore: boolean;
}) => Html<Msg> =
  ({ currentTime, noteModels, canLoadMore }) =>
  (dispatch_) =>
    (
      <>
        <div className="flex flex-col">
          <InView
            onChange={(isInView) =>
              dispatch_({ _tag: "InViewStatusChanged", isInView })
            }
          >
            {({ ref }) => (
              <div ref={ref} className="flex place-content-center pt-8 pb-16">
                {match(canLoadMore)
                  .with(true, () => <LoadingSpinner />)
                  .with(false, () => (
                    <span className="text-stone-400">
                      You've reached the beginning!
                    </span>
                  ))
                  .exhaustive()}
              </div>
            )}
          </InView>
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
                  apply(dispatch_)
                )}
              </React.Fragment>
            ))
          )}
        </div>
      </>
    );

const noNotes: Html<Msg> = () => <div className="flex-grow" />;

const createNoteButton: Html<Msg> = (dispatch_) => (
  <div
    id={htmlId.toString(htmlId.footer)}
    className="sticky flex flex-row justify-center w-full bottom-0 px-8 py-4 bg-white z-20 border-t border-stone-300"
  >
    <button
      className="w-full max-w-3xl p-4 text-xl font-bold text-yellow-600 bg-yellow-50 hover:text-yellow-50 hover:bg-yellow-600 active:text-yellow-50 active:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 border-2 border-yellow-600 rounded-lg transition duration-100"
      onClick={() => dispatch_({ _tag: "CreateNoteButtonClicked" })}
    >
      Create Note
    </button>
  </div>
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
