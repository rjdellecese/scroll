import { array } from "fp-ts";
import { Document } from "../_generated/dataModel";
import { query } from "../_generated/server";

export default query(
  async (
    { db },
    version: number
  ): Promise<{ steps: string[]; clientIds: string[] }> => {
    const note = await db.table("note").first();
    if (note === null) {
      throw Error;
    }
    console.log("Got the note");
    const steps = await db
      .table("step")
      .filter((q) =>
        q.and(
          q.eq(q.field("noteId"), note._id),
          q.gt(q.field("position"), version)
        )
      )
      .collect();

    return array.reduce<
      Document<"step">,
      {
        steps: Document<"step">["step"][];
        clientIds: Document<"step">["clientId"][];
      }
    >({ steps: [], clientIds: [] }, (result, step: Document<"step">) => ({
      steps: array.append(step.step)(result.steps),
      clientIds: array.append(step.clientId)(result.clientIds),
    }))(steps);
  }
);
