import { ImageIcon } from "@phosphor-icons/react";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

import { $getRoot, $getSelection } from "lexical";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";

import { uploadEditorImage } from "@/components/editor/extensions/upload-image";
import { INSERT_IMAGE_COMMAND } from "@/components/editor/nodes/image-node";
import { useTranslation } from "@/components/editor/plugins/i18n-plugin";

import { Button } from "@/components/editor/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/editor/ui/tooltip";

export function useImageFilePicker() {
  const [editor] = useLexicalComposerContext();
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !editor.isEditable()) {
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Choose an image file.");
        return;
      }
      uploadEditorImage(file).then((src) => {
        if (!editor.isEditable()) return;
        editor.update(() => {
          if (!$getSelection()) {
            $getRoot().selectEnd();
          }
        });
        editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
          altText: file.name,
          src,
        });
      }).catch(() => toast.error("Could not upload this image. Please try again."));
    },
    [editor],
  );

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={onChange}
    />
  );

  return { pick, input };
}

export function InsertImagePlugin() {
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();
  const { pick, input } = useImageFilePicker();

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t.insertImage}
              disabled={!isEditable}
              onClick={pick}
            >
              <ImageIcon />
            </Button>
          }
        />
        <TooltipContent>{t.insertImage}</TooltipContent>
      </Tooltip>
      {input}
    </>
  );
}
