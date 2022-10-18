import { Editor } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import type { QueryNames } from "convex/browser";
import { cmd, html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Html } from "elm-ts/lib/React";
import { option, tuple } from "fp-ts";
import { flow, hole, pipe } from "fp-ts/function";
import * as React from "react";
import { match, P } from "ts-pattern";

import * as cmdExtra from "~/src/frontend/cmdExtra";
import { Id } from "~src/backend/_generated/dataModel";
import type { ConvexAPI } from "~src/backend/_generated/react";
import * as editor from "~src/frontend/editor";
import * as elmTsConvexClient from "~src/frontend/elmTsConvexClient";

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
  (convexClient: elmTsConvexClient.ElmTsConvexClient<ConvexAPI>) =>
  (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
    match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
      .with([{ _tag: "CreateDocButtonClicked" }, P.any], () => [
        model,
        elmTsConvexClient.runMutation(
          convexClient,
          (result): Msg => {
            console.log("result", result);
            return {
              _tag: "DocCreated",
              docId: result.id,
            };
          },
          "createEmptyDoc"
        ),
      ])
      .with([{ _tag: "DocCreated", docId: P.select() }, P.any], (docId) => {
        // TODO
        console.log("docId", docId);
        return [model, cmd.none];
      })
      .with(
        [
          {
            _tag: "GotDocAndVersion",
            doc: P.select("doc"),
            version: P.select("version"),
          },
          P.any,
        ],
        ({ doc, version }) => [
          {
            _tag: "LoadedDoc",
            editorModel: editor.init({ docId: docId, doc, version }),
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
            editor.update(convexClient)(editorMsg, editorModel),
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

export const view: (model: Model) => Html<Msg> = (model: Model) =>
  match<Model, Html<Msg>>(model)
    .with({ _tag: "LoadingDoc" }, () => (dispatch) => (
      <>
        <button onClick={() => dispatch({ _tag: "CreateDocButtonClicked" })}>
          Create doc
        </button>
      </>
    ))
    .with(
      { _tag: "LoadedDoc", editorModel: P.select() },
      flow(
        editor.view,
        html.map((editorMsg) => ({ _tag: "GotEditorMsg", msg: editorMsg }))
      )
    )
    .exhaustive();

// SUBSCRIPTIONS

export const subscriptions =
  (convexClient: elmTsConvexClient.ElmTsConvexClient<ConvexAPI>) =>
  (model: Model) =>
    elmTsConvexClient.watchQuery(
      convexClient,
      ({ doc, version }): Msg => ({ _tag: "GotDocAndVersion", doc, version }),
      "getDocAndVersion",
      docId
    );

// TODO: Remove
const docId = new Id("docs", "X5vJ3yQ1NgeSr1SUNQZbQ1g");
