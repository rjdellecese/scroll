import { getSchema } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

// Extensions which determine the editor's schema.
export const extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Underline,
];

export const schema = getSchema(extensions);
