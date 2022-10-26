import { Editor as TiptapEditor, Extension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import type { ConvexReactClient } from "convex/react";
import type { Cmd } from "elm-ts/lib/Cmd";
import { cmd, sub } from "elm-ts/lib/index";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { nonEmptyArray, option, readonlyArray } from "fp-ts";
import { constVoid, flow, pipe } from "fp-ts/function";
import type { NonEmptyArray } from "fp-ts/lib/NonEmptyArray";
import type { Option } from "fp-ts/lib/Option";
import { Lens } from "monocle-ts";
import * as collab from "prosemirror-collab";
import type { EditorState } from "prosemirror-state";
import { Step } from "prosemirror-transform";
import type { Dispatch, ReactElement } from "react";
import React from "react";
import { match, P } from "ts-pattern";

import type { Id } from "~src/backend/_generated/dataModel";
import type { ConvexAPI } from "~src/backend/_generated/react";
import { useQuery } from "~src/backend/_generated/react";
import type {
  CallbackInterop,
  CallbackManager,
} from "~src/frontend/callbackManager";
import * as callbackManager from "~src/frontend/callbackManager";
import * as cmdExtra from "~src/frontend/cmdExtra";
import { extensions } from "~src/tiptapSchemaExtensions";

import { runMutation } from "./convexElmTs";

// MODEL

export type Model = {
  initializableEditor: InitializableEditor;
  docId: Id<"docs">;
  clientId: string;
  areStepsInFlight: boolean;
};

// TODO: Maybe parameterize entire `Model` by this distinction?
type InitializableEditor =
  | {
      _tag: "InitializingEditor";
      doc: string;
      version: number;
    }
  | {
      _tag: "InitializedEditor";
      editor: TiptapEditor;
      callbackManager: CallbackManager<Msg>;
    };

export const init = ({
  docId,
  doc,
  version,
}: {
  docId: Id<"docs">;
  doc: string;
  version: number;
}): Model => {
  // TODO: This makes this function impure
  const clientId = crypto.randomUUID();

  return {
    docId,
    clientId,
    initializableEditor: { _tag: "InitializingEditor", doc, version },
    areStepsInFlight: false,
  };
};

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
    };

type InitializedEditorMsg =
  | { _tag: "EditorTransactionApplied"; editorState: EditorState }
  | { _tag: "StepsSent" }
  | {
      _tag: "ReceivedSteps";
      steps: NonEmptyArray<{ step: string; clientId: string }>;
    }
  | { _tag: "ComponentWillUnmount" };

export const update =
  (convex: ConvexReactClient<ConvexAPI>) =>
  (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
    match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
      .with(
        [
          { _tag: "GotInitializedEditorMsg" },
          { initializableEditor: { _tag: "InitializedEditor" } },
        ],
        ([{ msg: initializedEditorMsg }, initializedEditorModel]) =>
          match<InitializedEditorMsg, [Model, Cmd<Msg>]>(initializedEditorMsg)
            .with(
              { _tag: "EditorTransactionApplied", editorState: P.select() },
              (editorState) =>
                match<boolean, [Model, Cmd<Msg>]>(model.areStepsInFlight)
                  .with(true, () => [model, cmd.none])
                  .with(false, () => {
                    const sendableSteps = collab.sendableSteps(editorState);

                    return match<
                      ReturnType<typeof collab.sendableSteps>,
                      [Model, Cmd<Msg>]
                    >(sendableSteps)
                      .with(null, () => [model, cmd.none])
                      .with(P.not(null), ({ version, steps }) => [
                        Lens.fromProp<Model>()("areStepsInFlight").set(true)(
                          model
                        ),
                        runMutation(
                          convex.mutation("sendSteps"),
                          (): Option<Msg> =>
                            option.some({
                              _tag: "GotInitializedEditorMsg",
                              msg: { _tag: "StepsSent" },
                            }),
                          model.docId,
                          model.clientId,
                          version,
                          readonlyArray
                            .toArray(steps)
                            .map((step: Step) => JSON.stringify(step.toJSON()))
                        ),
                      ])
                      .exhaustive();
                  })
                  .exhaustive()
            )
            .with({ _tag: "StepsSent" }, () =>
              match<ReturnType<typeof collab.sendableSteps>, [Model, Cmd<Msg>]>(
                collab.sendableSteps(
                  initializedEditorModel.initializableEditor.editor.state
                )
              )
                .with(null, () => [
                  Lens.fromProp<Model>()("areStepsInFlight").set(false)(model),
                  cmd.none,
                ])
                .with(P.not(null), ({ version, steps }) => [
                  Lens.fromProp<Model>()("areStepsInFlight").set(true)(model),
                  // TODO: Same `"stepsSent"` call, extract and share?
                  runMutation(
                    convex.mutation("sendSteps"),
                    (): Option<Msg> =>
                      option.some({
                        _tag: "GotInitializedEditorMsg",
                        msg: { _tag: "StepsSent" },
                      }),
                    model.docId,
                    model.clientId,
                    version,
                    readonlyArray
                      .toArray(steps)
                      .map((step: Step) => JSON.stringify(step.toJSON()))
                  ),
                ])
                .exhaustive()
            )
            .with({ _tag: "ReceivedSteps" }, ({ steps }) => [
              model,
              receiveTransactionCmd(
                initializedEditorModel.initializableEditor.editor,
                steps
              ),
            ])
            .with({ _tag: "ComponentWillUnmount" }, () => [
              model,
              destroyEditorCmd(
                initializedEditorModel.initializableEditor.editor
              ),
            ])
            .exhaustive()
      )
      .with(
        [
          { _tag: "GotInitializingEditorMsg" },
          { initializableEditor: { _tag: "InitializingEditor" } },
        ],
        ([{ msg: initializingEditorMsg }, initializingEditorModel]) =>
          match<InitializingEditorMsg, [Model, Cmd<Msg>]>(initializingEditorMsg)
            .with({ _tag: "ComponentDidMount" }, () => [
              model,
              initializeEditorCmd({
                clientId: initializingEditorModel.clientId,
                doc: initializingEditorModel.initializableEditor.doc,
                version: initializingEditorModel.initializableEditor.version,
              }),
            ])
            .with(
              { _tag: "EditorWasInitialized" },
              ({ editor, callbackManager }) => [
                {
                  ...initializingEditorModel,
                  initializableEditor: {
                    _tag: "InitializedEditor",
                    editor,
                    callbackManager,
                  },
                },
                cmd.none,
              ]
            )
            .exhaustive()
      )
      .otherwise(() => [model, cmd.none]); // TODO: Error

const receiveTransactionCmd: (
  editor: TiptapEditor,
  steps: NonEmptyArray<{ step: string; clientId: string }>
) => Cmd<Msg> = (editor, steps_) => {
  const { steps, clientIds } = nonEmptyArray.reduce<
    { step: string; clientId: string },
    { steps: Step[]; clientIds: string[] }
  >({ steps: [], clientIds: [] }, (result, step) => ({
    steps: [
      ...result.steps,
      Step.fromJSON(editor.schema, JSON.parse(step.step)),
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

const initializeEditorCmd = ({
  clientId,
  doc,
  version,
}: {
  clientId: string;
  doc: string;
  version: number;
}): Cmd<Msg> =>
  pipe(
    () => document.getElementById(editorId(clientId)),
    cmdExtra.fromIO,
    cmdExtra.chain(
      flow(
        option.fromNullable,
        option.match(
          // TODO: Report error
          () => cmd.none,
          (htmlElement) => {
            const callbackInterop: CallbackInterop<Msg> =
              callbackManager.manageCallbacks<Msg>()();

            return cmd.of<Msg>({
              _tag: "GotInitializingEditorMsg",
              msg: {
                _tag: "EditorWasInitialized",
                editor: new TiptapEditor({
                  element: htmlElement,
                  content: JSON.parse(doc) as string,
                  extensions: [
                    ...extensions,
                    Placeholder.configure({
                      placeholder: "Write something…",
                      emptyNodeClass:
                        "first:before:h-0 first:before:text-gray-400 first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none",
                    }),
                    Extension.create({
                      addProseMirrorPlugins: () => [
                        collab.collab({ version, clientID: clientId }),
                      ],
                    }),
                  ],
                  onTransaction: (props) => {
                    callbackInterop.dispatch({
                      _tag: "GotInitializedEditorMsg",
                      msg: {
                        _tag: "EditorTransactionApplied",
                        editorState: props.editor.state,
                      },
                    })();
                  },
                }),
                callbackManager: callbackInterop.callbackManager,
              },
            });
          }
        )
      )
    )
  );

// VIEW

export const view: (model: Model) => Html<Msg> = (model) => (dispatch) => {
  const version = match(model.initializableEditor)
    .with(
      { _tag: "InitializingEditor", version: P.select() },
      (version) => version
    )
    .with({ _tag: "InitializedEditor", editor: P.select() }, (editor) =>
      collab.getVersion(editor.state)
    )
    .exhaustive();

  const docId = model.docId;

  const clientId = model.clientId;

  return (
    <Editor
      dispatch={dispatch}
      docId={docId}
      clientId={clientId}
      version={version}
    ></Editor>
  );
};

const Editor = ({
  dispatch,
  docId,
  clientId,
  version,
}: {
  dispatch: Dispatch<Msg>;
  docId: Id<"docs">;
  clientId: string;
  version: number;
}): ReactElement => {
  const stepsSince = useQuery("getStepsSince", docId, version);

  React.useEffect(
    () =>
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
      )(),
    [stepsSince, dispatch]
  );

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

  return <div id={editorId(clientId)}></div>;
};

const editorId = (clientId: string): string => `editor-${clientId}`;

// SUBSCRIPTIONS

export const subscriptions: (model: Model) => Sub<Msg> = (model) =>
  match<Model, Sub<Msg>>(model)
    .with(
      { initializableEditor: { _tag: "InitializedEditor" } },
      (initializedEditorModel) =>
        callbackManager.subscriptions(
          initializedEditorModel.initializableEditor.callbackManager
        )
    )
    .with(
      { initializableEditor: { _tag: "InitializingEditor" } },
      () => sub.none
    )
    .exhaustive();
