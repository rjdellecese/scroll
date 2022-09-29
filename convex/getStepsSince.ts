import { query } from "./_generated/server";

export default query(
  async (
    { db },
    version: number
  ): Promise<{ steps: string[]; clientIds: string[] }> => {
    const note = await db.table("notes").first();
    if (note === null) {
      throw Error;
    }
    console.log("Got the note");
    return {
      steps: note.steps.slice(version),
      clientIds: note.stepClientIds.slice(version),
    };
  }
);
