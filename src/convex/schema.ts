import { defineSchema, defineTable, s } from "convex/schema";

export default defineSchema({
  notes: defineTable({
    proseMirrorDoc: s.string(),
  }),
  steps: defineTable({
    noteId: s.id("notes"),
    position: s.number(),
    step: s.string(),
    clientId: s.string(),
  }).index("by_note_id_and_position", ["noteId", "position"]),
});
