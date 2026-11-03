import { COMMAND_PRIORITY_LOW, defineExtension } from "lexical";
import { toast } from "sonner";

import { DRAG_DROP_PASTE } from "@lexical/rich-text";
import { isMimeType } from "@lexical/utils";

import { ImageExtension } from "@/components/editor/extensions/image";
import { uploadEditorImage } from "@/components/editor/extensions/upload-image";
import { INSERT_IMAGE_COMMAND } from "@/components/editor/nodes/image-node";

const ACCEPTABLE_IMAGE_TYPES = [
  "image/",
  "image/heic",
  "image/heif",
  "image/gif",
  "image/webp",
];

export const DragDropPasteExtension = defineExtension({
  name: "@shadcn-editor/drag-drop-paste",
  dependencies: [ImageExtension],
  register: (editor) =>
    editor.registerCommand(
      DRAG_DROP_PASTE,
      (files) => {
        if (!editor.isEditable()) return false;
        (async () => {
          for (const file of files) {
            if (!isMimeType(file, ACCEPTABLE_IMAGE_TYPES)) continue;
            const src = await uploadEditorImage(file);
            if (!editor.isEditable()) return;
            editor.dispatchCommand(INSERT_IMAGE_COMMAND, { altText: file.name, src });
          }
        })().catch(() => toast.error("Could not upload the pasted image. Please try again."));
        return true;
      },
      COMMAND_PRIORITY_LOW,
    ),
});
