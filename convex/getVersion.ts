import { GenericId } from "convex/values";
import { DatabaseReader } from "./_generated/server";

export const getVersion = async (
  db: DatabaseReader,
  noteId: GenericId<"note">
): Promise<number> => {
  const stepsQuery = db
    .table("step")
    .index("by_note_id")
    .range((q) => q.eq("noteId", noteId));

  const getVersion = async () => {
    let versionCounter = 0;
    for await (const _step of stepsQuery) {
      versionCounter += 1;
    }
    return versionCounter;
  };

  return await getVersion();
};
