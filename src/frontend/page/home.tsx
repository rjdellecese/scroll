import { NamedQuery } from "convex/browser";
import { ConvexReactClient } from "convex/react";
import { cmd, html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { option, tuple } from "fp-ts";
import { constVoid, flow, pipe } from "fp-ts/function";
import { IO } from "fp-ts/lib/IO";
import type { Option } from "fp-ts/lib/Option";
import * as React from "react";
import { match, P } from "ts-pattern";

import { Id } from "~src/backend/_generated/dataModel";
import { ConvexAPI, useQuery } from "~src/backend/_generated/react";
import * as editor from "~src/frontend/editor";
import * as elmTsConvexClient from "~src/frontend/elmTsConvexClient";
import { runMutation } from "../convexElmTs";

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
  (convex: ConvexReactClient<ConvexAPI>) =>
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
      .with([{ _tag: "DocCreated", docId: P.select() }, P.any], (docId) => {
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
        ({ doc, version }) => [
          {
            _tag: "LoadedDoc",
            editorModel: editor.init({ docId: fixedDocId, doc, version }),
          },
          cmd.none,
        ]
      )
      .with(
        [
          { _tag: "GotEditorMsg", msg: P.select("editorMsg") },
          { _tag: "LoadedDoc", editorModel: P.select("editorModel") },
        ],
        ({ editorMsg, editorModel }) =>
          pipe(
            editor.update(convex)(editorMsg, editorModel),
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
      // TODO
      .otherwise(() => [model, cmd.none]);

// VIEW

export const view: (model: Model) => Html<Msg> = (model) => (dispatch) =>
  match<Model, Html<Msg>>(model)
    .with({ _tag: "LoadingDoc" }, () => (dispatch) => {
      const onGotDocAndVersion =
        ({
          doc,
          version,
        }: ReturnType<NamedQuery<ConvexAPI, "getDocAndVersion">>): IO<void> =>
        () =>
          dispatch({
            _tag: "GotDocAndVersion",
            doc,
            version,
          });

      const onCreateDocButtonClicked = () =>
        dispatch({ _tag: "CreateDocButtonClicked" });

      const docId = fixedDocId;

      return (
        <LoadingDoc
          onGotDocAndVersion={onGotDocAndVersion}
          onCreateDocButtonClicked={onCreateDocButtonClicked}
          docId={docId}
        ></LoadingDoc>
      );
    })
    .with(
      { _tag: "LoadedDoc", editorModel: P.select() },
      flow(
        editor.view,
        html.map((editorMsg) => ({ _tag: "GotEditorMsg", msg: editorMsg }))
      )
    )
    .exhaustive()(dispatch);

const LoadingDoc = ({
  onGotDocAndVersion,
  onCreateDocButtonClicked,
  docId,
}: {
  onGotDocAndVersion: (
    docAndVersion: ReturnType<NamedQuery<ConvexAPI, "getDocAndVersion">>
  ) => IO<void>;
  onCreateDocButtonClicked: IO<void>;
  docId: Id<"docs">;
}) => {
  const docAndVersion = option.fromNullable(
    useQuery("getDocAndVersion", docId)
  );

  React.useEffect(
    () => option.match(() => constVoid, onGotDocAndVersion)(docAndVersion)(),
    [docAndVersion, onGotDocAndVersion]
  );

  return <button onClick={() => onCreateDocButtonClicked()}>Create doc</button>;
};

// SUBSCRIPTIONS

export const subscriptions = (model: Model) => {
  // TODO Revert this whole function
  // const getDocAndVersionSub = elmTsConvexClient.watchQuery(
  //   convexClient,
  //   ({ doc, version }): Option<Msg> =>
  //     option.some({
  //       _tag: "GotDocAndVersion",
  //       doc,
  //       version,
  //     }),
  //   "getDocAndVersion",
  //   docId
  // );

  return match<Model, Sub<Msg>>(model)
    .with(
      { _tag: "LoadingDoc" },
      () =>
        // TODO
        // getDocAndVersionSub
        sub.none
    )
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
