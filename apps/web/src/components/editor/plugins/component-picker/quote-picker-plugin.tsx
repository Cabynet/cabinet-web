import { QuotesIcon } from "@phosphor-icons/react";
import { useMemo } from "react";

import { $getRoot, $getSelection } from "lexical";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";

import {
  type ComponentPickerItem,
  useComponentPickerItems,
} from "@/components/editor/plugins/component-picker/component-picker-plugin";
import { useTranslation } from "@/components/editor/plugins/i18n-plugin";


export function QuotePickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();

  const items = useMemo<ComponentPickerItem[]>(
    () => [
      {
        value: "quote",
        label: t.quote,
        icon: (
          <QuotesIcon
            className="text-muted-foreground" />
        ),
        keywords: ["quote", "block quote", "blockquote"],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection() ?? $getRoot().selectEnd();
            $setBlocksType(selection, () => $createQuoteNode());
          }),
      },
    ],
    [editor, t],
  );

  useComponentPickerItems(items);

  return null;
}
