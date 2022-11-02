import type { Document } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(
  async ({ db }, creationTime: number): Promise<Document<"docs">[]> =>
    db
      .query("docs")
      .filter((q) => q.gt(q.field("_creationTime"), creationTime))
      .collect()
);
