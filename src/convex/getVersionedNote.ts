import type { Id } from "~src/convex/_generated/dataModel";
import { query } from "~src/convex/_generated/server";
import getNoteVersion from "~src/convex/getNoteVersion";
import type { VersionedNote } from "~src/versioned-note";

export default query(
  async (
    { db, auth },
    { noteId }: { noteId: Id<"notes"> },
  ): Promise<VersionedNote> => {
    const userIdentity = await auth.getUserIdentity();

    if (userIdentity) {
      const note = await db.get(noteId);

      if (note === null) {
        throw "Failed to find note";
      } else if (note.owner !== userIdentity.tokenIdentifier) {
        throw "User doesn't own this note";
      }

      const version = await getNoteVersion(db, note._id);

      return {
        ...note,
        version,
      };
    } else {
      throw "Unauthenticated";
    }
  },
);
