import { Document } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(
  async ({
    db,
  }): Promise<{ doc: Document<"note">["doc"]; version: number } | null> => {
    const note = await db.table("note").first();

    if (note === null) {
      return null;
    }

    const stepsQuery = db
      .table("step")
      .filter((q) => q.eq(q.field("noteId"), note._id));

    // TODO
    const getVersion = async () => {
      let versionCounter = 0;
      for await (const _step of stepsQuery) {
        versionCounter += 1;
      }
      return versionCounter;
    };

    const persistedVersion = await getVersion();

    return { doc: note.doc, version: persistedVersion };
  }
);
