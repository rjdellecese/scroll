import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import getNoteVersion from "./getNoteVersion";

export default query(
  async (
    { db },
    noteId: Id<"notes">
  ): Promise<{ doc: Document<"notes">["doc"]; version: number }> => {
    const note = await db.get(noteId);

    if (note === null) {
      throw "Failed to find note";
    }

    const version = await getNoteVersion(db, note._id);

    // TODO: Return whole note and version
    return { doc: note.doc, version: version };
  }
);
