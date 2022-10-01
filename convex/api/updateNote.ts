import Underline from "@tiptap/extension-underline";
import { getSchema } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { array, either } from "fp-ts";
import { Either } from "fp-ts/lib/Either";
import { pipe, identity } from "fp-ts/lib/function";
import { Node } from "prosemirror-model";
import { Step } from "prosemirror-transform";
import { getVersion } from "../getVersion";
import { mutation } from "../_generated/server";

export default mutation(
  async (
    { db },
    clientId: string,
    clientPersistedVersion: number,
    steps: string[]
  ) => {
    console.log("clientId", clientId);
    console.log("clientPersistedVersion", clientPersistedVersion);
    console.log("steps", steps.length);

    const note = await db.table("note").first();
    if (note === null) {
      db.insert("note", {
        doc: "",
      });
      console.log("Created note.");
    } else {
      const persistedVersion = await getVersion(db, note._id);

      if (clientPersistedVersion !== persistedVersion) {
        console.log("Versions are not equal.");
        return;
      }

      // TODO: Extract and share b/w React and Convex
      const schema = getSchema([StarterKit, Underline]);

      const doc = JSON.parse(note.doc);
      const doc_ = Node.fromJSON(schema, doc);

      const steps_ = array.map<string, Step>((step) =>
        Step.fromJSON(schema, JSON.parse(step))
      )(steps);

      const applyStep: (step: Step) => (doc: Node) => Either<null, Node> =
        (step) => (doc) =>
          either.fromNullable(null)(step.apply(doc).doc);

      // Apply and accumulate new steps
      const updatedNote = pipe(
        steps_,
        array.reduce(doc_, (currentDoc: Node, step: Step) =>
          pipe(
            currentDoc,
            applyStep(step),
            either.match(() => doc_, identity)
          )
        ),
        (updatedDoc) => ({
          doc: JSON.stringify(updatedDoc.toJSON()),
        })
      );

      db.replace(note._id, updatedNote);

      array.reduce(
        clientPersistedVersion,
        (currentVersion: number, step: string) => {
          const nextVersion = currentVersion + 1;
          db.insert("step", {
            noteId: note._id,
            step: step,
            clientId: clientId,
            position: nextVersion,
          });
          return nextVersion;
        }
      )(steps);
    }
  }
);
