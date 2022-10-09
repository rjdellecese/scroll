import { getSchema } from "@tiptap/core";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

// Extensions which determine the editor's schema.
export const extensions = [StarterKit, Underline];

export const schema = getSchema(extensions);
