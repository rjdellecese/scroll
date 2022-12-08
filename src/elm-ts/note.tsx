import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import type { Editor as ReactEditor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { ConvexReactClient } from "convex/react";
import type { Cmd } from "elm-ts/lib/Cmd";
import { cmd, sub } from "elm-ts/lib/index";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { eq, io, nonEmptyArray, option, readonlyArray, tuple } from "fp-ts";
import { constVoid, flow, identity, pipe } from "fp-ts/function";
import type { NonEmptyArray } from "fp-ts/lib/NonEmptyArray";
import type { Option } from "fp-ts/lib/Option";
import {
  useStableEffect,
  useStableLayoutEffect,
} from "fp-ts-react-stable-hooks";
import type { Duration } from "luxon";
import { DateTime } from "luxon";
import { Lens } from "monocle-ts";
import * as collab from "prosemirror-collab";
import { Step } from "prosemirror-transform";
import type { Dispatch, ReactElement } from "react";
import React from "react";
import { match, P } from "ts-pattern";

import type { API } from "~src/convex/_generated/api";
import type { Id } from "~src/convex/_generated/dataModel";
import { useQuery } from "~src/convex/_generated/react";
import * as cmdExtra from "~src/elm-ts/cmd-extra";
import { runMutation } from "~src/elm-ts/convex-elm-ts";
import * as dispatch from "~src/elm-ts/dispatch-extra";
import * as logMessage from "~src/elm-ts/log-message";
import { extensions } from "~src/tiptap-schema-extensions";
import type { VersionedNote } from "~src/versioned-note";
import * as versionedNote from "~src/versioned-note";

import type { Stage } from "./stage";

// MODEL

export type Model =
  | LoadingNoteAndClientIdModel
  | LoadingEditorModel
  | LoadedModel;

type LoadingNoteAndClientIdModel = {
  _tag: "LoadingNoteAndClientId";
  noteId: Id<"notes">;
  optionVersionedNote: Option<VersionedNote>;
  optionClientId: Option<string>;
};

type LoadingEditorModel = {
  _tag: "LoadingEditor";
  versionedNote: VersionedNote;
  clientId: string;
};

type LoadedModel = {
  _tag: "Loaded";
  noteId: Id<"notes">;
  creationTime: number;
  initialProseMirrorDoc: string;
  initialVersion: number;
  clientId: string;
  editor: Editor;
  areStepsInFlight: boolean;
};

export const init = (noteId: Id<"notes">): [Model, Cmd<Msg>] => [
  {
    _tag: "LoadingNoteAndClientId",
    noteId,
    optionVersionedNote: option.none,
    optionClientId: option.none,
  },
  pipe(
    () => crypto.randomUUID(),
    io.map(
      (clientId): Msg => ({
        _tag: "GotLoadingNoteAndClientIdMsg",
        msg: { _tag: "ClientIdGenerated", clientId },
      })
    ),
    cmdExtra.fromIO
  ),
];

export const noteId = (model: Model): Id<"notes"> =>
  match(model)
    .with({ _tag: "LoadingNoteAndClientId", noteId: P.select() }, identity)
    .with(
      { _tag: "LoadingEditor", versionedNote: { _id: P.select() } },
      identity
    )
    .with({ _tag: "Loaded", noteId: P.select() }, identity)
    .exhaustive();

// UPDATE

export type Msg =
  | { _tag: "GotLoadingNoteAndClientIdMsg"; msg: LoadingNoteAndClientIdMsg }
  | { _tag: "GotLoadingEditorMsg"; msg: LoadingEditorMsg }
  | { _tag: "GotLoadedMsg"; msg: LoadedMsg };

type LoadingNoteAndClientIdMsg =
  | {
      _tag: "ClientIdGenerated";
      clientId: string;
    }
  | { _tag: "VersionedNoteReceived"; versionedNote: VersionedNote };

type LoadingEditorMsg = {
  _tag: "EditorLoaded";
  editor: Editor;
};

type LoadedMsg =
  | { _tag: "EditorTransactionApplied" }
  | { _tag: "StepsSent" }
  | {
      _tag: "StepsReceived";
      steps: NonEmptyArray<{ proseMirrorStep: string; clientId: string }>;
    };

export const update =
  (stage: Stage, convex: ConvexReactClient<API>) =>
  (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
    match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
      .with(
        [
          {
            _tag: "GotLoadingNoteAndClientIdMsg",
            msg: P.select("loadingNoteAndClientIdMsg"),
          },
          P.select("loadingNoteAndClientIdModel", {
            _tag: "LoadingNoteAndClientId",
          }),
        ],
        ({ loadingNoteAndClientIdMsg, loadingNoteAndClientIdModel }) =>
          pipe(
            match<
              LoadingNoteAndClientIdMsg,
              [LoadingNoteAndClientIdModel, Cmd<Msg>]
            >(loadingNoteAndClientIdMsg)
              .with(
                { _tag: "ClientIdGenerated", clientId: P.select() },
                (clientId) => [
                  Lens.fromProp<LoadingNoteAndClientIdModel>()(
                    "optionClientId"
                  ).set(option.some(clientId))(loadingNoteAndClientIdModel),
                  cmd.none,
                ]
              )
              .with(
                { _tag: "VersionedNoteReceived", versionedNote: P.select() },
                (versionedNote) => [
                  Lens.fromProp<LoadingNoteAndClientIdModel>()(
                    "optionVersionedNote"
                  ).set(option.some(versionedNote))(
                    loadingNoteAndClientIdModel
                  ),
                  cmd.none,
                ]
              )
              .exhaustive(),
            tuple.mapFst((loadingNoteandClientIdModel_) =>
              match<
                LoadingNoteAndClientIdModel,
                LoadingNoteAndClientIdModel | LoadingEditorModel
              >(loadingNoteandClientIdModel_)
                .with(
                  {
                    optionClientId: {
                      _tag: "Some",
                      value: P.select("clientId"),
                    },
                    optionVersionedNote: {
                      _tag: "Some",
                      value: P.select("versionedNote_"),
                    },
                  },
                  ({ clientId, versionedNote_ }): LoadingEditorModel => ({
                    _tag: "LoadingEditor",
                    clientId,
                    versionedNote: versionedNote_,
                  })
                )
                .otherwise(() => loadingNoteandClientIdModel_)
            )
          )
      )
      .with(
        [
          {
            _tag: "GotLoadingEditorMsg",
            msg: P.select("loadingEditorMsg"),
          },
          P.select("loadingEditorModel", { _tag: "LoadingEditor" }),
        ],
        ({ loadingEditorMsg, loadingEditorModel }) =>
          tuple.mapSnd<Cmd<LoadingEditorMsg>, Cmd<Msg>>(
            cmd.map(
              (loadingEditorMsg_): Msg => ({
                _tag: "GotLoadingEditorMsg",
                msg: loadingEditorMsg_,
              })
            )
          )(
            match<LoadingEditorMsg, [LoadedModel, Cmd<LoadingEditorMsg>]>(
              loadingEditorMsg
            )
              .with(
                {
                  _tag: "EditorLoaded",
                  editor: P.select("editor"),
                },
                ({ editor }) => [
                  {
                    _tag: "Loaded",
                    noteId: loadingEditorModel.versionedNote._id,
                    creationTime:
                      loadingEditorModel.versionedNote._creationTime,
                    initialProseMirrorDoc:
                      loadingEditorModel.versionedNote.proseMirrorDoc,
                    initialVersion: loadingEditorModel.versionedNote.version,
                    clientId: loadingEditorModel.clientId,
                    editor,
                    areStepsInFlight: false,
                  },
                  cmd.none,
                ]
              )
              .exhaustive()
          )
      )
      .with(
        [
          {
            _tag: "GotLoadedMsg",
            msg: P.select("loadedMsg"),
          },
          P.select("loadedModel", { _tag: "Loaded" }),
        ],
        ({ loadedMsg, loadedModel }) =>
          tuple.mapSnd<Cmd<LoadedMsg>, Cmd<Msg>>(
            cmd.map(
              (loadedMsg): Msg => ({
                _tag: "GotLoadedMsg",
                msg: loadedMsg,
              })
            )
          )(
            match<LoadedMsg, [LoadedModel, Cmd<LoadedMsg>]>(loadedMsg)
              .with({ _tag: "EditorTransactionApplied" }, () =>
                match<boolean, [LoadedModel, Cmd<LoadedMsg>]>(
                  loadedModel.areStepsInFlight
                )
                  .with(true, () => [loadedModel, cmd.none])
                  .with(false, () =>
                    match<
                      ReturnType<typeof collab.sendableSteps>,
                      [LoadedModel, Cmd<LoadedMsg>]
                    >(collab.sendableSteps(loadedModel.editor.state))
                      .with(null, () => [loadedModel, cmd.none])
                      .with(P.not(null), ({ version, steps }) => [
                        Lens.fromProp<LoadedModel>()("areStepsInFlight").set(
                          true
                        )(loadedModel),
                        sendSteps(convex, loadedModel, version, steps),
                      ])
                      .exhaustive()
                  )
                  .exhaustive()
              )
              .with({ _tag: "StepsSent" }, () =>
                match<
                  ReturnType<typeof collab.sendableSteps>,
                  [LoadedModel, Cmd<LoadedMsg>]
                >(collab.sendableSteps(loadedModel.editor.state))
                  .with(null, () => [
                    Lens.fromProp<LoadedModel>()("areStepsInFlight").set(false)(
                      loadedModel
                    ),
                    cmd.none,
                  ])
                  .with(P.not(null), ({ version, steps }) => {
                    console.log("true sendable");
                    return [
                      Lens.fromProp<LoadedModel>()("areStepsInFlight").set(
                        true
                      )(loadedModel),
                      sendSteps(convex, loadedModel, version, steps),
                    ];
                  })
                  .exhaustive()
              )
              .with({ _tag: "StepsReceived" }, ({ steps }) => [
                loadedModel,
                receiveSteps(loadedModel.editor, steps),
              ])
              .exhaustive()
          )
      )
      .otherwise(() => [
        model,
        logMessage.report(stage)(
          logMessage.error("Mismatched model with msg", { model, msg })
        ),
      ]);

const receiveSteps: (
  editor: Editor,
  steps: NonEmptyArray<{ proseMirrorStep: string; clientId: string }>
) => Cmd<never> = (editor, steps_) => {
  const { steps, clientIds } = nonEmptyArray.reduce<
    { proseMirrorStep: string; clientId: string },
    { steps: Step[]; clientIds: string[] }
  >({ steps: [], clientIds: [] }, (result, step) => ({
    steps: [
      ...result.steps,
      Step.fromJSON(editor.schema, JSON.parse(step.proseMirrorStep)),
    ],
    clientIds: [...result.clientIds, step.clientId],
  }))(steps_);

  return pipe(
    () =>
      editor.view.dispatch(
        collab.receiveTransaction(editor.state, steps, clientIds, {
          mapSelectionBackward: true,
        })
      ),
    cmdExtra.fromIOVoid
  );
};

const sendSteps = (
  convex: ConvexReactClient<API>,
  loadedModel: LoadedModel,
  version: number,
  steps: ReadonlyArray<Step>
): Cmd<LoadedMsg> =>
  runMutation(
    convex.mutation("sendSteps"),
    () => option.some<LoadedMsg>({ _tag: "StepsSent" }),
    loadedModel.noteId,
    loadedModel.clientId,
    version,
    readonlyArray
      .toArray(steps)
      .map((step: Step) => JSON.stringify(step.toJSON()))
  );

// VIEW

export const view: (currentTime: number) => (model: Model) => Html<Msg> =
  (currentTime) => (model) => (dispatch_) =>
    match(model)
      .with(
        { _tag: "LoadingNoteAndClientId", noteId: P.select() },
        (noteId) => (
          <LoadingNoteAndClientId dispatch={dispatch_} noteId={noteId} />
        )
      )
      .with({ _tag: "LoadingEditor" }, { _tag: "Loaded" }, (model_) => (
        <LoadingEditorOrLoaded
          {...match<
            LoadingEditorModel | LoadedModel,
            Parameters<typeof LoadingEditorOrLoaded>[0]
          >(model_)
            .with(
              { _tag: "LoadingEditor" },
              ({
                versionedNote,
                clientId,
              }): Parameters<typeof LoadingEditorOrLoaded>[0] => ({
                dispatch: dispatch_,
                currentTime,
                noteId: versionedNote._id,
                creationTime: versionedNote._creationTime,
                initialProseMirrorDoc: versionedNote.proseMirrorDoc,
                initialVersion: versionedNote.version,
                clientId: clientId,
              })
            )
            .with(
              { _tag: "Loaded" },
              ({
                noteId,
                clientId,
                creationTime,
                initialProseMirrorDoc,
                initialVersion,
              }): Parameters<typeof LoadingEditorOrLoaded>[0] => ({
                dispatch: dispatch_,
                currentTime,
                noteId,
                creationTime,
                initialProseMirrorDoc,
                initialVersion,
                clientId,
              })
            )
            .exhaustive()}
        />
      ))
      .exhaustive();

const LoadingNoteAndClientId = ({
  dispatch: dispatch_,
  noteId,
}: {
  dispatch: Dispatch<Msg>;
  noteId: Id<"notes">;
}) => {
  const optionVersionedNote = option.fromNullable(
    useQuery("getVersionedNote", noteId)
  );

  useStableEffect(
    () => {
      match(optionVersionedNote)
        .with({ _tag: "None" }, constVoid)
        .with({ _tag: "Some", value: P.select() }, (versionedNote_) =>
          dispatch_({
            _tag: "GotLoadingNoteAndClientIdMsg",
            msg: {
              _tag: "VersionedNoteReceived",
              versionedNote: versionedNote_,
            },
          })
        )
        .exhaustive();
    },
    [optionVersionedNote, dispatch_],
    eq.tuple(option.getEq(versionedNote.Eq), dispatch.getEq<Msg>())
  );

  return null;
};

const LoadingEditorOrLoaded = ({
  dispatch,
  currentTime,
  noteId,
  creationTime,
  initialProseMirrorDoc,
  initialVersion,
  clientId,
}: {
  dispatch: Dispatch<Msg>;
  currentTime: number;
  noteId: Id<"notes">;
  creationTime: number;
  initialProseMirrorDoc: string;
  initialVersion: number;
  clientId: string;
}): ReactElement => {
  // I measured this manually in Chrome. This is obviously brittle, but also probably good enough for now.
  const scrollBounds = { top: 48, bottom: 96, left: 0, right: 0 };

  const editor = useEditor({
    editorProps: {
      attributes: {
        class: "px-8 pt-4 pb-12 focus:outline-none",
      },
      scrollMargin: {
        ...scrollBounds,
        top: scrollBounds.top + 42,
        bottom: scrollBounds.bottom + 42,
      },
      scrollThreshold: scrollBounds,
    },
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    content: JSON.parse(initialProseMirrorDoc) as string,
    extensions: [
      ...extensions,
      Placeholder.configure({
        placeholder: "Write something…",
      }),
      Extension.create({
        addProseMirrorPlugins: () => [
          collab.collab({ version: initialVersion, clientID: clientId }),
        ],
      }),
    ],
    onBeforeCreate: ({ editor: editor_ }) => {
      dispatch({
        _tag: "GotLoadingEditorMsg",
        msg: {
          _tag: "EditorLoaded",
          editor: editor_,
        },
      });
    },
    onTransaction: () => {
      dispatch({
        _tag: "GotLoadedMsg",
        msg: {
          _tag: "EditorTransactionApplied",
        },
      });
    },
  });

  const currentVersion = match(option.fromNullable(editor))
    .with({ _tag: "Some", value: P.select() }, (editor_) =>
      collab.getVersion(editor_.state)
    )
    .with({ _tag: "None" }, () => initialVersion)
    .exhaustive();

  const stepsSince = useQuery("getStepsSince", noteId, currentVersion);

  React.useEffect(() => {
    pipe(
      stepsSince,
      option.fromNullable,
      option.match(
        constVoid,
        flow(
          nonEmptyArray.fromArray,
          option.map(
            (steps): Msg => ({
              _tag: "GotLoadedMsg",
              msg: {
                _tag: "StepsReceived",
                steps,
              },
            })
          ),
          option.match(constVoid, (msg) => dispatch(msg))
        )
      )
    );
  }, [stepsSince, dispatch]);

  return editor ? (
    <LoadedEditor
      currentTime={currentTime}
      creationTime={creationTime}
      editor={editor}
    />
  ) : (
    <></>
  );
};

const LoadedEditor = ({
  currentTime,
  creationTime,
  editor,
}: {
  currentTime: number;
  creationTime: number;
  editor: ReactEditor;
}) => {
  const ref: React.Ref<HTMLDivElement> = React.useRef(null);

  // TODO: Only scroll down if note is in or above viewport
  useStableLayoutEffect(
    () => {
      // TODO
      match(option.fromNullable(ref.current))
        .with({ _tag: "Some", value: P.select() }, (value) =>
          window.scrollBy({ top: value.offsetHeight })
        )
        .with({ _tag: "None" }, constVoid)
        .exhaustive();
    },
    [],
    eq.tuple()
  );

  const creationDateTime = DateTime.fromMillis(creationTime);

  const formattedCreationTime = match<Duration, string>(
    DateTime.fromMillis(currentTime).diff(creationDateTime)
  )
    .when(
      (duration) => duration.as("minutes") < 1,
      () => "a few seconds ago"
    )
    .when(
      (duration) => duration.as("weeks") < 4,
      () => creationDateTime.toRelative() || ""
    )
    .otherwise(() =>
      creationDateTime.toLocaleString({
        year: "numeric",
        month: "short",
        day: "numeric",
        weekday: "short",
        hour: "numeric",
        minute: "numeric",
      })
    );

  return (
    <div ref={ref} className="flex flex-col">
      <div className="flex justify-between sticky px-8 top-12 font-light text-stone-500 bg-white z-10 border-b border-stone-300">
        <span>{formattedCreationTime}</span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

// SUBSCRIPTIONS

export const subscriptions: (model: Model) => Sub<Msg> = () => sub.none;
