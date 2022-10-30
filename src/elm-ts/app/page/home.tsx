import type { NamedQuery } from "convex/browser";
import type { ConvexReactClient } from "convex/react";
import { cmd, html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { option, tuple } from "fp-ts";
import { constVoid, flow, pipe } from "fp-ts/function";
import type { IO } from "fp-ts/lib/IO";
import type { Dispatch } from "react";
import React from "react";
import { match, P } from "ts-pattern";

import { Id } from "~src/convex/_generated/dataModel";
import type { ConvexAPI } from "~src/convex/_generated/react";
import { useQuery } from "~src/convex/_generated/react";
import { runMutation } from "~src/elm-ts/convex-elm-ts";
import * as editor from "~src/elm-ts/editor";
import type { Stage } from "~src/elm-ts/stage";
import * as logMessage from "~src/elm-ts/log-message";

// MODEl

export type Model =
  | { _tag: "LoadingDoc" }
  | { _tag: "LoadedDoc"; editorModel: editor.Model };

export const init: Model = {
  _tag: "LoadingDoc",
};

// UPDATE

export type Msg =
  | { _tag: "CreateDocButtonClicked" }
  | { _tag: "DocCreated"; docId: Id<"docs"> }
  | { _tag: "GotDocAndVersion"; doc: string; version: number }
  | { _tag: "GotEditorMsg"; msg: editor.Msg };

export const update =
  (stage: Stage, convex: ConvexReactClient<ConvexAPI>) =>
  (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
    match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
      .with([{ _tag: "CreateDocButtonClicked" }, P.any], () => [
        model,
        runMutation(convex.mutation("createEmptyDoc"), (result) =>
          option.some({
            _tag: "DocCreated",
            docId: result.id,
          })
        ),
      ])
      .with([{ _tag: "DocCreated", docId: P.select() }, P.any], () => {
        // TODO
        return [model, cmd.none];
      })
      .with(
        [
          {
            _tag: "GotDocAndVersion",
            doc: P.select("doc"),
            version: P.select("version"),
          },
          { _tag: "LoadingDoc" },
        ],
        ({ doc, version }) =>
          pipe(
            editor.init({ docId: fixedDocId, doc, version }),
            tuple.bimap(
              cmd.map(
                (editorMsg): Msg => ({ _tag: "GotEditorMsg", msg: editorMsg })
              ),
              (editorModel): Model => ({
                _tag: "LoadedDoc",
                editorModel,
              })
            )
          )
      )
      .with(
        [
          { _tag: "GotEditorMsg", msg: P.select("editorMsg") },
          { _tag: "LoadedDoc", editorModel: P.select("editorModel") },
        ],
        ({ editorMsg, editorModel }) =>
          pipe(
            editor.update(stage, convex)(editorMsg, editorModel),
            tuple.bimap(
              cmd.map((editorMsg_) => ({
                _tag: "GotEditorMsg",
                msg: editorMsg_,
              })),
              (editorModel_) => ({
                _tag: "LoadedDoc",
                editorModel: editorModel_,
              })
            )
          )
      )
      .otherwise(() => [
        model,
        logMessage.report(stage)(
          logMessage.error(`Failed to match model "${model}" with msg ${msg}`)
        ),
      ]);

// VIEW

export const view: (model: Model) => Html<Msg> = (model) =>
  match<Model, Html<Msg>>(model)
    .with({ _tag: "LoadingDoc" }, () => (dispatch) => {
      const docId = fixedDocId;

      return <LoadingDoc dispatch={dispatch} docId={docId}></LoadingDoc>;
    })
    .with(
      { _tag: "LoadedDoc", editorModel: P.select() },
      flow(
        editor.view,
        html.map((editorMsg) => ({ _tag: "GotEditorMsg", msg: editorMsg }))
      )
    )
    .exhaustive();

const LoadingDoc = ({
  dispatch,
  docId,
}: {
  dispatch: Dispatch<Msg>;
  docId: Id<"docs">;
}) => {
  const docAndVersion = option.fromNullable(
    useQuery("getDocAndVersion", docId)
  );

  React.useEffect(
    () =>
      pipe(
        docAndVersion,
        option.match(
          () => constVoid,
          ({
              doc,
              version,
            }: ReturnType<
              NamedQuery<ConvexAPI, "getDocAndVersion">
            >): IO<void> =>
            () =>
              dispatch({
                _tag: "GotDocAndVersion",
                doc,
                version,
              })
        )
      )(),
    [docAndVersion, dispatch]
  );

  return (
    <button onClick={() => dispatch({ _tag: "CreateDocButtonClicked" })}>
      Create doc
    </button>
  );
};

// SUBSCRIPTIONS

export const subscriptions = (model: Model) => {
  return match<Model, Sub<Msg>>(model)
    .with({ _tag: "LoadingDoc" }, () => sub.none)
    .with({ _tag: "LoadedDoc" }, ({ editorModel }) =>
      pipe(
        editor.subscriptions(editorModel),
        sub.map((editorMsg) => ({ _tag: "GotEditorMsg", msg: editorMsg }))
      )
    )
    .exhaustive();
};

// TODO: Remove
const fixedDocId = new Id("docs", "P0Yf4Ea3jkfK9Sn8hBT8CHe");
