import type { Id } from "./_generated/dataModel";
import type { DatabaseReader } from "./_generated/server";

export default async (
  db: DatabaseReader,
  docId: Id<"docs">
): Promise<number> => {
  const stepsQuery = db
    .query("steps")
    .withIndex("by_doc_id_and_position_from_and_position_to", (q) =>
      q.eq("docId", docId)
    );

  const getVersion = async () => {
    let versionCounter = 0;
    for await (const step of stepsQuery) {
      versionCounter += step.positionTo - step.positionFrom + 1;
    }
    return versionCounter;
  };

  return await getVersion();
};
