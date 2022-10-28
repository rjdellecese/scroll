import { Node } from "prosemirror-model";
import { Step } from "prosemirror-transform";

import { schema } from "../tiptap-schema-extensions";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import getVersion from "./getVersion";

export default mutation(
  async (
    { db },
    docId: Id<"docs">,
    clientId: string,
    clientPersistedVersion: number,
    steps: string[]
  ): Promise<void> => {
    const doc = await db.get(docId);

    if (doc === null) {
      throw "Couldn't find doc";
    } else {
      const persistedVersion = await getVersion(db, doc._id);

      if (clientPersistedVersion !== persistedVersion) {
        return;
      }

      const parsedDoc = Node.fromJSON(schema, JSON.parse(doc.doc));
      const updatedParsedDoc = steps.reduce(
        (currentDoc, step, currentIndex) => {
          const parsedStep = Step.fromJSON(schema, JSON.parse(step));

          db.insert("steps", {
            docId: docId,
            step,
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

      await db.replace(doc._id, {
        doc: JSON.stringify(updatedParsedDoc.toJSON()),
      });
    }
  }
);
