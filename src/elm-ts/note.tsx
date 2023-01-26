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
import type { IO } from "fp-ts/lib/IO";
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
import { useInView } from "react-intersection-observer";
import { match, P } from "ts-pattern";

import type { API } from "~src/convex/_generated/api";
import type { Id } from "~src/convex/_generated/dataModel";
import { useQuery } from "~src/convex/_generated/react";
import * as cmdExtra from "~src/elm-ts/cmd-extra";
import { runMutation } from "~src/elm-ts/convex-elm-ts";
import * as dispatch from "~src/elm-ts/dispatch-extra";
import * as logMessage from "~src/elm-ts/log-message";
import type { Stage } from "~src/elm-ts/stage";
import { extensions } from "~src/tiptap-schema-extensions";
import type { VersionedNote } from "~src/versioned-note";
import * as versionedNote from "~src/versioned-note";

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
  optionIntersectionStatus: Option<IntersectionStatus>;
};

type IntersectionStatus =
  | "PartiallyOrEntirelyInView"
  | "EntirelyAbove"
  | "EntirelyBelow";

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

export const creationTime = (model: Model): Option<number> =>
  match(model)
    .with(
      { _tag: "LoadingNoteAndClientId", optionVersionedNote: P.select() },
      option.map(({ _creationTime }: VersionedNote) => _creationTime)
    )
    .with(
      { _tag: "LoadingEditor", versionedNote: { _creationTime: P.select() } },
      option.some
    )
    .with({ _tag: "Loaded", creationTime: P.select() }, option.some)
    .exhaustive();

// `option.none` indicates that the note has not loaded yet
export const isInView = (model: Model): Option<boolean> =>
  match(model)
    .with({ _tag: "LoadingNoteAndClientId" }, () => option.none)
    .with({ _tag: "LoadingEditor" }, () => option.none)
    .with(
      { _tag: "Loaded", optionIntersectionStatus: P.select() },
      option.map((intersectionStatus) =>
        match(intersectionStatus)
          .with("PartiallyOrEntirelyInView", () => true)
          .otherwise(() => false)
      )
    )
    .exhaustive();

export const isLoaded = (model: Model): boolean =>
  match(model)
    .with({ _tag: "LoadingNoteAndClientId" }, () => false)
    .with({ _tag: "LoadingEditor" }, () => false)
    .with({ _tag: "Loaded" }, () => true)
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
  | { _tag: "ComponentDidMount"; el: HTMLDivElement }
  | {
      _tag: "IntersectionStatusChanged";
      intersectionStatus: IntersectionStatus;
    }
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
                (versionedNote_) => [
                  Lens.fromProp<LoadingNoteAndClientIdModel>()(
                    "optionVersionedNote"
                  ).set(option.some(versionedNote_))(
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
                    optionIntersectionStatus: option.none,
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
              (loadedMsg_): Msg => ({
                _tag: "GotLoadedMsg",
                msg: loadedMsg_,
              })
            )
          )(
            match<LoadedMsg, [LoadedModel, Cmd<LoadedMsg>]>(loadedMsg)
              .with({ _tag: "ComponentDidMount", el: P.select() }, (el) => [
                loadedModel,
                pipe(
                  el,
                  isAboveViewport,
                  io.map((isAboveViewport_) =>
                    match(isAboveViewport_)
                      .with(true, () =>
                        window.scrollBy({ top: el.offsetHeight })
                      )
                      .with(false, constVoid)
                      .exhaustive()
                  ),
                  cmdExtra.fromIOVoid,
                  cmdExtra.scheduleForNextAnimationFrame
                ),
              ])
              .with(
                {
                  _tag: "IntersectionStatusChanged",
                  intersectionStatus: P.select(),
                },
                (intersectionStatus) => [
                  Lens.fromProp<LoadedModel>()("optionIntersectionStatus").set(
                    option.some(intersectionStatus)
                  )(loadedModel),
                  cmd.none,
                ]
              )
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
                  .with(P.not(null), ({ version, steps }) => [
                    Lens.fromProp<LoadedModel>()("areStepsInFlight").set(true)(
                      loadedModel
                    ),
                    sendSteps(convex, loadedModel, version, steps),
                  ])
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
        (noteId_) => (
          <LoadingNoteAndClientId dispatch={dispatch_} noteId={noteId_} />
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
                versionedNote: versionedNote_,
                clientId,
              }): Parameters<typeof LoadingEditorOrLoaded>[0] => ({
                dispatch: dispatch_,
                currentTime,
                noteId: versionedNote_._id,
                creationTime: versionedNote_._creationTime,
                initialProseMirrorDoc: versionedNote_.proseMirrorDoc,
                initialVersion: versionedNote_.version,
                clientId: clientId,
              })
            )
            .with(
              { _tag: "Loaded" },
              ({
                noteId: noteId_,
                clientId,
                creationTime: creationTime_,
                initialProseMirrorDoc,
                initialVersion,
              }): Parameters<typeof LoadingEditorOrLoaded>[0] => ({
                dispatch: dispatch_,
                currentTime,
                noteId: noteId_,
                creationTime: creationTime_,
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
  noteId: noteId_,
}: {
  dispatch: Dispatch<Msg>;
  noteId: Id<"notes">;
}) => {
  const optionVersionedNote = option.fromNullable(
    useQuery("getVersionedNote", noteId_)
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
  dispatch: dispatch_,
  currentTime,
  noteId: noteId_,
  creationTime: creationTime_,
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
  const editor = useEditor({
    editorProps: {
      attributes: {
        class: "px-8 pt-4 pb-12 focus:outline-none",
      },
      scrollMargin: {
        top: 176,
        bottom: 176,
        left: 0,
        right: 0,
      },
      scrollThreshold: {
        top: 176,
        bottom: 176,
        left: 0,
        right: 0,
      },
    },
    // eslint-disable-next-line no-type-assertion/no-type-assertion
    content: JSON.parse(initialProseMirrorDoc),
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
      dispatch_({
        _tag: "GotLoadingEditorMsg",
        msg: {
          _tag: "EditorLoaded",
          editor: editor_,
        },
      });
    },
    onTransaction: () => {
      dispatch_({
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

  const stepsSince = useQuery("getStepsSince", noteId_, currentVersion);

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
          option.match(constVoid, (msg) => dispatch_(msg))
        )
      )
    );
  }, [stepsSince, dispatch_]);

  return editor ? (
    <LoadedEditor
      dispatch={dispatch_}
      currentTime={currentTime}
      creationTime={creationTime_}
      editor={editor}
    />
  ) : (
    <></>
  );
};

const LoadedEditor = ({
  dispatch: dispatch_,
  currentTime,
  creationTime: creationTime_,
  editor,
}: {
  dispatch: Dispatch<Msg>;
  currentTime: number;
  creationTime: number;
  editor: ReactEditor;
}) => {
  const componentDidMountRef = React.useRef<HTMLDivElement | null>(null);

  useStableLayoutEffect(
    () =>
      match(option.fromNullable(componentDidMountRef.current))
        .with({ _tag: "Some", value: P.select() }, (value) => {
          dispatch_({
            _tag: "GotLoadedMsg",
            msg: { _tag: "ComponentDidMount", el: value },
          });
        })
        .with({ _tag: "None" }, constVoid)
        .exhaustive(),
    [dispatch_],
    eq.tuple(dispatch.getEq<Msg>())
  );

  const { ref: inViewRef, entry } = useInView();

  useStableEffect(
    () => {
      if (entry) {
        dispatch_({
          _tag: "GotLoadedMsg",
          msg: {
            _tag: "IntersectionStatusChanged",
            intersectionStatus: entryToIntersectionStatus(entry),
          },
        });
      }
    },
    [dispatch_, entry],
    eq.tuple(dispatch.getEq<Msg>(), {
      equals: (
        entry1: IntersectionObserverEntry | undefined,
        entry2: IntersectionObserverEntry | undefined
      ) =>
        match<
          [
            IntersectionObserverEntry | undefined,
            IntersectionObserverEntry | undefined
          ],
          boolean
        >([entry1, entry2])
          .with([undefined, undefined], () => true)
          .with(
            [P.select("entry1_"), P.select("entry2_")],
            ({ entry1_, entry2_ }) =>
              !entry1_ || !entry2_
                ? false
                : entryToIntersectionStatus(entry1_) ===
                  entryToIntersectionStatus(entry2_)
          )
          .exhaustive(),
    })
  );

  React.useLayoutEffect(
    () => () => {
      const el = componentDidMountRef.current;

      if (el) {
        if (entry) {
          match<IntersectionStatus, void>(entryToIntersectionStatus(entry))
            .with("EntirelyAbove", () =>
              window.scrollBy({ top: -el.offsetHeight })
            )
            .with("EntirelyBelow", () => constVoid)
            .with("PartiallyOrEntirelyInView", constVoid)
            .exhaustive();
        }
      }
    },
    [entry]
  );

  const creationDateTime = DateTime.fromMillis(creationTime_);

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
    <div
      ref={(node) => {
        componentDidMountRef.current = node;
        inViewRef(node);
      }}
      className="flex flex-col"
    >
      <div className="flex justify-between sticky px-8 top-0 font-light text-stone-500 bg-white z-10 border-b border-stone-300">
        <span>{formattedCreationTime}</span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

const entryToIntersectionStatus = (
  entry: IntersectionObserverEntry
): IntersectionStatus =>
  match<boolean, IntersectionStatus>(entry.isIntersecting)
    .with(true, () => "PartiallyOrEntirelyInView")
    .with(false, () =>
      match<boolean, IntersectionStatus>(entry.boundingClientRect.top > 0)
        .with(true, () => "EntirelyBelow")
        .with(false, () => "EntirelyAbove")
        .exhaustive()
    )
    .exhaustive();

const isAboveViewport =
  (el: Element): IO<boolean> =>
  () =>
    pipe(
      el.getBoundingClientRect(),
      (rect) =>
        rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight)
    );

// SUBSCRIPTIONS

export const subscriptions: (model: Model) => Sub<Msg> = () => sub.none;
