import { defineSchema, defineTable, s } from "convex/schema";

export default defineSchema({
  note: defineTable({
    doc: s.string(),
  }),
  step: defineTable({
    noteId: s.id("note"),
    position: s.number(),
    step: s.string(),
    clientId: s.string(),
  }).index("by_note_id", ["noteId"]),
});
