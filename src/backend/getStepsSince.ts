import type { Document, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export default query(
  async (
    { db },
    docId: Id<"docs">,
    version: number
  ): Promise<{ step: string; clientId: string }[]> => {
    // TODO: Don't return `steps` and `clientIds` in this weird split format; split only right before necessary (which is right before passing to the `collab.receiveTransaction` function!
    const steps: Document<"steps">[] = await db
      .query("steps")
      .withIndex("by_doc_id_and_position", (q) =>
        q.eq("docId", docId).gt("position", version)
      )
      .collect();

    const getCliendId = async (step: Document<"steps">) => {
      const client = await db.get(step.clientId);
      if (client) {
        return client.id;
      } else {
        throw "Client not found for step";
      }
    };

    return await steps.reduce<
      Promise<
        {
          step: Document<"steps">["step"];
          clientId: Document<"clients">["clientId"];
        }[]
      >
    >(async (resultPromise, step) => {
      const clientId = await getCliendId(step);
      return resultPromise.then((result) => [
        ...result,
        {
          step: step.step,
          clientId: clientId,
        },
      ]);
    }, Promise.resolve([]));
  }
);
