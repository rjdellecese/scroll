import { UserButton } from "@clerk/clerk-react";
import type { ConvexReactClient } from "convex/react";
import { cmd, html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import {
  array,
  boolean,
  either,
  eq,
  nonEmptyArray,
  number,
  option,
  readonlyArray,
  tuple,
} from "fp-ts";
import { apply, constVoid, flow, identity, pipe } from "fp-ts/function";
import type { Either } from "fp-ts/lib/Either";
import type { Option } from "fp-ts/lib/Option";
import { useStableEffect } from "fp-ts-react-stable-hooks";
import { Filter, LucideArrowDown, Plus, SearchIcon } from "lucide-react";
import { Lens } from "monocle-ts";
import type { Dispatch, ReactElement } from "react";
import React from "react";
import { match, P } from "ts-pattern";

import type { API } from "~src/convex/_generated/api";
import type { Id } from "~src/convex/_generated/dataModel";
import { useQuery } from "~src/convex/_generated/react";
import type { DatePaginationCursors } from "~src/date-pagination-cursors";
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

// MODEl

export type Model = LoadingNotesModel | LoadedNotesModel;

type LoadingNotesModel = { _tag: "LoadingNotes" };

type LoadedNotesModel = {
  _tag: "LoadedNotes";
  noteModels: note.Model[];
  isNoteBeingCreated: boolean;
  optionDatePaginationCursors: Option<DatePaginationCursors>;
  haveAllNotesLoaded: boolean;
};

export const init: Model = {
  _tag: "LoadingNotes",
};

// UPDATE

export type Msg =
  | { _tag: "CreateNoteButtonClicked" }
  | { _tag: "NoteCreated" }
  | {
      _tag: "GotNoteMsg";
      noteId: Id<"notes">;
      msg: note.Msg;
    }
  | {
      _tag: "GotNotes";
      noteIds: Id<"notes">[];
    };

export const update =
  (stage: Stage, convex: ConvexReactClient<API>) =>
  (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
    pipe(
      match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
        .with(
          [
            { _tag: "CreateNoteButtonClicked" },
            P.select({ _tag: "LoadedNotes" }),
          ],
          (loadedNotesModel) => [
            Lens.fromProp<LoadedNotesModel>()("isNoteBeingCreated").set(true)(
              loadedNotesModel
            ),
            runMutation(convex.mutation("createEmptyNote"), () =>
              option.some({ _tag: "NoteCreated" })
            ),
          ]
        )
        .with(
          [{ _tag: "NoteCreated" }, P.select({ _tag: "LoadedNotes" })],
          (loadedNotesModel) => [
            Lens.fromProp<LoadedNotesModel>()("isNoteBeingCreated").set(false)(
              loadedNotesModel
            ),
            cmd.none,
          ]
        )
        .with(
          [
            {
              _tag: "GotNotes",
              noteIds: P.select("noteIds"),
            },
            { _tag: "LoadingNotes" },
          ],
          ({ noteIds }) =>
            pipe(
              noteIds,
              array.reverse,
              noteIdsToNoteModels,
              tuple.mapFst(
                (noteModels): LoadedNotesModel => ({
                  _tag: "LoadedNotes",
                  noteModels,
                  isNoteBeingCreated: false,
                  optionDatePaginationCursors: option.none,
                  haveAllNotesLoaded: false,
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
              ([noteModels, cmd_]: [note.Model[], Cmd<Msg>]): [
                Model,
                Cmd<Msg>
              ] => [
                pipe(
                  loadedNotesModel,
                  Lens.fromProp<LoadedNotesModel>()("noteModels").set(
                    noteModels
                  )
                ),
                cmd_,
              ]
            )(
              reconcileNotes(
                array.reverse(noteIds),
                loadedNotesModel.noteModels
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
                      either.map((noteModels): [LoadedNotesModel, Cmd<Msg>] =>
                        pipe(
                          [
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
                          ],
                          ([loadedNotesModel_, cmd_]: [
                            LoadedNotesModel,
                            Cmd<Msg>
                          ]) =>
                            match<boolean, [LoadedNotesModel, Cmd<Msg>]>(
                              option
                                .getEq(boolean.Eq)
                                .equals(
                                  note.isInView(noteModel),
                                  note.isInView(noteModel_)
                                )
                            )
                              .with(true, () => [loadedNotesModel_, cmd_])
                              .with(false, () => {
                                const areAllNotesLoaded = pipe(
                                  loadedNotesModel_.noteModels,
                                  array.every(note.isLoaded)
                                );

                                const getDatePaginationCursors = (
                                  noteModels_: note.Model[]
                                ): Option<DatePaginationCursors> =>
                                  pipe(
                                    noteModels_,
                                    array.filterMap((noteModel__) =>
                                      match(note.isInView(noteModel__))
                                        .with(
                                          { _tag: "Some", value: true },
                                          () => note.creationTime(noteModel__)
                                        )
                                        .otherwise(() => option.none)
                                    ),
                                    nonEmptyArray.fromArray,
                                    option.map(
                                      (creationTimesOfNotesInView) => ({
                                        smallerDateCursor: nonEmptyArray.min(
                                          number.Ord
                                        )(creationTimesOfNotesInView),
                                        largerDateCursor: nonEmptyArray.max(
                                          number.Ord
                                        )(creationTimesOfNotesInView),
                                      })
                                    )
                                  );

                                return match<
                                  boolean,
                                  [LoadedNotesModel, Cmd<Msg>]
                                >(areAllNotesLoaded)
                                  .with(false, () => [loadedNotesModel_, cmd_])
                                  .with(true, () =>
                                    pipe(
                                      loadedNotesModel_.noteModels,
                                      getDatePaginationCursors,
                                      option.match(
                                        () => [loadedNotesModel_, cmd_],
                                        (datePaginationCursors) => [
                                          pipe(
                                            loadedNotesModel_,
                                            Lens.fromProp<LoadedNotesModel>()(
                                              "optionDatePaginationCursors"
                                            ).set(
                                              option.some(datePaginationCursors)
                                            ),
                                            Lens.fromProp<LoadedNotesModel>()(
                                              "haveAllNotesLoaded"
                                            ).set(true)
                                          ),
                                          match(
                                            loadedNotesModel_.haveAllNotesLoaded
                                          )
                                            .with(true, () => cmd.none)
                                            .with(false, () =>
                                              cmdExtra.fromIOVoid(() =>
                                                window.scrollTo(
                                                  0,
                                                  document.body.scrollHeight
                                                )
                                              )
                                            )
                                            .exhaustive(),
                                        ]
                                      )
                                    )
                                  )
                                  .exhaustive();
                              })
                              .exhaustive()
                        )
                      )
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
        ])
    );

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
  const dateCursors = match(model)
    .with({ _tag: "LoadingNotes" }, () => null)
    .with(
      { _tag: "LoadedNotes", optionDatePaginationCursors: P.select() },
      option.toNullable
    )
    .exhaustive();

  const noteIds_ = option.fromNullable(useQuery("getNotes", dateCursors));

  useStableEffect(
    () => {
      option.match(constVoid, (noteIds__: Id<"notes">[]) =>
        dispatch_({ _tag: "GotNotes", noteIds: noteIds__ })
      )(noteIds_);
    },
    [dispatch_, noteIds_],
    eq.tuple(
      dispatch.getEq<Msg>(),
      option.getEq(array.getEq(id.getEq<"notes">()))
    )
  );

  return (
    <div className="h-screen flex flex-col [overflow-anchor:none]">
      <div className="flex flex-col grow items-center">
        <div className="flex flex-col grow justify-end max-w-3xl w-full">
          {match<Model, Html<Msg>>(model)
            .with({ _tag: "LoadingNotes" }, () => loadingNotes)
            .with({ _tag: "LoadedNotes" }, ({ noteModels }) =>
              pipe(
                noteModels,
                array.last,
                option.match(
                  () => noNotes,
                  () =>
                    loadedNotes({
                      currentTime,
                      noteModels,
                    })
                )
              )
            )
            .exhaustive()(dispatch_)}
        </div>
      </div>
      {match(model)
        .with({ _tag: "LoadingNotes" }, () => null)
        .with(
          { _tag: "LoadedNotes", isNoteBeingCreated: P.select() },
          (isNoteBeingCreated) => footer({ isNoteBeingCreated })(dispatch_)
        )
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
}: {
  currentTime: number;
  noteModels: note.Model[];
}) => Html<Msg> =
  ({ currentTime, noteModels }) =>
  (dispatch_) =>
    (
      <>
        <div className="flex flex-col">
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

const footer: (props: { isNoteBeingCreated: boolean }) => Html<Msg> =
  ({ isNoteBeingCreated }) =>
  (dispatch_) =>
    (
      <div
        id={htmlId.toString(htmlId.footer)}
        className="sticky flex flex-row justify-center w-full bottom-0 pt-2 pb-4 bg-yellow-50 z-20 border-t border-yellow-300"
      >
        <div className="flex flex-row justify-between w-full max-w-3xl px-8">
          <div className="flex flex-row space-x-2">
            <FooterButton
              onClick={() => dispatch_({ _tag: "CreateNoteButtonClicked" })}
              isDisabled={isNoteBeingCreated}
            >
              {isNoteBeingCreated ? <LoadingSpinner /> : <Plus />}
            </FooterButton>
            <FooterButton isDisabled={false}>
              <LucideArrowDown />
            </FooterButton>
            <FooterButton isDisabled={false}>
              <SearchIcon />
            </FooterButton>
            <FooterButton isDisabled={false}>
              <Filter />
            </FooterButton>
          </div>
          <UserButton />
        </div>
      </div>
    );

type ButtonProps = React.DetailedHTMLProps<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
>;

const FooterButton = (props: {
  onClick?: ButtonProps["onClick"];
  isDisabled?: boolean;
  children: ButtonProps["children"];
}): ReactElement => {
  const className = `${
    props.isDisabled
      ? "text-yellow-50 bg-yellow-400 cursor-default"
      : "text-yellow-700 bg-yellow-50 hover:text-yellow-50 hover:bg-yellow-600"
  } text-xl font-bold p-1 active:text-yellow-50 active:bg-yellow-500 focus:outline-none focus:ring focus:ring-offset focus:ring-yellow-500 rounded transition duration-100`;

  return (
    <button onClick={props.onClick} className={className}>
      {props.children}
    </button>
  );
};

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
