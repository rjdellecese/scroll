import { defineSchema, defineTable, s } from "convex/schema";

export default defineSchema({
  notes: defineTable({
    doc: s.string(),
    steps: s.array(s.string()),
    stepClientIds: s.array(s.string()),
  }),
});
