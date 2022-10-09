import { Editor, Extension } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import type { Cmd } from "elm-ts/lib/Cmd";
import { cmd } from "elm-ts/lib/index";
import type { Sub } from "elm-ts/lib/Sub";
import { array, option, readonlyArray, task } from "fp-ts";
import { pipe } from "fp-ts/function";
import type { Option } from "fp-ts/Option";
import type { Task } from "fp-ts/Task";
import { observable } from "fp-ts-rxjs";
import { Lens } from "monocle-ts";
import * as collab from "prosemirror-collab";
import type { EditorState } from "prosemirror-state";
import { Step } from "prosemirror-transform";
import { match, P } from "ts-pattern";

import type { Id } from "~src/backend/_generated/dataModel";
import * as cmdExtra from "~src/frontend/cmdExtra";
import type {
  Interop,
  SubscriptionManager,
} from "~src/frontend/subscriptionManager";
import * as subscriptionManager from "~src/frontend/subscriptionManager";
import { extensions } from "~src/tiptapSchemaExtensions";

// MODEL

type Model = {
  docId: Id<"docs">;
  clientId: string;
  editor: Editor;
  areStepsInFlight: boolean;
  getStepsSince: any;
  sendSteps: any;
  subscriptionManager: SubscriptionManager<Msg>;
};

export const init = ({
  htmlElement,
  getStepsSince,
  sendSteps,
  docId,
  doc,
  version,
}: {
  htmlElement: HTMLElement;
  getStepsSince: any;
  sendSteps: any;
  docId: Id<"docs">;
  doc: string;
  version: number;
}): Model => {
  const interop: Interop<Msg> =
    subscriptionManager.manageSubscriptions<Msg>()();
  const clientId = crypto.randomUUID();

  const editor = new Editor({
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
      interop.dispatch({
        _tag: "EditorTransactionApplied",
        editorState: props.editor.state,
      })();
    },
  });

  return {
    docId,
    clientId,
    editor,
    getStepsSince,
    sendSteps,
    subscriptionManager: interop.subscriptionManager,
    areStepsInFlight: false,
  };
};

// UPDATE

export type Msg =
  | { _tag: "EditorTransactionApplied"; editorState: EditorState }
  | { _tag: "StepsSent" }
  | { _tag: "ReceivedSteps"; steps: string[]; clientIds: string[] };

export const update = (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
  match<Msg, [Model, Cmd<Msg>]>(msg)
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
                Lens.fromProp<Model>()("areStepsInFlight").set(true)(model),
                sendStepsCmd(model.sendSteps, {
                  docId: model.docId,
                  clientId: model.clientId,
                  version: version,
                  steps: readonlyArray.toArray(steps),
                }),
              ])
              .exhaustive();
          })
          .exhaustive()
    )
    .with({ _tag: "StepsSent" }, () => {
      const sendableSteps = collab.sendableSteps(model.editor.state);

      return match<ReturnType<typeof collab.sendableSteps>, [Model, Cmd<Msg>]>(
        sendableSteps
      )
        .with(null, () => [
          Lens.fromProp<Model>()("areStepsInFlight").set(false)(model),
          cmd.none,
        ])
        .with(P.not(null), ({ version, steps }) => [
          Lens.fromProp<Model>()("areStepsInFlight").set(true)(model),
          sendStepsCmd(model.sendSteps, {
            docId: model.docId,
            clientId: model.clientId,
            version: version,
            steps: readonlyArray.toArray(steps),
          }),
        ])
        .exhaustive();
    })
    .with({ _tag: "ReceivedSteps" }, ({ steps, clientIds }) => {
      const parsedSteps = array.map<string, Step>((step) =>
        Step.fromJSON(model.editor.schema, JSON.parse(step))
      )(steps);

      return [
        model,
        receiveTransactionCmd(model.editor, parsedSteps, clientIds),
      ];
    })
    .exhaustive();

const receiveTransactionCmd: (
  editor: Editor,
  steps: Step[],
  clientIds: string[]
) => Cmd<Msg> = (editor, steps, clientIds) =>
  pipe(
    () =>
      editor.view.dispatch(
        collab.receiveTransaction(editor.state, steps, clientIds, {
          mapSelectionBackward: true,
        })
      ),
    cmdExtra.fromIOVoid
  );

const sendStepsCmd: (
  sendSteps: any,
  args: {
    docId: Id<"docs">;
    clientId: string;
    version: number;
    steps: Step[];
  }
) => Cmd<Msg> = (sendSteps, { docId, clientId, version, steps }) =>
  pipe(
    sendSteps(
      docId,
      clientId,
      version,
      steps.map((step: Step) => JSON.stringify(step.toJSON()))
    ) as Task<null>,
    task.map((): Option<Msg> => option.some({ _tag: "StepsSent" })),
    observable.of
  );

// SUBSCRIPTIONS

export const subscriptions: (model: Model) => Sub<Msg> = (model) =>
  subscriptionManager.getSubscriptions(model.subscriptionManager);
