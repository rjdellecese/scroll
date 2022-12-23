import type { VersionedNote } from "../versioned-note";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import getNoteVersion from "./getNoteVersion";

export default query(
  async ({ db, auth }, noteId: Id<"notes">): Promise<VersionedNote> => {
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
  }
);
