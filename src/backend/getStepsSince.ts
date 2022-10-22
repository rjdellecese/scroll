import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(
  async (
    { db },
    docId: Id<"docs">,
    version: number
  ): Promise<{ steps: string[]; clientIds: string[] }> => {
    const steps: Document<"steps">[] = await db
      .query("steps")
      .withIndex("by_doc_id_and_position_from_and_position_to", (q) =>
        q.eq("docId", docId).gt("positionFrom", version)
      )
      .collect();

    const getCliendId = async (step: Document<"steps">) => {
      const client = await db.get(step.clientId);
      if (client) {
        return client.clientId;
      } else {
        throw "Client not found for step";
      }
    };

    return await steps.reduce<
      Promise<{
        steps: Document<"steps">["step"][];
        clientIds: Document<"clients">["clientId"][];
      }>
    >(
      async (
        resultPromise: Promise<{
          steps: Document<"steps">["step"][];
          clientIds: Document<"clients">["clientId"][];
        }>,
        step: Document<"steps">
      ) => {
        const clientId = await getCliendId(step);
        return resultPromise.then((result) => ({
          steps: [...result.steps, step.step],
          clientIds: [...result.clientIds, clientId],
        }));
      },
      Promise.resolve({ steps: [], clientIds: [] })
    );
  }
);
