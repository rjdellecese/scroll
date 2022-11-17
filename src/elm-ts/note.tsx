import { Editor as TiptapEditor, Extension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import type { ConvexReactClient } from "convex/react";
import type { Cmd } from "elm-ts/lib/Cmd";
import { cmd, sub } from "elm-ts/lib/index";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import type { magma } from "fp-ts";
import { io, nonEmptyArray, number, option, readonlyArray, tuple } from "fp-ts";
import { constVoid, flow, pipe } from "fp-ts/function";
import type { NonEmptyArray } from "fp-ts/lib/NonEmptyArray";
import type { Option } from "fp-ts/lib/Option";
import type * as ord from "fp-ts/lib/Ord";
import { Lens } from "monocle-ts";
import * as collab from "prosemirror-collab";
import { Step } from "prosemirror-transform";
import type { Dispatch, ReactElement } from "react";
import React from "react";
import { match, P } from "ts-pattern";

import type { API } from "~src/convex/_generated/api";
import type { Id } from "~src/convex/_generated/dataModel";
import { useQuery } from "~src/convex/_generated/react";
import type {
  CallbackInterop,
  CallbackManager,
} from "~src/elm-ts/callback-manager";
import * as callbackManager from "~src/elm-ts/callback-manager";
import * as cmdExtra from "~src/elm-ts/cmd-extra";
import { runMutation } from "~src/elm-ts/convex-elm-ts";
import * as logMessage from "~src/elm-ts/log-message";
import { extensions } from "~src/tiptap-schema-extensions";

import type { Stage } from "./stage";

// MODEL

export type Model = InitializingNoteModel | InitializedNoteModel;

type InitializingNoteModel = {
  _tag: "InitializingNote";
  noteId: Id<"notes">;
  creationTime: number;
  proseMirrorDoc: string;
  version: number;
  optionClientId: Option<string>;
  didComponentMount: boolean;
};

type InitializedNoteModel = {
  _tag: "InitializedNote";
  noteId: Id<"notes">;
  creationTime: number;
  clientId: string;
  editor: TiptapEditor;
  callbackManager: CallbackManager<Msg>;
  hasEditorMounted: boolean;
  areStepsInFlight: boolean;
};

export const Ord: ord.Ord<Model> = {
  equals: (x, y) => x.noteId.equals(y.noteId),
  compare: (first, second) =>
    number.Ord.compare(first.creationTime, second.creationTime),
};

export const Magma: magma.Magma<Model> = {
  concat: (x, _y) => x,
};

export const init = ({
  noteId,
  creationTime,
  proseMirrorDoc,
  version,
}: {
  noteId: Id<"notes">;
  creationTime: number;
  proseMirrorDoc: string;
  version: number;
}): [Model, Cmd<Msg>] => [
  {
    _tag: "InitializingNote",
    noteId,
    creationTime,
    proseMirrorDoc,
    version,
    optionClientId: option.none,
    didComponentMount: false,
  },
  pipe(
    () => crypto.randomUUID(),
    io.map(
      (clientId): Msg => ({
        _tag: "GotInitializingNoteMsg",
        msg: { _tag: "GeneratedClientId", clientId },
      })
    ),
    cmdExtra.fromIO
  ),
];

export const hasLoaded = (model: Model): boolean =>
  match(model)
    .with(
      { _tag: "InitializedNote", hasEditorMounted: P.select() },
      (hasEditorMounted) => hasEditorMounted
    )
    .with({ _tag: "InitializingNote" }, () => false)
    .exhaustive();

// UPDATE

export type Msg =
  | { _tag: "GotInitializingNoteMsg"; msg: InitializingNoteMsg }
  | { _tag: "GotInitializedNoteMsg"; msg: InitializedNoteMsg };

type InitializingNoteMsg =
  | { _tag: "ComponentDidMount" }
  | {
      _tag: "EditorWasInitialized";
      editor: TiptapEditor;
      callbackManager: CallbackManager<Msg>;
    }
  | { _tag: "GeneratedClientId"; clientId: string };

type InitializedNoteMsg =
  | { _tag: "EditorTransactionApplied" }
  | { _tag: "StepsSent" }
  | {
      _tag: "ReceivedSteps";
      steps: NonEmptyArray<{ proseMirrorStep: string; clientId: string }>;
    }
  | { _tag: "ComponentWillUnmount" };

export const update =
  (stage: Stage, convex: ConvexReactClient<API>) =>
  (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
    match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
      .with(
        [
          {
            _tag: "GotInitializingNoteMsg",
            msg: P.select("initializingNoteMsg"),
          },
          P.select("initializingNoteModel", { _tag: "InitializingNote" }),
        ],
        ({ initializingNoteMsg, initializingNoteModel }) =>
          match<InitializingNoteMsg, [Model, Cmd<Msg>]>(initializingNoteMsg)
            .with(
              { _tag: "GeneratedClientId", clientId: P.select() },
              (clientId) =>
                pipe(
                  initializingNoteModel,
                  Lens.fromProp<InitializingNoteModel>()("optionClientId").set(
                    option.some(clientId)
                  ),
                  initializeEditorIfPossible(stage)
                )
            )
            .with({ _tag: "ComponentDidMount" }, () =>
              pipe(
                initializingNoteModel,
                Lens.fromProp<InitializingNoteModel>()("didComponentMount").set(
                  true
                ),
                initializeEditorIfPossible(stage)
              )
            )
            .with(
              { _tag: "EditorWasInitialized" },
              ({ editor, callbackManager }): [Model, Cmd<Msg>] =>
                match<Option<string>, [Model, Cmd<Msg>]>(
                  initializingNoteModel.optionClientId
                )
                  .with({ _tag: "Some", value: P.select() }, (clientId) => [
                    {
                      _tag: "InitializedNote",
                      noteId: initializingNoteModel.noteId,
                      creationTime: initializingNoteModel.creationTime,
                      clientId,
                      editor,
                      callbackManager,
                      hasEditorMounted: false,
                      areStepsInFlight: false,
                    },
                    cmd.none,
                  ])
                  .with({ _tag: "None" }, () => [model, cmd.none])
                  .exhaustive()
            )
            .exhaustive()
      )
      .with(
        [
          {
            _tag: "GotInitializedNoteMsg",
            msg: P.select("initializedNoteMsg"),
          },
          P.select("initializedNoteModel", { _tag: "InitializedNote" }),
        ],
        ({ initializedNoteMsg, initializedNoteModel }) =>
          tuple.mapSnd<Cmd<InitializedNoteMsg>, Cmd<Msg>>(
            cmd.map(
              (initializedNoteMsg_): Msg => ({
                _tag: "GotInitializedNoteMsg",
                msg: initializedNoteMsg_,
              })
            )
          )(
            match<
              InitializedNoteMsg,
              [InitializedNoteModel, Cmd<InitializedNoteMsg>]
            >(initializedNoteMsg)
              .with({ _tag: "EditorTransactionApplied" }, () => {
                const editorHasMounted = (
                  initializedNoteModel: InitializedNoteModel
                ): InitializedNoteModel =>
                  match(initializedNoteModel.hasEditorMounted)
                    .with(true, () => initializedNoteModel)
                    .with(false, () =>
                      Lens.fromProp<InitializedNoteModel>()(
                        "hasEditorMounted"
                      ).set(true)(initializedNoteModel)
                    )
                    .exhaustive();

                return pipe(
                  match<
                    boolean,
                    [InitializedNoteModel, Cmd<InitializedNoteMsg>]
                  >(initializedNoteModel.areStepsInFlight)
                    .with(true, () => [initializedNoteModel, cmd.none])
                    .with(false, () =>
                      match<
                        ReturnType<typeof collab.sendableSteps>,
                        [InitializedNoteModel, Cmd<InitializedNoteMsg>]
                      >(collab.sendableSteps(initializedNoteModel.editor.state))
                        .with(null, () => [initializedNoteModel, cmd.none])
                        .with(P.not(null), ({ version, steps }) => [
                          Lens.fromProp<InitializedNoteModel>()(
                            "areStepsInFlight"
                          ).set(true)(initializedNoteModel),
                          sendStepsCmd(
                            convex,
                            initializedNoteModel,
                            version,
                            steps
                          ),
                        ])
                        .exhaustive()
                    )
                    .exhaustive(),
                  tuple.mapFst(editorHasMounted)
                );
              })
              .with({ _tag: "StepsSent" }, () =>
                match<
                  ReturnType<typeof collab.sendableSteps>,
                  [InitializedNoteModel, Cmd<InitializedNoteMsg>]
                >(collab.sendableSteps(initializedNoteModel.editor.state))
                  .with(null, () => [
                    Lens.fromProp<InitializedNoteModel>()(
                      "areStepsInFlight"
                    ).set(false)(initializedNoteModel),
                    cmd.none,
                  ])
                  .with(P.not(null), ({ version, steps }) => [
                    Lens.fromProp<InitializedNoteModel>()(
                      "areStepsInFlight"
                    ).set(true)(initializedNoteModel),
                    sendStepsCmd(convex, initializedNoteModel, version, steps),
                  ])
                  .exhaustive()
              )
              .with({ _tag: "ReceivedSteps" }, ({ steps }) => [
                initializedNoteModel,
                receiveTransactionCmd(initializedNoteModel.editor, steps),
              ])
              .with({ _tag: "ComponentWillUnmount" }, () => [
                initializedNoteModel,
                destroyEditorCmd(initializedNoteModel.editor),
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

const receiveTransactionCmd: (
  editor: TiptapEditor,
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

const destroyEditorCmd = (editor: TiptapEditor): Cmd<never> =>
  pipe(() => editor.destroy(), cmdExtra.fromIOVoid);

const initializeEditorIfPossible =
  (stage: Stage) =>
  (
    initializingNoteModel: InitializingNoteModel
  ): [InitializingNoteModel, Cmd<Msg>] =>
    pipe(
      initializingNoteModel,
      initializeEditor(stage),
      option.match(
        () => [initializingNoteModel, cmd.none],
        tuple.mapSnd(
          cmd.map(
            (initializingNoteMsg_: InitializingNoteMsg): Msg => ({
              _tag: "GotInitializingNoteMsg",
              msg: initializingNoteMsg_,
            })
          )
        )
      )
    );

const initializeEditor =
  (stage: Stage) =>
  (
    initializingNoteModel: InitializingNoteModel
  ): Option<[InitializingNoteModel, Cmd<InitializingNoteMsg>]> =>
    match<
      InitializingNoteModel,
      Option<[InitializingNoteModel, Cmd<InitializingNoteMsg>]>
    >(initializingNoteModel)
      .with(
        {
          optionClientId: { _tag: "Some", value: P.select("clientId") },
          didComponentMount: true,
        },
        ({ clientId }) =>
          option.some([
            initializingNoteModel,
            initializeEditorCmd({
              stage,
              clientId,
              proseMirrorDoc: initializingNoteModel.proseMirrorDoc,
              version: initializingNoteModel.version,
            }),
          ])
      )
      .otherwise(() => option.none);

const initializeEditorCmd = ({
  stage,
  clientId,
  proseMirrorDoc,
  version,
}: {
  stage: Stage;
  clientId: string;
  proseMirrorDoc: string;
  version: number;
}): Cmd<InitializingNoteMsg> =>
  pipe(
    () => document.getElementById(editorId_(clientId)),
    cmdExtra.fromIO,
    cmdExtra.chain(
      flow(
        option.fromNullable,
        option.match(
          () =>
            logMessage.report(stage)(
              logMessage.error("Failed to find editor element by HTML ID")
            ),
          (htmlElement) =>
            pipe((): InitializingNoteMsg => {
              const callbackInterop: CallbackInterop<Msg> =
                callbackManager.manageCallbacks<Msg>()();

              const editor: TiptapEditor = new TiptapEditor({
                editorProps: {
                  attributes: {
                    class: "flex-grow py-4 px-8 focus:outline-none",
                  },
                },
                element: htmlElement,
                // eslint-disable-next-line no-type-assertion/no-type-assertion
                content: JSON.parse(proseMirrorDoc) as string,
                extensions: [
                  ...extensions,
                  Placeholder.configure({
                    placeholder: "Write something…",
                    emptyNodeClass:
                      "first:before:h-0 first:before:text-stone-400 first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none",
                  }),
                  Extension.create({
                    addProseMirrorPlugins: () => [
                      collab.collab({ version, clientID: clientId }),
                    ],
                  }),
                ],
                onTransaction: () => {
                  callbackInterop.dispatch({
                    _tag: "GotInitializedNoteMsg",
                    msg: {
                      _tag: "EditorTransactionApplied",
                    },
                  })();
                },
              });
              return {
                _tag: "EditorWasInitialized",
                editor,
                callbackManager: callbackInterop.callbackManager,
              };
            }, cmdExtra.fromIO)
        )
      )
    ),
    cmdExtra.scheduleForNextAnimationFrame
  );

const sendStepsCmd = (
  convex: ConvexReactClient<API>,
  initializedNoteModel: InitializedNoteModel,
  version: number,
  steps: ReadonlyArray<Step>
): Cmd<InitializedNoteMsg> =>
  runMutation(
    convex.mutation("sendSteps"),
    () => option.some<InitializedNoteMsg>({ _tag: "StepsSent" }),
    initializedNoteModel.noteId,
    initializedNoteModel.clientId,
    version,
    readonlyArray
      .toArray(steps)
      .map((step: Step) => JSON.stringify(step.toJSON()))
  );

// VIEW

export const view: (model: Model) => Html<Msg> = (model) => (dispatch) =>
  match(model)
    .with({ _tag: "InitializingNote" }, ({ optionClientId, noteId, version }) =>
      match(optionClientId)
        .with({ _tag: "Some", value: P.select() }, (clientId) => (
          <Editor
            dispatch={dispatch}
            noteId={noteId}
            clientId={clientId}
            version={version}
          />
        ))
        .with({ _tag: "None" }, () => <></>)
        .exhaustive()
    )
    .with({ _tag: "InitializedNote" }, ({ noteId, clientId, editor }) => (
      <Editor
        dispatch={dispatch}
        noteId={noteId}
        clientId={clientId}
        version={collab.getVersion(editor.state)}
      />
    ))
    .exhaustive();

const Editor = ({
  dispatch,
  noteId,
  clientId,
  version,
}: {
  dispatch: Dispatch<Msg>;
  noteId: Id<"notes">;
  clientId: string;
  version: number;
}): ReactElement => {
  const stepsSince = useQuery("getStepsSince", noteId, version);

  React.useEffect(() => {
    pipe(
      stepsSince,
      option.fromNullable,
      option.match(
        () => constVoid,
        flow(
          nonEmptyArray.fromArray,
          option.map(
            (steps): Msg => ({
              _tag: "GotInitializedNoteMsg",
              msg: {
                _tag: "ReceivedSteps",
                steps,
              },
            })
          ),
          option.match(
            () => constVoid,
            (msg) => () => dispatch(msg)
          )
        )
      )
    )();
  }, [stepsSince, dispatch]);

  React.useEffect(() => {
    dispatch({
      _tag: "GotInitializingNoteMsg",
      msg: { _tag: "ComponentDidMount" },
    });

    return dispatch({
      _tag: "GotInitializedNoteMsg",
      msg: { _tag: "ComponentWillUnmount" },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div id={editorId_(clientId)} className="flex-grow" />;
};

// TODO: newtype `EditorId`
const editorId_ = (clientId: string): string => `editor-${clientId}`;

export const editorId = (model: Model): Option<string> =>
  match(model)
    .with({ _tag: "InitializingNote" }, () => option.none)
    .with({ _tag: "InitializedNote", clientId: P.select() }, (clientId) =>
      option.some(editorId_(clientId))
    )
    .exhaustive();

// SUBSCRIPTIONS

export const subscriptions: (model: Model) => Sub<Msg> = (model) =>
  match<Model, Sub<Msg>>(model)
    .with({ _tag: "InitializedNote" }, (initializedNoteModel) =>
      callbackManager.subscriptions(initializedNoteModel.callbackManager)
    )
    .with({ _tag: "InitializingNote" }, () => sub.none)
    .exhaustive();
