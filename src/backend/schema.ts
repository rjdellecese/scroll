import { defineSchema, defineTable, s } from "convex/schema";

export default defineSchema({
  docs: defineTable({
    doc: s.string(),
  }),
  clients: defineTable({
    clientId: s.string(),
    latestKnownVersion: s.number(), // TODO: Better as bigint()?
  }).index("by_client_id", ["clientId"]),
  steps: defineTable({
    docId: s.id("docs"),
    clientId: s.id("clients"),
    // TODO: Record invariants for this somewhere:
    //   - `fromPosition <= toPosition`
    //   - all `fromPosition`s and `toPosition`s should describe a sequence with no overlap
    positionFrom: s.number(), // TODO: Better as bigints?
    positionTo: s.number(), // TODO: Better as bigints?
    step: s.string(),
  }).index("by_doc_id_and_position_from_and_position_to", [
    "docId",
    "positionFrom",
    "positionTo",
  ]),
});
