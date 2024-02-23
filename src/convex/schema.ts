import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  notes: defineTable({
    proseMirrorDoc: v.string(),
    owner: v.string(), // A `UserIdentity`'s `tokenIdentifier` (https://docs.convex.dev/api/interfaces/server.UserIdentity#tokenidentifier)
  }),
  steps: defineTable({
    noteId: v.id("notes"),
    position: v.number(),
    proseMirrorStep: v.string(),
    clientId: v.string(),
  }).index("by_note_id_and_position", ["noteId", "position"]),
});
