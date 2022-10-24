import { Node } from "prosemirror-model";
import { Step } from "prosemirror-transform";

import { schema } from "../tiptapSchemaExtensions";
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
  ) => {
    const doc = await db.get(docId);

    // Create client if it doesn't exist
    const existingClient = await db
      .query("clients")
      .withIndex("by_id", (q) => q.eq("id", clientId))
      .first();
    const persistedClientId = existingClient
      ? existingClient._id
      : await db.insert("clients", { id: clientId });

    if (doc === null) {
      throw "Couldn't find doc";
    } else {
      const persistedVersion = await getVersion(db, doc._id);

      if (clientPersistedVersion !== persistedVersion) {
        return;
      }

      const parsedSteps = steps.map((step) =>
        Step.fromJSON(schema, JSON.parse(step))
      );
      const parsedDoc = Node.fromJSON(schema, JSON.parse(doc.doc));
      const updatedParsedDoc = parsedSteps.reduce(
        (currentDoc, step, currentIndex) => {
          // TODO: Not sure `void` is actually what we want here.
          void db.insert("steps", {
            docId: docId,
            step: steps[currentIndex],
            clientId: persistedClientId,
            position: persistedVersion + currentIndex + 1,
          });
          // TODO: Handle error case better here
          return step.apply(currentDoc).doc || currentDoc;
        },
        parsedDoc
      );

      await db.replace(doc._id, {
        doc: JSON.stringify(updatedParsedDoc.toJSON()),
      });
    }
  }
);
