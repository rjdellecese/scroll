import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import getNoteVersion from "./getNoteVersion";

export default query(
  async ({
    db,
  }): Promise<
    Map<
      Id<"notes">,
      {
        proseMirrorDoc: Document<"notes">["proseMirrorDoc"];
        creationTime: number;
        version: number;
      }
    >
  > =>
    db
      .query("notes")
      .order("desc")
      .take(10)
      .then((notes) =>
        notes.reduce(
          async (resultPromise, note) =>
            resultPromise.then((result) =>
              getNoteVersion(db, note._id).then((version) =>
                result.set(note._id, {
                  proseMirrorDoc: note.proseMirrorDoc,
                  creationTime: note._creationTime,
                  version,
                })
              )
            ),
          Promise.resolve(
            new Map<
              Id<"notes">,
              {
                proseMirrorDoc: Document<"notes">["proseMirrorDoc"];
                creationTime: number;
                version: number;
              }
            >()
          )
        )
      )
);
