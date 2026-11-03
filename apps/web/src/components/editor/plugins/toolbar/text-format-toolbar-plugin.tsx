import { CodeIcon, HighlighterIcon, TextAUnderlineIcon, TextAaIcon, TextBIcon, TextItalicIcon, TextStrikethroughIcon, TextSubscriptIcon, TextSuperscriptIcon, TextUnderlineIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { FORMAT_TEXT_COMMAND, type TextFormatType } from "lexical";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";

import { useFormatStateValue } from "@/components/editor/extensions/format-state";
import type { Locale } from "@/components/editor/locales";
import { useTranslation } from "@/components/editor/plugins/i18n-plugin";

import { ToggleGroup, ToggleGroupItem } from "@/components/editor/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/editor/ui/tooltip";

const FORMAT_GROUPS: {
  format: TextFormatType;
  labelKey: keyof Locale;
  icon: ReactNode;
}[][] = [
  [
    {
      format: "bold",
      labelKey: "bold",
      icon: (
        <TextBIcon />
      ),
    },
    {
      format: "italic",
      labelKey: "italic",
      icon: (
        <TextItalicIcon />
      ),
    },
    {
      format: "underline",
      labelKey: "underline",
      icon: (
        <TextUnderlineIcon />
      ),
    },
    {
      format: "strikethrough",
      labelKey: "strikethrough",
      icon: (
        <TextStrikethroughIcon />
      ),
    },
  ],
  [
    {
      format: "highlight",
      labelKey: "highlight",
      icon: (
        <HighlighterIcon />
      ),
    },
    {
      format: "code",
      labelKey: "inlineCode",
      icon: (
        <CodeIcon />
      ),
    },
  ],
  [
    {
      format: "subscript",
      labelKey: "subscript",
      icon: (
        <TextSubscriptIcon />
      ),
    },
    {
      format: "superscript",
      labelKey: "superscript",
      icon: (
        <TextSuperscriptIcon />
      ),
    },
  ],
  [
    {
      format: "uppercase",
      labelKey: "uppercase",
      icon: (
        <TextAUnderlineIcon />
      ),
    },
    {
      format: "lowercase",
      labelKey: "lowercase",
      icon: (
        <TextAaIcon />
      ),
    },
    {
      format: "capitalize",
      labelKey: "titleCase",
      icon: (
        <TextAaIcon />
      ),
    },
  ],
];

function FormatToggleGroup({
  items,
  plain = false,
}: {
  items: (typeof FORMAT_GROUPS)[number];
  plain?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const formats = useFormatStateValue("formats");
  const isEditable = useLexicalEditable();
  return (
    <ToggleGroup
      multiple
      variant={plain ? "default" : "outline"}
      size="sm"
      spacing={0}
      disabled={!isEditable}
      value={formats}
      onValueChange={(value) => {
        const next = new Set(value as TextFormatType[]);
        for (const { format } of items) {
          if (next.has(format) !== formats.includes(format)) {
            editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
          }
        }
      }}
    >
      {items.map(({ format, labelKey, icon }) => (
        <Tooltip key={format}>
          <TooltipTrigger
            render={
              <ToggleGroupItem value={format} aria-label={t[labelKey]}>
                {icon}
              </ToggleGroupItem>
            }
          />
          <TooltipContent>{t[labelKey]}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}

export function TextFormatToolbarPlugin({
  formats = "all",
}: {
  formats?: "basic" | "all" | "compact" | "advanced";
}) {
  const groups = formats === "compact"
    ? [[...FORMAT_GROUPS[0]!.slice(0, 3), FORMAT_GROUPS[1]![1]!]]
    : formats === "advanced"
      ? [[FORMAT_GROUPS[0]![3]!, FORMAT_GROUPS[1]![0]!], ...FORMAT_GROUPS.slice(2)]
      : formats === "basic" ? FORMAT_GROUPS.slice(0, 1) : FORMAT_GROUPS;
  return (
    <>
      {groups.map((items, groupIndex) => (
        <FormatToggleGroup key={groupIndex} items={items} plain={formats === "compact"} />
      ))}
    </>
  );
}
