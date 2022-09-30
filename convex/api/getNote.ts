import { getVersion } from "../getVersion";
import { Document } from "../_generated/dataModel";
import { query } from "../_generated/server";

export default query(
  async ({
    db,
  }): Promise<{ doc: Document<"note">["doc"]; version: number } | null> => {
    const note = await db.table("note").first();

    if (note === null) {
      return null;
    }

    const version = await getVersion(db, note._id);

    return { doc: note.doc, version: version };
  }
);
