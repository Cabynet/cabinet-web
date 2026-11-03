import { ParagraphIcon, TextAlignCenterIcon, TextAlignJustifyIcon, TextAlignLeftIcon, TextAlignRightIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { type ElementFormatType, FORMAT_ELEMENT_COMMAND } from "lexical";

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

type AlignItem = {
  value: Exclude<ElementFormatType, "">;
  labelKey: keyof Locale;
  icon: ReactNode;
};

function AlignToggleGroup({ items }: { items: AlignItem[] }) {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();
  const elementFormat = useFormatStateValue("elementFormat");
  const isEditable = useLexicalEditable();
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      disabled={!isEditable}
      value={[elementFormat]}
      onValueChange={(value) => {
        const next = value[0] as Exclude<ElementFormatType, ""> | undefined;
        if (next) {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, next);
        }
      }}
    >
      {items.map(({ value, labelKey, icon }) => (
        <Tooltip key={value}>
          <TooltipTrigger
            render={
              <ToggleGroupItem value={value} aria-label={t[labelKey]}>
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

export function ElementFormatToolbarPlugin({
  formats = "all",
}: {
  formats?: "basic" | "all";
}) {
  const { dir } = useTranslation();
  const isRtl = dir === "rtl";

  const alignGroups: AlignItem[][] = [
    [
      {
        value: "left",
        icon: (
          <TextAlignLeftIcon />
        ),
        labelKey: "alignLeft",
      },
      {
        value: "center",
        icon: (
          <TextAlignCenterIcon />
        ),
        labelKey: "alignCenter",
      },
      {
        value: "right",
        icon: (
          <TextAlignRightIcon />
        ),
        labelKey: "alignRight",
      },
      {
        value: "justify",
        icon: (
          <TextAlignJustifyIcon />
        ),
        labelKey: "alignJustify",
      },
    ],
    [
      {
        value: "start",
        icon: isRtl ? (
          <ParagraphIcon />
        ) : (
          <ParagraphIcon />
        ),
        labelKey: "alignStart",
      },
      {
        value: "end",
        icon: isRtl ? (
          <ParagraphIcon />
        ) : (
          <ParagraphIcon />
        ),
        labelKey: "alignEnd",
      },
    ],
  ];

  const groups = formats === "basic" ? alignGroups.slice(0, 1) : alignGroups;

  return (
    <>
      {groups.map((items, groupIndex) => (
        <AlignToggleGroup key={groupIndex} items={items} />
      ))}
    </>
  );
}
