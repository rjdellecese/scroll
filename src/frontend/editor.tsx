import { Editor, Extension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import type { Cmd } from "elm-ts/lib/Cmd";
import { cmd, sub } from "elm-ts/lib/index";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { nonEmptyArray, option, readonlyArray } from "fp-ts";
import { flow, pipe } from "fp-ts/function";
import type { IO } from "fp-ts/lib/IO";
import type { NonEmptyArray } from "fp-ts/lib/NonEmptyArray";
import { Lens } from "monocle-ts";
import * as collab from "prosemirror-collab";
import type { EditorState } from "prosemirror-state";
import { Step } from "prosemirror-transform";
import type { ReactElement } from "react";
import React from "react";
import { match, P } from "ts-pattern";

import type { Id } from "~src/backend/_generated/dataModel";
import type { ConvexAPI } from "~src/backend/_generated/react";
import * as cmdExtra from "~src/frontend/cmdExtra";
import type {
  SubscriptionInterop,
  SubscriptionManager,
} from "~src/frontend/subscriptionManager";
import * as subscriptionManager from "~src/frontend/subscriptionManager";
import { extensions } from "~src/tiptapSchemaExtensions";

import type { ElmTsConvexClient } from "./elmTsConvexClient";
import * as elmTsConvexClient from "./elmTsConvexClient";

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
      editor: Editor;
      subscriptionManager: SubscriptionManager<Msg>;
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
      editor: Editor;
      subscriptionManager: SubscriptionManager<Msg>;
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
  (convexClient: ElmTsConvexClient<ConvexAPI>) =>
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
                        elmTsConvexClient.runMutation(
                          convexClient,
                          () => ({
                            _tag: "GotInitializedEditorMsg",
                            msg: { _tag: "StepsSent" },
                          }),
                          "sendSteps",
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
            .with({ _tag: "StepsSent" }, () => {
              const sendableSteps = collab.sendableSteps(
                initializedEditorModel.initializableEditor.editor.state
              );

              return match<
                ReturnType<typeof collab.sendableSteps>,
                [Model, Cmd<Msg>]
              >(sendableSteps)
                .with(null, () => [
                  Lens.fromProp<Model>()("areStepsInFlight").set(false)(model),
                  cmd.none,
                ])
                .with(P.not(null), ({ version, steps }) => [
                  Lens.fromProp<Model>()("areStepsInFlight").set(true)(model),
                  elmTsConvexClient.runMutation(
                    convexClient,
                    () => ({
                      _tag: "GotInitializedEditorMsg",
                      msg: { _tag: "StepsSent" },
                    }),
                    "sendSteps",
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
              ({ editor, subscriptionManager }) => [
                {
                  ...initializingEditorModel,
                  initializableEditor: {
                    _tag: "InitializedEditor",
                    editor,
                    subscriptionManager,
                  },
                },
                cmd.none,
              ]
            )
            .exhaustive()
      )
      .otherwise(() => [model, cmd.none]); // TODO: Error

const receiveTransactionCmd: (
  editor: Editor,
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

const destroyEditorCmd = (editor: Editor): Cmd<never> =>
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
            const subscriptionInterop: SubscriptionInterop<Msg> =
              subscriptionManager.manageSubscriptions<Msg>()();

            return cmd.of<Msg>({
              _tag: "GotInitializingEditorMsg",
              msg: {
                _tag: "EditorWasInitialized",
                editor: new Editor({
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
                    subscriptionInterop.dispatch({
                      _tag: "GotInitializedEditorMsg",
                      msg: {
                        _tag: "EditorTransactionApplied",
                        editorState: props.editor.state,
                      },
                    })();
                  },
                }),
                subscriptionManager: subscriptionInterop.subscriptionManager,
              },
            });
          }
        )
      )
    )
  );

// VIEW

export const view: (model: Model) => Html<Msg> = (model) => (dispatch) =>
  (
    <EditorContent
      onMount={() =>
        dispatch({
          _tag: "GotInitializingEditorMsg",
          msg: { _tag: "ComponentDidMount" },
        })
      }
      onUnmount={() =>
        dispatch({
          _tag: "GotInitializedEditorMsg",
          msg: { _tag: "ComponentWillUnmount" },
        })
      }
      clientId={model.clientId}
    ></EditorContent>
  );

const EditorContent = (props: {
  onMount: IO<void>;
  onUnmount: IO<void>;
  clientId: string;
}): ReactElement => {
  React.useEffect(() => {
    props.onMount();
    return props.onUnmount;
  }, []);

  return <div id={editorId(props.clientId)}></div>;
};

const editorId = (clientId: string): string => `editor-${clientId}`;

// SUBSCRIPTIONS

export const subscriptions: (
  convexClient: ElmTsConvexClient<ConvexAPI>
) => (model: Model) => Sub<Msg> = (convexClient) => (model) =>
  match<Model, Sub<Msg>>(model)
    .with(
      { initializableEditor: { _tag: "InitializedEditor" } },
      (initializedEditorModel) =>
        sub.batch([
          subscriptionManager.subscriptions(
            initializedEditorModel.initializableEditor.subscriptionManager
          ),
          elmTsConvexClient.watchQuery(
            convexClient,
            flow(
              nonEmptyArray.fromArray,
              option.map((steps) => ({
                _tag: "GotInitializedEditorMsg",
                msg: {
                  _tag: "ReceivedSteps",
                  steps,
                },
              }))
            ),
            "getStepsSince",
            model.docId,
            collab.getVersion(
              initializedEditorModel.initializableEditor.editor.state
            )
          ),
        ])
    )
    .with(
      { initializableEditor: { _tag: "InitializingEditor" } },
      () => sub.none
    )
    .exhaustive();
