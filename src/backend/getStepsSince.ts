import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(
  async (
    { db },
    docId: Id<"docs">,
    version: number
  ): Promise<{ steps: string[]; clientIds: string[] }> => {
    // TODO
    // const steps = await db
    //   .table("step")
    //   .index("by_doc_id")
    //   .range((q) => q.eq("docId", doc._id))
    //   .filter((q) => q.gt(q.field("position"), version))
    //   .collect();
    console.log("getStepsSince")

    const steps = await db
      .query("steps")
      .filter((q) =>
        q.and(q.eq(q.field("docId"), docId), q.gt(q.field("position"), version))
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
