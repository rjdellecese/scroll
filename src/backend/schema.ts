import { defineSchema, defineTable, s } from "convex/schema";

export default defineSchema({
  docs: defineTable({
    doc: s.string(),
  }),
  steps: defineTable({
    docId: s.id("docs"),
    position: s.number(),
    step: s.string(),
    clientId: s.string(),
  }).index("by_doc_id_and_position", ["docId", "position"]),
});
