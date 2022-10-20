import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(
  async (
    { db },
    docId: Id<"docs">,
    version: number
  ): Promise<{ steps: string[]; clientIds: string[] }> => {
    const steps = await db
      .query("steps")
      .withIndex("by_doc_id_and_position", (q) =>
        q.eq("docId", docId).gt("position", version)
      )
      .collect();

    return steps.reduce(
      (
        result: {
          steps: Document<"steps">["step"][];
          clientIds: Document<"steps">["clientId"][];
        },
        step: Document<"steps">
      ) => ({
        steps: [...result.steps, step.step],
        clientIds: [...result.clientIds, step.clientId],
      }),
      { steps: [], clientIds: [] }
    );
  }
);
