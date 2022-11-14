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

export type Model = InitializingEditorModel | InitializedEditorModel;

type InitializingEditorModel = {
  _tag: "InitializingEditor";
  noteId: Id<"notes">;
  creationTime: number;
  proseMirrorDoc: string;
  version: number;
  optionClientId: Option<string>;
  didComponentMount: boolean;
};

type InitializedEditorModel = {
  _tag: "InitializedEditor";
  noteId: Id<"notes">;
  creationTime: number;
  clientId: string;
  editor: TiptapEditor;
  callbackManager: CallbackManager<Msg>;
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
    _tag: "InitializingEditor",
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
        _tag: "GotInitializingEditorMsg",
        msg: { _tag: "GeneratedClientId", clientId },
      })
    ),
    cmdExtra.fromIO
  ),
];

// UPDATE

export type Msg =
  | { _tag: "GotInitializingEditorMsg"; msg: InitializingEditorMsg }
  | { _tag: "GotInitializedEditorMsg"; msg: InitializedEditorMsg };

type InitializingEditorMsg =
  | { _tag: "ComponentDidMount" }
  | {
      _tag: "EditorWasInitialized";
      editor: TiptapEditor;
      callbackManager: CallbackManager<Msg>;
    }
  | { _tag: "GeneratedClientId"; clientId: string };

type InitializedEditorMsg =
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
            _tag: "GotInitializingEditorMsg",
            msg: P.select("initializingEditorMsg"),
          },
          P.select("initializingEditorModel", { _tag: "InitializingEditor" }),
        ],
        ({ initializingEditorMsg, initializingEditorModel }) =>
          match<InitializingEditorMsg, [Model, Cmd<Msg>]>(initializingEditorMsg)
            .with(
              { _tag: "GeneratedClientId", clientId: P.select() },
              (clientId) =>
                pipe(
                  initializingEditorModel,
                  Lens.fromProp<InitializingEditorModel>()(
                    "optionClientId"
                  ).set(option.some(clientId)),
                  initializeEditorIfPossible(stage)
                )
            )
            .with({ _tag: "ComponentDidMount" }, () =>
              pipe(
                initializingEditorModel,
                Lens.fromProp<InitializingEditorModel>()(
                  "didComponentMount"
                ).set(true),
                initializeEditorIfPossible(stage)
              )
            )
            .with(
              { _tag: "EditorWasInitialized" },
              ({ editor, callbackManager }): [Model, Cmd<Msg>] =>
                match<Option<string>, [Model, Cmd<Msg>]>(
                  initializingEditorModel.optionClientId
                )
                  .with({ _tag: "Some", value: P.select() }, (clientId) => [
                    {
                      _tag: "InitializedEditor",
                      noteId: initializingEditorModel.noteId,
                      creationTime: initializingEditorModel.creationTime,
                      clientId,
                      editor,
                      callbackManager,
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
            _tag: "GotInitializedEditorMsg",
            msg: P.select("initializedEditorMsg"),
          },
          P.select("initializedEditorModel", { _tag: "InitializedEditor" }),
        ],
        ({ initializedEditorMsg, initializedEditorModel }) =>
          tuple.mapSnd<Cmd<InitializedEditorMsg>, Cmd<Msg>>(
            cmd.map(
              (initializedEditorMsg_): Msg => ({
                _tag: "GotInitializedEditorMsg",
                msg: initializedEditorMsg_,
              })
            )
          )(
            match<
              InitializedEditorMsg,
              [InitializedEditorModel, Cmd<InitializedEditorMsg>]
            >(initializedEditorMsg)
              .with({ _tag: "EditorTransactionApplied" }, () =>
                match<
                  boolean,
                  [InitializedEditorModel, Cmd<InitializedEditorMsg>]
                >(initializedEditorModel.areStepsInFlight)
                  .with(true, () => [initializedEditorModel, cmd.none])
                  .with(false, () =>
                    match<
                      ReturnType<typeof collab.sendableSteps>,
                      [InitializedEditorModel, Cmd<InitializedEditorMsg>]
                    >(collab.sendableSteps(initializedEditorModel.editor.state))
                      .with(null, () => [initializedEditorModel, cmd.none])
                      .with(P.not(null), ({ version, steps }) => [
                        Lens.fromProp<InitializedEditorModel>()(
                          "areStepsInFlight"
                        ).set(true)(initializedEditorModel),
                        sendStepsCmd(
                          convex,
                          initializedEditorModel,
                          version,
                          steps
                        ),
                      ])
                      .exhaustive()
                  )
                  .exhaustive()
              )
              .with({ _tag: "StepsSent" }, () =>
                match<
                  ReturnType<typeof collab.sendableSteps>,
                  [InitializedEditorModel, Cmd<InitializedEditorMsg>]
                >(collab.sendableSteps(initializedEditorModel.editor.state))
                  .with(null, () => [
                    Lens.fromProp<InitializedEditorModel>()(
                      "areStepsInFlight"
                    ).set(false)(initializedEditorModel),
                    cmd.none,
                  ])
                  .with(P.not(null), ({ version, steps }) => [
                    Lens.fromProp<InitializedEditorModel>()(
                      "areStepsInFlight"
                    ).set(true)(initializedEditorModel),
                    sendStepsCmd(
                      convex,
                      initializedEditorModel,
                      version,
                      steps
                    ),
                  ])
                  .exhaustive()
              )
              .with({ _tag: "ReceivedSteps" }, ({ steps }) => [
                initializedEditorModel,
                receiveTransactionCmd(initializedEditorModel.editor, steps),
              ])
              .with({ _tag: "ComponentWillUnmount" }, () => [
                initializedEditorModel,
                destroyEditorCmd(initializedEditorModel.editor),
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
    initializingEditorModel: InitializingEditorModel
  ): [InitializingEditorModel, Cmd<Msg>] =>
    pipe(
      initializingEditorModel,
      initializeEditor(stage),
      option.match(
        () => [initializingEditorModel, cmd.none],
        tuple.mapSnd(
          cmd.map(
            (initializingEditorMsg_: InitializingEditorMsg): Msg => ({
              _tag: "GotInitializingEditorMsg",
              msg: initializingEditorMsg_,
            })
          )
        )
      )
    );

const initializeEditor =
  (stage: Stage) =>
  (
    initializingEditorModel: InitializingEditorModel
  ): Option<[InitializingEditorModel, Cmd<InitializingEditorMsg>]> =>
    match<
      InitializingEditorModel,
      Option<[InitializingEditorModel, Cmd<InitializingEditorMsg>]>
    >(initializingEditorModel)
      .with(
        {
          optionClientId: { _tag: "Some", value: P.select("clientId") },
          didComponentMount: true,
        },
        ({ clientId }) =>
          option.some([
            initializingEditorModel,
            initializeEditorCmd({
              stage,
              clientId,
              proseMirrorDoc: initializingEditorModel.proseMirrorDoc,
              version: initializingEditorModel.version,
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
}): Cmd<InitializingEditorMsg> =>
  pipe(
    () => document.getElementById(editorId(clientId)),
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
            pipe((): InitializingEditorMsg => {
              const callbackInterop: CallbackInterop<Msg> =
                callbackManager.manageCallbacks<Msg>()();

              return {
                _tag: "EditorWasInitialized",
                editor: new TiptapEditor({
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
                      _tag: "GotInitializedEditorMsg",
                      msg: {
                        _tag: "EditorTransactionApplied",
                      },
                    })();
                  },
                }),
                callbackManager: callbackInterop.callbackManager,
              };
            }, cmdExtra.fromIO)
        )
      )
    )
  );

const sendStepsCmd = (
  convex: ConvexReactClient<API>,
  initializedEditorModel: InitializedEditorModel,
  version: number,
  steps: ReadonlyArray<Step>
): Cmd<InitializedEditorMsg> =>
  runMutation(
    convex.mutation("sendSteps"),
    () => option.some<InitializedEditorMsg>({ _tag: "StepsSent" }),
    initializedEditorModel.noteId,
    initializedEditorModel.clientId,
    version,
    readonlyArray
      .toArray(steps)
      .map((step: Step) => JSON.stringify(step.toJSON()))
  );

// VIEW

export const view: (model: Model) => Html<Msg> = (model) => (dispatch) =>
  match(model)
    .with(
      { _tag: "InitializingEditor" },
      ({ optionClientId, noteId, version }) =>
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
    .with({ _tag: "InitializedEditor" }, ({ noteId, clientId, editor }) => (
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
              _tag: "GotInitializedEditorMsg",
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
      _tag: "GotInitializingEditorMsg",
      msg: { _tag: "ComponentDidMount" },
    });

    return dispatch({
      _tag: "GotInitializedEditorMsg",
      msg: { _tag: "ComponentWillUnmount" },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div id={editorId(clientId)} className="flex-grow" />;
};

const editorId = (clientId: string): string => `editor-${clientId}`;

// SUBSCRIPTIONS

export const subscriptions: (model: Model) => Sub<Msg> = (model) =>
  match<Model, Sub<Msg>>(model)
    .with({ _tag: "InitializedEditor" }, (initializedEditorModel) =>
      callbackManager.subscriptions(initializedEditorModel.callbackManager)
    )
    .with({ _tag: "InitializingEditor" }, () => sub.none)
    .exhaustive();