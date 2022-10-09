import { Node } from "prosemirror-model";
import { EditorState } from "prosemirror-state";
import { Step } from "prosemirror-transform";

import { schema } from "../tiptapSchemaExtensions";
import type { Document, Id } from "./_generated/dataModel";
import type { DatabaseReader } from "./_generated/server";
import { mutation, query } from "./_generated/server";

export const getStepsSince = query(
  async ({ db }, docId: Id<"docs">, version: number) => {
    // TODO
    // const steps = await db
    //   .table("step")
    //   .index("by_note_id")
    //   .range((q) => q.eq("noteId", note._id))
    //   .filter((q) => q.gt(q.field("position"), version))
    //   .collect();
    const steps = await db
      .query("steps")
      .filter((q) =>
        q.and(q.eq(q.field("docId"), docId), q.gt(q.field("position"), version))
      )
      .collect();

    return steps.reduce(
      (
        result: {
          steps: Document<"steps">["step"][];
          clientIds: Document<"steps">["clientId"][];
        },
        step: Document<"steps">
      ) => ({
        steps: [...result.steps, step.step],
        clientIds: [...result.clientIds, step.clientId],
      }),
      { steps: [], clientIds: [] }
    );
  }
);

export const sendSteps = mutation(
  async (
    { db },
    docId: Id<"docs">,
    clientId: string,
    clientPersistedVersion: number,
    steps: string[]
  ) => {
    console.log("clientId", clientId);
    console.log("clientPersistedVersion", clientPersistedVersion);
    console.log("steps", steps.length);

    const doc = await db.get(docId);

    // TODO: Error?
    if (doc === null) {
      return;
    } else {
      const persistedVersion = await getVersion(db, doc._id);

      if (clientPersistedVersion !== persistedVersion) {
        console.log("Versions are not equal.");
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
            clientId: clientId,
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

export const getDocAndVersion = query(
  async (
    { db },
    docId: Id<"docs">
  ): Promise<{ doc: Document<"docs">["doc"]; version: number } | null> => {
    const doc = await db.get(docId);

    if (doc === null) {
      // TODO: Could throw instead…
      return null;
    }

    const version = await getVersion(db, doc._id);

    return { doc: doc.doc, version: version };
  }
);

export const createEmptyDoc = mutation(
  async ({ db }): Promise<{ id: Id<"docs">; doc: string; version: number }> => {
    const doc = JSON.stringify(EditorState.create({ schema }).doc.toJSON());
    const id = await db.insert("docs", {
      doc: doc,
    });
    return { id, doc, version: 0 };
  }
);

const getVersion = async (
  db: DatabaseReader,
  docId: Id<"docs">
): Promise<number> => {
  const stepsQuery = db
    .query("steps")
    .withIndex("by_doc_id", (q) => q.eq("docId", docId));

  const getVersion = async () => {
    let versionCounter = 0;
    for await (const _step of stepsQuery) {
      versionCounter += 1;
    }
    return versionCounter;
  };

  return await getVersion();
};
