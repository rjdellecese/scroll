import type { Id } from "./_generated/dataModel";
import type { DatabaseReader } from "./_generated/server";

export default async (
  db: DatabaseReader,
  docId: Id<"docs">
): Promise<number> => {
  const stepsQuery = db
    .query("steps")
    .withIndex("by_doc_id_and_position", (q) => q.eq("docId", docId));

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
