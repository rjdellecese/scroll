import type { NamedQuery } from "convex/browser";
import type { ConvexReactClient } from "convex/react";
import { cmd, html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { array, map, option, tuple } from "fp-ts";
import { apply, constVoid, identity, pipe } from "fp-ts/function";
import type { IO } from "fp-ts/lib/IO";
import type { Dispatch, ReactElement } from "react";
import React from "react";
import { match, P } from "ts-pattern";

import type { API } from "~src/convex/_generated/api";
import type { Document, Id } from "~src/convex/_generated/dataModel";
import { useQuery } from "~src/convex/_generated/react";
import { runMutation } from "~src/elm-ts/convex-elm-ts";
import * as editor from "~src/elm-ts/editor";
import * as logMessage from "~src/elm-ts/log-message";
import type { Stage } from "~src/elm-ts/stage";
import * as id from "~src/id";

// MODEl

export type Model =
  | { _tag: "LoadingDocs" }
  | { _tag: "LoadedDocs"; editors: Map<Id<"docs">, editor.Model> };

export const init: Model = {
  _tag: "LoadingDocs",
};

// UPDATE

export type Msg =
  | { _tag: "CreateDocButtonClicked" }
  | { _tag: "DocCreated"; docId: Id<"docs"> }
  | {
      _tag: "GotDocs";
      docs: Map<
        Id<"docs">,
        { doc: string; creationTime: number; version: number }
      >;
    }
  | {
      _tag: "GotEditorMsg";
      docId: Id<"docs">;
      msg: editor.Msg;
    };

export const update =
  (stage: Stage, convex: ConvexReactClient<API>) =>
  (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
    match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
      .with([{ _tag: "CreateDocButtonClicked" }, P.any], () => [
        model,
        runMutation(convex.mutation("createEmptyDoc"), (docId) =>
          option.some({
            _tag: "DocCreated",
            docId: docId,
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
            _tag: "GotDocs",
            docs: P.select(),
          },
          { _tag: "LoadingDocs" },
        ],
        (docs) =>
          pipe(
            docs,
            map.reduceWithIndex<Id<"docs">>(id.getOrd<"docs">())<
              {
                editors: Map<Id<"docs">, editor.Model>;
                cmds: Cmd<Msg>[];
              },
              {
                doc: Document<"docs">["doc"];
                creationTime: number;
                version: number;
              }
            >(
              {
                editors: new Map(),
                cmds: [],
              },
              (docId, { editors, cmds }, { doc, creationTime, version }) =>
                pipe(
                  editor.init({ docId, creationTime, doc, version }),
                  tuple.mapSnd(
                    cmd.map(
                      (editorMsg): Msg => ({
                        _tag: "GotEditorMsg",
                        docId,
                        msg: editorMsg,
                      })
                    )
                  ),
                  ([editor, cmd_]) => ({
                    editors: map.upsertAt(id.getEq<"docs">())(docId, editor)(
                      editors
                    ),
                    cmds: array.append(cmd_)(cmds),
                  })
                )
            ),
            ({ editors, cmds }) => [
              { _tag: "LoadedDocs", editors },
              cmd.batch(cmds),
            ]
          )
      )
      .with(
        [
          {
            _tag: "GotEditorMsg",
            docId: P.select("docId"),
            msg: P.select("editorMsg"),
          },
          { _tag: "LoadedDocs", editors: P.select("editors") },
        ],
        ({ docId, editorMsg, editors }) =>
          pipe(
            editors,
            map.lookup(id.getEq<"docs">())(docId),
            option.map((editorModel) =>
              pipe(
                editor.update(stage, convex)(editorMsg, editorModel),
                tuple.bimap(
                  cmd.map(
                    (editorMsg_): Msg => ({
                      _tag: "GotEditorMsg",
                      docId,
                      msg: editorMsg_,
                    })
                  ),
                  (editorModel_): Model => ({
                    _tag: "LoadedDocs",
                    editors: map.upsertAt(id.getEq<"docs">())(
                      docId,
                      editorModel_
                    )(editors),
                  })
                )
              )
            ),
            option.match(() => [model, cmd.none], identity)
          )
      )
      .otherwise(() => [
        model,
        logMessage.report(stage)(
          logMessage.error("Failed to match model with msg", { model, msg })
        ),
      ]);

// VIEW

export const view: (model: Model) => Html<Msg> = (model) =>
  match<Model, Html<Msg>>(model)
    .with({ _tag: "LoadingDocs" }, () => (dispatch) => (
      <LoadingDocs dispatch={dispatch} />
    ))
    .with(
      { _tag: "LoadedDocs", editors: P.select() },
      (editors) => (dispatch) =>
        <LoadedDocs dispatch={dispatch} editors={editors} />
    )
    .exhaustive();

const LoadingDocs = ({
  dispatch,
}: {
  dispatch: Dispatch<Msg>;
}): ReactElement => {
  const docs = option.fromNullable(useQuery("getDocs"));

  React.useEffect(
    () =>
      pipe(
        docs,
        option.match(
          () => constVoid,
          (docs: ReturnType<NamedQuery<API, "getDocs">>): IO<void> =>
            () =>
              dispatch({
                _tag: "GotDocs",
                docs,
              })
        )
      )(),
    [docs, dispatch]
  );

  return <p>Loading notes…</p>;
};

const LoadedDocs = ({
  dispatch,
  editors,
}: {
  dispatch: Dispatch<Msg>;
  editors: Map<Id<"docs">, editor.Model>;
}): ReactElement => (
  <>
    {pipe(
      editors,
      map.values(editor.Ord),
      array.map((editorModel) => (
        <React.Fragment key={editorModel.docId.toString()}>
          {pipe(
            editorModel,
            editor.view,
            html.map(
              (editorMsg): Msg => ({
                _tag: "GotEditorMsg",
                docId: editorModel.docId,
                msg: editorMsg,
              })
            ),
            apply(dispatch)
          )}
        </React.Fragment>
      ))
    )}
    <button onClick={() => dispatch({ _tag: "CreateDocButtonClicked" })}>
      Create note
    </button>
  </>
);

// SUBSCRIPTIONS

export const subscriptions = (model: Model) => {
  return match<Model, Sub<Msg>>(model)
    .with({ _tag: "LoadingDocs" }, () => sub.none)
    .with({ _tag: "LoadedDocs" }, ({ editors }) =>
      pipe(
        editors,
        map.reduceWithIndex<Id<"docs">>(id.getOrd<"docs">())<
          Sub<Msg>[],
          editor.Model
        >([], (docId, subs, editorModel) =>
          array.append(
            pipe(
              editorModel,
              editor.subscriptions,
              sub.map(
                (editorMsg): Msg => ({
                  _tag: "GotEditorMsg",
                  docId,
                  msg: editorMsg,
                })
              )
            )
          )(subs)
        ),
        sub.batch
      )
    )
    .exhaustive();
};
