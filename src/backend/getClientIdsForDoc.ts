import type { Id } from "./_generated/dataModel";
import type { DatabaseReader } from "./_generated/server";

export default async (
  db: DatabaseReader,
  docId: Id<"docs">
): Promise<string[]> => {
  const stepsQuery = db
    .query("steps")
    .filter((q) => q.eq(q.field("docId"), docId));

  const getVersion = async () => {
    let versionCounter = 0;
    for await (const _step of stepsQuery) {
      versionCounter += 1;
    }
    return versionCounter;
  };

  return await getVersion();
};
