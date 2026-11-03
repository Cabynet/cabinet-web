import { CaretDownIcon, ListChecksIcon, ListIcon, ListNumbersIcon, ParagraphIcon, QuotesIcon, TextHOneIcon, TextHThreeIcon, TextHTwoIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  type ElementNode,
  SELECTION_CHANGE_COMMAND,
} from "lexical";

import { getPeerDependencyFromEditor } from "@lexical/extension";
import {
  $isListNode,
  type CheckListExtension,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  type ListExtension,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  $isQuoteNode,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";

import { $getSelectedNode } from "@/components/editor/extensions/format-state";
import type { Locale } from "@/components/editor/locales";
import { useTranslation } from "@/components/editor/plugins/i18n-plugin";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/editor/ui/dropdown-menu";
import { Button } from "@/components/editor/ui/button";

const BLOCK_TYPES = [
  "paragraph",
  "h1",
  "h2",
  "h3",
  "number",
  "bullet",
  "check",
  "quote",
] as const;

type BlockType = (typeof BLOCK_TYPES)[number];

const BLOCK_ITEMS: Record<
  BlockType,
  { labelKey: keyof Locale; icon: ReactNode }
> = {
  paragraph: {
    labelKey: "paragraph",
    icon: (
      <ParagraphIcon
        className="text-muted-foreground" />
    ),
  },
  h1: {
    labelKey: "heading1",
    icon: (
      <TextHOneIcon
        className="text-muted-foreground" />
    ),
  },
  h2: {
    labelKey: "heading2",
    icon: (
      <TextHTwoIcon
        className="text-muted-foreground" />
    ),
  },
  h3: {
    labelKey: "heading3",
    icon: (
      <TextHThreeIcon
        className="text-muted-foreground" />
    ),
  },
  number: {
    labelKey: "numberedListBlock",
    icon: (
      <ListNumbersIcon
        className="text-muted-foreground" />
    ),
  },
  bullet: {
    labelKey: "bulletedListBlock",
    icon: (
      <ListIcon
        className="text-muted-foreground" />
    ),
  },
  check: {
    labelKey: "checkListBlock",
    icon: (
      <ListChecksIcon
        className="text-muted-foreground" />
    ),
  },
  quote: {
    labelKey: "quote",
    icon: (
      <QuotesIcon
        className="text-muted-foreground" />
    ),
  },
};

function $getBlockType(): BlockType | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }
  const node = $getSelectedNode(selection);
  const list = $findMatchingParent(node, $isListNode);
  if (list) {
    return list.getListType();
  }
  const element = $findMatchingParent(
    node,
    (parent): parent is ElementNode =>
      $isElementNode(parent) && !parent.isInline(),
  );
  if ($isHeadingNode(element)) {
    const tag = element.getTag();
    return (BLOCK_TYPES as readonly string[]).includes(tag)
      ? (tag as BlockType)
      : "paragraph";
  }
  return $isQuoteNode(element) ? "quote" : "paragraph";
}

function $createBlockNode(blockType: BlockType) {
  switch (blockType) {
    case "h1":
    case "h2":
    case "h3":
      return $createHeadingNode(blockType);
    case "quote":
      return $createQuoteNode();
    default:
      return $createParagraphNode();
  }
}

function useBlockType(): BlockType {
  const [editor] = useLexicalComposerContext();
  const [blockType, setBlockType] = useState<BlockType>(
    () => editor.getEditorState().read($getBlockType) ?? "paragraph",
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        const next = editorState.read($getBlockType);
        if (next) {
          setBlockType(next);
        }
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          const next = $getBlockType();
          if (next) {
            setBlockType(next);
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }, [editor]);

  return blockType;
}

export function BlockFormatToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t, dir, language } = useTranslation();
  const blockType = useBlockType();
  const isEditable = useLexicalEditable();

  const items = useMemo(() => {
    const hasList =
      getPeerDependencyFromEditor<typeof ListExtension>(
        editor,
        "@lexical/list/List",
      ) !== undefined;
    const hasCheckList =
      getPeerDependencyFromEditor<typeof CheckListExtension>(
        editor,
        "@lexical/list/CheckList",
      ) !== undefined;
    return BLOCK_TYPES.filter((item) => {
      if (item === "number" || item === "bullet") {
        return hasList;
      }
      if (item === "check") {
        return hasCheckList;
      }
      return true;
    });
  }, [editor]);

  return (
    <DropdownMenu key={language}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="sm" disabled={!isEditable} aria-label={t.blockFormatTrigger} className="h-8 gap-1 px-2 text-xs" />}>
        {t[BLOCK_ITEMS[blockType].labelKey]}
        <CaretDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent dir={dir} className="w-44">
        <DropdownMenuGroup>
        {items.map((value) => <DropdownMenuItem key={value} onClick={() => {
        if (!value) {
          return;
        }
        editor.update(() => {
          if (!$getSelection()) {
            $getRoot().selectEnd();
          }
        });
        switch (value) {
          case "number":
            editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
            return;
          case "bullet":
            editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
            return;
          case "check":
            editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
            return;
        }
        editor.update(() => {
          const selection = $getSelection() ?? $getRoot().selectEnd();
          $setBlocksType(selection, () => $createBlockNode(value));
        });
      }}>
          {BLOCK_ITEMS[value].icon}
          {t[BLOCK_ITEMS[value].labelKey]}
        </DropdownMenuItem>)}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
