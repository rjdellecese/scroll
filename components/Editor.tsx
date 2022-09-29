import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { array, boolean, either, readonlyArray } from "fp-ts";
import { identity, pipe } from "fp-ts/lib/function";
import * as collab from "prosemirror-collab";
import { Step } from "prosemirror-transform";
import { useEffect, useRef } from "react";
import { match, P } from "ts-pattern";
import { Document } from "../convex/_generated/dataModel";
import { useMutation, useQuery } from "../convex/_generated/react";

const Editor = (props: { note: Document<"notes"> }) => {
  const note = props.note;

  const content = pipe(
    either.tryCatch(
      () => JSON.parse(note.doc),
      () => "<p>Hello world</p>"
    ),
    either.matchW(identity, identity)
  );

  const updateNote = useMutation("updateNote");
  const handleOnUpdate = async (
    clientId: string,
    version: number,
    steps: string[]
  ) => await updateNote(clientId, version, steps);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Extension.create({
        addProseMirrorPlugins: () => [
          collab.collab({ version: note.steps.length }),
        ],
      }),
    ],
    content,
    onTransaction(props) {
      const sendableSteps = collab.sendableSteps(props.editor.state);
      console.log("sendableSteps", sendableSteps);
      if (sendableSteps) {
        handleOnUpdate(
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
      }
    },
  });

  const stepsSince = useQuery(
    "getStepsSince",
    editor ? collab.getVersion(editor.state) : note.steps.length
  );

  useEffect(() => {
    console.log("stepsSince", stepsSince);
    if (editor && stepsSince) {
      const steps = array.map<string, Step>((step) =>
        Step.fromJSON(editor.schema, JSON.parse(step))
      )(stepsSince.steps);

      editor.view.dispatch(
        collab.receiveTransaction(editor.state, steps, stepsSince.clientIds)
      );
    }
  }, [editor, stepsSince]);

  return <EditorContent editor={editor} />;
};

export default Editor;
