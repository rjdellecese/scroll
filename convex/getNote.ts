import { Document } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(async ({ db }): Promise<Document<"notes"> | null> => {
  return await db.table("notes").first();
});
