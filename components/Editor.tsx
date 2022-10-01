import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Editor as TiptapEditor } from "@tiptap/core";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { array, either, option, readonlyArray } from "fp-ts";
import { constVoid, identity, pipe } from "fp-ts/lib/function";
import * as collab from "prosemirror-collab";
import { Step } from "prosemirror-transform";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { match, P } from "ts-pattern";
import { Document } from "../convex/_generated/dataModel";
import { useMutation, useQuery } from "../convex/_generated/react";
import { nanoid } from "nanoid";

const Editor = (props: {
  doc: Document<"note">["doc"];
  persistedVersion: number;
}) => {
  const content = pipe(
    either.tryCatch(
      () => JSON.parse(props.doc),
      () => "<p>Hello world</p>"
    ),
    either.matchW(identity, identity)
  );

  const updateNote = useMutation("api/updateNote");

  const clientId = nanoid();

  const [isUpdatingNote, setIsUpdatingNote] = useState(false);
  const isUpdatingNoteRef = useRef(isUpdatingNote);
  isUpdatingNoteRef.current = isUpdatingNote;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Extension.create({
        addProseMirrorPlugins: () => [
          collab.collab({
            version: props.persistedVersion,
            clientID: clientId,
          }),
        ],
      }),
      Placeholder.configure({
        placeholder: "Write something…",
        emptyNodeClass:
          "first:before:h-0 first:before:text-gray-400 first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none",
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: "h-screen w-screen cursor-text p-5 focus:outline-none",
      },
    },
    onTransaction(props) {
      maybeSendSendableSteps(
        { isUpdatingNote: isUpdatingNoteRef.current },
        updateNote,
        setIsUpdatingNote,
        props.editor
      );
    },
  });

  useEffect(() => {
    if (editor) {
      maybeSendSendableSteps(
        { isUpdatingNote },
        updateNote,
        setIsUpdatingNote,
        editor
      );
    }
  }, [editor, isUpdatingNote, updateNote]);

  const stepsSince = useQuery(
    "api/getStepsSince",
    editor ? collab.getVersion(editor.state) : props.persistedVersion
  );

  useEffect(() => {
    console.log("stepsSince", stepsSince);
    match(option.fromNullable(editor))
      .with(option.none, constVoid)
      .with({ _tag: "Some", value: P.select() }, (editor_) =>
        match(option.fromNullable(stepsSince))
          .with(option.none, () => constVoid)
          .with(
            { _tag: "Some", value: { steps: [], clientIds: [] } },
            constVoid
          )
          .with({ _tag: "Some", value: P.select() }, ({ steps, clientIds }) => {
            const parsedSteps = array.map<string, Step>((step) =>
              Step.fromJSON(editor_.schema, JSON.parse(step))
            )(steps);

            editor_.view.dispatch(
              collab.receiveTransaction(editor_.state, parsedSteps, clientIds, {
                mapSelectionBackward: true,
              })
            );
          })
          .exhaustive()
      )
      .exhaustive();
  }, [editor, stepsSince, clientId]);

  return <EditorContent editor={editor} />;
};

const sendSendableSteps = (
  updateNote: ReturnType<typeof useMutation<"api/updateNote">>,
  sendableSteps: NonNullable<ReturnType<typeof collab.sendableSteps>>
): Promise<null> => {
  console.log("sending sendableSteps");
  return updateNote(
    match(sendableSteps.clientID)
      .with(P.number, (clientId) => clientId.toString())
      .with(P.string, identity)
      .exhaustive(),
    sendableSteps.version,
    pipe(
      sendableSteps.steps,
      readonlyArray.toArray,
      array.map((step: Step) => JSON.stringify(step.toJSON()))
    )
  );
};

const maybeSendSendableSteps = (
  {
    isUpdatingNote,
  }: {
    isUpdatingNote: boolean;
  },
  updateNote: ReturnType<typeof useMutation<"api/updateNote">>,
  setIsUpdatingNote: Dispatch<SetStateAction<boolean>>,
  editor: TiptapEditor
): void => {
  console.log("maybeSendSendableSteps");
  match(isUpdatingNote)
    .with(true, constVoid)
    .with(false, () => {
      match(option.fromNullable(collab.sendableSteps(editor.state)))
        .with(option.none, constVoid)
        .with({ _tag: "Some", value: P.select() }, (sendableSteps) => {
          console.log("actually send sendableSteps");
          sendSendableSteps(updateNote, sendableSteps).then(() =>
            setIsUpdatingNote(false)
          );
          setIsUpdatingNote(true);
        })
        .exhaustive();
    })
    .exhaustive();
};

export default Editor;
