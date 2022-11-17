import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import getNoteVersion from "./getNoteVersion";

export default query(
  async (
    { db, auth },
    creationTime: number
  ): Promise<
    Map<
      Id<"notes">,
      {
        proseMirrorDoc: Document<"notes">["proseMirrorDoc"];
        creationTime: number;
        version: number;
      }
    >
  > =>
    auth.getUserIdentity().then((userIdentity) =>
      userIdentity
        ? db
            .query("notes")
            .order("desc")
            .filter((q) =>
              q.and(
                q.eq(q.field("owner"), userIdentity.tokenIdentifier),
                q.gt(q.field("_creationTime"), creationTime)
              )
            )
            .collect()
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
        : Promise.reject()
    )
);
