import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import getVersion from "./getVersion";

export default query(
  async (
    { db },
    docId: Id<"docs">
  ): Promise<{ doc: Document<"docs">["doc"]; version: number }> => {
    const doc = await db.get(docId);

    if (doc === null) {
      // TODO: Could throw instead…
      throw "oops";
    }

    const version = await getVersion(db, doc._id);

    return { doc: doc.doc, version: version };
  }
);
