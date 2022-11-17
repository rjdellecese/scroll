import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import getNoteVersion from "./getNoteVersion";

export default query(
  async ({
    db,
    auth,
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
    auth.getUserIdentity().then(async (userIdentity) => {
      if (userIdentity) {
        return db
          .query("notes")
          .order("desc")
          .filter((q) => q.eq(q.field("owner"), userIdentity.tokenIdentifier))
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
          );
      } else {
        throw "Not authenticated";
      }
    })
);
