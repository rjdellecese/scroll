import { defineSchema, defineTable, s } from "convex/schema";

export default defineSchema({
  docs: defineTable({
    doc: s.string(),
  }),
  clients: defineTable({
    id: s.string(),
  }),
  steps: defineTable({
    docId: s.id("docs"),
    clientId: s.id("clients"),
    position: s.number(),
    step: s.string(),
  }).index("by_doc_id_and_position", ["docId", "position"]),
});
