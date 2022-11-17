import { Node } from "prosemirror-model";
import { Step } from "prosemirror-transform";

import { schema } from "../tiptap-schema-extensions";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import getNoteVersion from "./getNoteVersion";

export default mutation(
  async (
    { db, auth },
    noteId: Id<"notes">,
    clientId: string,
    clientPersistedVersion: number,
    steps: string[]
  ): Promise<void> => {
    const note = await db.get(noteId);
    const userIdentity = await auth.getUserIdentity();

    if (note === null) {
      throw "Couldn't find note";
    } else {
      if (userIdentity) {
        if (note.owner !== userIdentity.tokenIdentifier) {
          throw "User does not own this note";
        }

        const persistedVersion = await getNoteVersion(db, note._id);

        if (clientPersistedVersion !== persistedVersion) {
          return;
        }

        const parsedDoc = Node.fromJSON(
          schema,
          JSON.parse(note.proseMirrorDoc)
        );
        const updatedParsedDoc = steps.reduce(
          (currentDoc, step, currentIndex) => {
            const parsedStep = Step.fromJSON(schema, JSON.parse(step));

            db.insert("steps", {
              noteId,
              proseMirrorStep: step,
              clientId: clientId,
              position: persistedVersion + currentIndex + 1,
            });

            const nextDoc = parsedStep.apply(currentDoc).doc;
            if (nextDoc) {
              return nextDoc;
            } else {
              throw "Failed to apply step";
            }
          },
          parsedDoc
        );

        await db.patch(note._id, {
          proseMirrorDoc: JSON.stringify(updatedParsedDoc.toJSON()),
        });
      } else {
        throw "Not authenticated";
      }
    }
  }
);
