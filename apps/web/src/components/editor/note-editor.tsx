"use client";

import { useState } from "react";
import { NoteStatePlugin } from "./note-state-plugin";
import { ExtraBlocksPickerPlugin } from "./plugins/component-picker/extra-blocks-picker-plugin";
import { BlockFormatToolbarPlugin } from "./plugins/toolbar/block-format-toolbar-plugin";
import { ColorToolbarPlugin } from "./plugins/toolbar/color-toolbar-plugin";
import { MoreFormattingPlugin } from "./plugins/toolbar/more-formatting-plugin";
import { TextFormatToolbarPlugin } from "./plugins/toolbar/text-format-toolbar-plugin";
import { NoteHeaderActions } from "./plugins/note-header-actions";

import {
  defineExtension,
} from "lexical";

import { ClipboardDOMImportExtension } from "@lexical/clipboard";
import {
  ClearEditorExtension,
  HorizontalRuleExtension,
  TabIndentationExtension,
} from "@lexical/extension";
import { HashtagExtension } from "@lexical/hashtag";
import { HistoryExtension } from "@lexical/history";
import {
  CheckListExtension,
  ListExtension,
} from "@lexical/list";
import {
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  MULTILINE_ELEMENT_TRANSFORMERS,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type Transformer,
  registerMarkdownShortcuts,
} from "@lexical/markdown";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import {
  RichTextExtension,
} from "@lexical/rich-text";
import { TableExtension } from "@lexical/table";

import { AutoLinkExtension } from "@/components/editor/extensions/auto-link";
import { AutocompleteExtension } from "@/components/editor/extensions/autocomplete";
import { CardExtension } from "@/components/editor/extensions/card";
import { CodeExtension } from "@/components/editor/extensions/code";
import { CollapsibleExtension } from "@/components/editor/extensions/collapsible";
import { DateTimeExtension } from "@/components/editor/extensions/datetime";
import { DragDropPasteExtension } from "@/components/editor/extensions/drag-drop-paste";
import { EmojiExtension } from "@/components/editor/extensions/emoji";
import { EquationExtension } from "@/components/editor/extensions/equation";
import { FigmaExtension } from "@/components/editor/extensions/figma";
import { FormatStateExtension } from "@/components/editor/extensions/format-state";
import { ImageExtension } from "@/components/editor/extensions/image";
import { LayoutExtension } from "@/components/editor/extensions/layout";
import { LinkExtension } from "@/components/editor/extensions/link";
import { MentionExtension } from "@/components/editor/extensions/mention";
import { PollExtension } from "@/components/editor/extensions/poll";
import { PullQuoteExtension } from "@/components/editor/extensions/pullquote";
import { RubyExtension } from "@/components/editor/extensions/ruby";
import { ShortcutsExtension } from "@/components/editor/extensions/shortcuts";
import { SpecialTextExtension } from "@/components/editor/extensions/special-text";
import { SpeechToTextExtension } from "@/components/editor/extensions/speech-to-text";
import { TabFocusExtension } from "@/components/editor/extensions/tab-focus";
import { TwitterExtension } from "@/components/editor/extensions/twitter";
import { YouTubeExtension } from "@/components/editor/extensions/youtube";
import { AutoEmbedPlugin } from "@/components/editor/plugins/auto-embed-plugin";
import { BulletedListPickerPlugin } from "@/components/editor/plugins/component-picker/bulleted-list-picker-plugin";
import { CardPickerPlugin } from "@/components/editor/plugins/component-picker/card-picker-plugin";
import { CheckListPickerPlugin } from "@/components/editor/plugins/component-picker/check-list-picker-plugin";
import { CodePickerPlugin } from "@/components/editor/plugins/component-picker/code-picker-plugin";
import { CollapsiblePickerPlugin } from "@/components/editor/plugins/component-picker/collapsible-picker-plugin";
import { ColumnsPickerPlugin } from "@/components/editor/plugins/component-picker/columns-picker-plugin";
import { ComponentPicker } from "@/components/editor/plugins/component-picker/component-picker-plugin";
import { DateTimePickerPlugin } from "@/components/editor/plugins/component-picker/datetime-picker-plugin";
import { DividerPickerPlugin } from "@/components/editor/plugins/component-picker/divider-picker-plugin";
import { HeadingPickerPlugin } from "@/components/editor/plugins/component-picker/heading-picker-plugin";
import { ImagePickerPlugin } from "@/components/editor/plugins/component-picker/image-picker-plugin";
import { NumberedListPickerPlugin } from "@/components/editor/plugins/component-picker/numbered-list-picker-plugin";
import { ParagraphPickerPlugin } from "@/components/editor/plugins/component-picker/paragraph-picker-plugin";
import { PollPickerPlugin } from "@/components/editor/plugins/component-picker/poll-picker-plugin";
import { PullQuotePickerPlugin } from "@/components/editor/plugins/component-picker/pullquote-picker-plugin";
import { QuotePickerPlugin } from "@/components/editor/plugins/component-picker/quote-picker-plugin";
import { ReviewPickerPlugin } from "@/components/editor/plugins/component-picker/review-picker-plugin";
import { TablePickerPlugin } from "@/components/editor/plugins/component-picker/table-picker-plugin";
import { ContentEditable } from "@/components/editor/plugins/content-editable";
import { ContextMenuPlugin } from "@/components/editor/plugins/context-menu-plugin";
import { ReactFindReplaceExtension } from "@/components/editor/plugins/decorator/find-replace-panel";
import { ReactReviewExtension } from "@/components/editor/plugins/decorator/review-plugin";
import { DraggableBlockPlugin } from "@/components/editor/plugins/draggable-block-plugin";
import { EmojiPickerPlugin } from "@/components/editor/plugins/emoji-picker-plugin";
import { FloatingToolbarPlugin } from "@/components/editor/plugins/floating/floating-toolbar-plugin";
import { LinkEditorPlugin } from "@/components/editor/plugins/floating/link-editor-plugin";
import { RubyEditorPlugin } from "@/components/editor/plugins/floating/ruby-editor-plugin";
import { TableHoverActionsPlugin } from "@/components/editor/plugins/floating/table-hover-actions-plugin";
import {
  LanguageProvider,
  useLanguage,
} from "@/components/editor/plugins/i18n-plugin";
import { MentionPlugin } from "@/components/editor/plugins/mention-plugin";
import { LinkToolbarPlugin } from "@/components/editor/plugins/toolbar/link-toolbar-plugin";
import { editorTheme } from "@/components/editor/theme";
import { EMOJI } from "@/components/editor/transformers/emoji-transformer";
import { HR } from "@/components/editor/transformers/horizontal-rule-transformer";
import { IMAGE } from "@/components/editor/transformers/image-transformer";
import { TABLE } from "@/components/editor/transformers/table-transformer";
import { DirectionProvider } from "@/components/editor/ui/direction";

const EDITOR_TRANSFORMERS: Transformer[] = [
  TABLE,
  HR,
  IMAGE,
  EMOJI,
  CHECK_LIST,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
];

export function NoteEditor({ value, editable, onChange }: {
  value: Record<string, unknown>;
  editable: boolean;
  onChange: (document: Record<string, unknown>, text: string) => void;
}) {
  const [app] = useState(
    () =>
      defineExtension({
        name: "@shadcn-editor/editor",
        namespace: "shadcn-editor",
        dependencies: [
          RichTextExtension,
          HistoryExtension,
          TabIndentationExtension,
          ListExtension,
          CheckListExtension,
          HashtagExtension,
          LinkExtension,
          AutoLinkExtension,
          CodeExtension,
          LayoutExtension,
          EmojiExtension,
          EquationExtension,
          TableExtension,
          HorizontalRuleExtension,
          ImageExtension,
          MentionExtension,
          SpecialTextExtension,
          AutocompleteExtension,
          DragDropPasteExtension,
          TabFocusExtension,
          SpeechToTextExtension,
          ShortcutsExtension,
          CardExtension,
          CollapsibleExtension,
          DateTimeExtension,
          PullQuoteExtension,
          ReactReviewExtension,
          PollExtension,
          RubyExtension,
          YouTubeExtension,
          TwitterExtension,
          FigmaExtension,
          FormatStateExtension,
          ReactFindReplaceExtension,
          ClearEditorExtension,
          ClipboardDOMImportExtension,
        ],
        $initialEditorState: JSON.stringify(value),
        editable,
        register: (editor) =>
          registerMarkdownShortcuts(editor, EDITOR_TRANSFORMERS),
        theme: editorTheme,
      }),
  );

  return (
    <LanguageProvider>
      <LexicalExtensionComposer extension={app} contentEditable={null}>
        <EditorWrapper>
          <NoteStatePlugin editable={editable} onChange={onChange} />
          <NoteHeaderActions transformers={EDITOR_TRANSFORMERS} />
          <div className="relative min-w-0 flex-1 pb-48">
            <ContentEditable variant="draggable" aria-label="Note content" placeholder={{ en: "Write something, or type / for blocks…" }} />
            {editable && <DraggableBlockPlugin />}
            {editable && <EditableOnly><FloatingToolbarPlugin>
              <BlockFormatToolbarPlugin />
              <TextFormatToolbarPlugin formats="compact" />
              <LinkToolbarPlugin />
              <ColorToolbarPlugin />
              <MoreFormattingPlugin />
            </FloatingToolbarPlugin>
            <LinkEditorPlugin />
            <RubyEditorPlugin />
            <TableHoverActionsPlugin />
            <EmojiPickerPlugin />
            <MentionPlugin />
            <AutoEmbedPlugin />
            <ContextMenuPlugin />
            <ComponentPicker>
              <ParagraphPickerPlugin />
              <HeadingPickerPlugin />
              <TablePickerPlugin />
              <NumberedListPickerPlugin />
              <BulletedListPickerPlugin />
              <CheckListPickerPlugin />
              <QuotePickerPlugin />
              <CodePickerPlugin />
              <DividerPickerPlugin />
              <ColumnsPickerPlugin />
              <ImagePickerPlugin />
              <CardPickerPlugin />
              <CollapsiblePickerPlugin />
              <DateTimePickerPlugin />
              <PullQuotePickerPlugin />
              <ReviewPickerPlugin />
              <PollPickerPlugin />
              <ExtraBlocksPickerPlugin />
            </ComponentPicker></EditableOnly>}
          </div>
        </EditorWrapper>
      </LexicalExtensionComposer>
    </LanguageProvider>
  );
}

function EditableOnly({ children }: { children: React.ReactNode }) {
  const editable = useLexicalEditable();
  return editable ? children : null;
}

function EditorWrapper({ children }: { children: React.ReactNode }) {
  const { language, dir } = useLanguage();
  return (
    <DirectionProvider direction={dir}>
      <div
        dir={dir}
        lang={language}
        className="cabinet-editor relative flex min-h-80 w-full flex-1 flex-col"
      >
        {children}
      </div>
    </DirectionProvider>
  );
}
