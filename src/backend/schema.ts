import { defineSchema, defineTable, s } from "convex/schema";

export default defineSchema({
  docs: defineTable({
    doc: s.string(),
  }),
  clients: defineTable({
    id: s.string(),
    latestKnownVersion: s.number(), // TODO: Better as bigint()?
  }).index("by_id", ["id"]),
  steps: defineTable({
    docId: s.id("docs"),
    clientId: s.id("clients"),
    position: s.number(), // TODO: Better as bigint()?
    step: s.string(),
  }).index("by_doc_id_and_position", ["docId", "position"]),
});
