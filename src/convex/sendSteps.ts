import { Node } from "prosemirror-model";
import { Step } from "prosemirror-transform";

import type { Id } from "~src/convex/_generated/dataModel";
import { mutation } from "~src/convex/_generated/server";
import getNoteVersion from "~src/convex/getNoteVersion";
import { schema } from "~src/tiptap-schema-extensions";

export default mutation(
  async (
    { db, auth },
    {
      noteId,
      clientId,
      clientPersistedVersion,
      steps,
    }: {
      noteId: Id<"notes">;
      clientId: string;
      clientPersistedVersion: number;
      steps: string[];
    },
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

        const docNode = Node.fromJSON(schema, JSON.parse(note.proseMirrorDoc));
        const updatedDocNode = steps.reduce(
          (currentDoc, step, currentIndex) => {
            const parsedStep = Step.fromJSON(schema, JSON.parse(step));

            db.insert("steps", {
              noteId,
              proseMirrorStep: step,
              clientId: clientId,
              position: persistedVersion + currentIndex + 1,
            });

            const nextDocNode = parsedStep.apply(currentDoc).doc;
            if (nextDocNode) {
              return nextDocNode;
            } else {
              throw "Failed to apply step";
            }
          },
          docNode,
        );

        await db.patch(note._id, {
          proseMirrorDoc: JSON.stringify(updatedDocNode.toJSON()),
        });
      } else {
        throw "Not authenticated";
      }
    }
  },
);
