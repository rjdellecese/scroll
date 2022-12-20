import { defineSchema, defineTable, s } from "convex/schema";

export default defineSchema({
  notes: defineTable({
    proseMirrorDoc: s.any(),
    owner: s.string(), // A `UserIdentity`'s `tokenIdentifier` (https://docs.convex.dev/api/interfaces/server.UserIdentity#tokenidentifier)
  }),
  steps: defineTable({
    noteId: s.id("notes"),
    position: s.number(),
    proseMirrorStep: s.any(),
    clientId: s.string(),
  }).index("by_note_id_and_position", ["noteId", "position"]),
});
