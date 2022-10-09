import * as React from "react";
import { Html } from "elm-ts/lib/React";
import { match, P } from "ts-pattern";
import { Cmd } from "elm-ts/lib/Cmd";
import { cmd } from "elm-ts";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import * as cmdExtra from "~/src/frontend/cmdExtra";
import { option } from "fp-ts";
import { flow, pipe } from "fp-ts/function";

// MODEl

export type Model =
  | { _tag: "LoadingEditor" }
  | { _tag: "LoadedEditor"; editor: Editor };

export const init: [Model, Cmd<Msg>] = [
  {
    _tag: "LoadingEditor",
  },
  pipe(
    () =>
      pipe(
        document.getElementById("editor"),
        option.fromNullable,
        option.map(
          flow(
            createEditor,
            (editor): Msg => ({ _tag: "EditorCreated", editor })
          )
        )
      ),
    cmdExtra.fromIO,
    cmdExtra.chain((optionEditorCreatedMsg) =>
      option.match(
        () => cmd.none,
        (editorCreatedMsg: Msg) => cmd.of(editorCreatedMsg)
      )(optionEditorCreatedMsg)
    )
  ),
];

const createEditor: (htmlElement: HTMLElement) => Editor = (htmlElement) =>
  new Editor({
    element: htmlElement,
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({
        placeholder: "Write something…",
        emptyNodeClass:
          "first:before:h-0 first:before:text-gray-400 first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none",
      }),
    ],
    content: "<p>Hello World!</p>",
  });

// UPDATE

export type Msg = { _tag: "EditorCreated"; editor: Editor };

export const update = (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
  match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
    .with([{ _tag: "EditorCreated", editor: P.select() }, P.any], (editor) => [
      { _tag: "LoadedEditor", editor },
      cmd.none,
    ])
    .exhaustive();

// VIEW

export const view: (model: Model) => Html<Msg> = (model: Model) => (dispatch) =>
  <div id="editor"></div>;
