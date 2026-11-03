import { DotsThreeIcon } from "@phosphor-icons/react"
import { Button } from "@/components/editor/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/editor/ui/popover"
import { FontFamilyToolbarPlugin } from "./font-family-toolbar-plugin"
import { FontSizeToolbarPlugin } from "./font-size-toolbar-plugin"
import { ElementFormatToolbarPlugin } from "./element-format-toolbar-plugin"
import { IndentToolbarPlugin } from "./indent-toolbar-plugin"
import { RubyToolbarPlugin } from "./ruby-toolbar-plugin"
import { ClearToolbarPlugin } from "./clear-toolbar-plugin"
import { TextFormatToolbarPlugin } from "./text-format-toolbar-plugin"

export function MoreFormattingPlugin() {
  return <Popover>
    <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More formatting" title="More formatting" />}>
      <DotsThreeIcon />
    </PopoverTrigger>
    <PopoverContent align="end" side="bottom" initialFocus={false} finalFocus={false} aria-label="More formatting" className="w-72 max-w-[calc(100vw-2rem)] gap-4 p-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Typography</p>
        <FontFamilyToolbarPlugin />
        <FontSizeToolbarPlugin />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Paragraph</p>
        <div className="flex flex-wrap items-center gap-2"><ElementFormatToolbarPlugin formats="basic" /><IndentToolbarPlugin /></div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">Text options</p>
        <div className="flex flex-wrap items-center gap-2"><TextFormatToolbarPlugin formats="advanced" /><RubyToolbarPlugin /></div>
      </div>
      <ClearToolbarPlugin />
    </PopoverContent>
  </Popover>
}
