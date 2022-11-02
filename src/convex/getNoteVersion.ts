import type { Id } from "./_generated/dataModel";
import type { DatabaseReader } from "./_generated/server";

export default async (
  db: DatabaseReader,
  noteId: Id<"notes">
): Promise<number> => {
  const stepsQuery = db
    .query("steps")
    .withIndex("by_note_id_and_position", (q) => q.eq("noteId", noteId));

  const getVersion = async () => {
    let versionCounter = 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _step of stepsQuery) {
      versionCounter += 1;
    }
    return versionCounter;
  };

  return await getVersion();
};
