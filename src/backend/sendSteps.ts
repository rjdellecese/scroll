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
    clientLatestKnownVersion: number,
    steps: string[]
  ) => {
    // Create client if it doesn't exist
    const existingClient = await db
      .query("clients")
      .withIndex("by_client_id", (q) => q.eq("clientId", clientId))
      .first();
    const persistedClientId = existingClient
      ? existingClient._id
      : await db.insert("clients", {
          clientId: clientId,
          latestKnownVersion: 0,
        });

    const doc = await db.get(docId);
    if (doc === null) {
      throw "Couldn't find doc";
    } else {
      const persistedVersion = await getVersion(db, doc._id);

      if (clientLatestKnownVersion !== persistedVersion) {
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
            positionFrom: persistedVersion + currentIndex + 1,
            positionTo: persistedVersion + currentIndex + 1,
          });
          // TODO: Handle error case better here; probably throw
          return step.apply(currentDoc).doc || currentDoc;
        },
        parsedDoc
      );

      await db.patch(persistedClientId, {
        latestKnownVersion: persistedVersion + parsedSteps.length,
      });

      if (parsedSteps.length > 0) {
        await db.patch(doc._id, {
          doc: JSON.stringify(updatedParsedDoc.toJSON()),
        });
      }
    }
  }
);
