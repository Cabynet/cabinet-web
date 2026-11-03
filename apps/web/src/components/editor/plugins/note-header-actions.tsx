"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  $getRoot,
  COMMAND_PRIORITY_LOW,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { exportFile, importFile } from "@lexical/file";
import { $generateHtmlFromNodes } from "@lexical/html";
import {
  $convertToMarkdownString,
  TRANSFORMERS,
  type Transformer,
} from "@lexical/markdown";
import {
  ArrowUUpLeft,
  ArrowUUpRight,
  DotsThreeVertical,
  FileArrowDown,
  FileArrowUp,
  FileCode,
  FileText,
  Keyboard,
  Lock,
  LockOpen,
  Microphone,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import {
  SPEECH_TO_TEXT_COMMAND,
  SUPPORT_SPEECH_RECOGNITION,
} from "@/components/editor/extensions/speech-to-text";
import { useTranslation } from "@/components/editor/plugins/i18n-plugin";
import { ShortcutsDialog } from "@/components/editor/plugins/activitybar/shortcut-plugin";
import { Button } from "@/components/editor/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/editor/ui/dropdown-menu";

function computeWordCounts(text: string): { words: number; characters: number } {
  const words = text.split(/\s+/).filter(Boolean).length;
  const characters = text.replace(/\n/g, "").length;
  return { words, characters };
}

function toSafeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9-_. ]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-. ]+|[-. ]+$/g, "");
}

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function NoteHeaderActions({
  transformers = TRANSFORMERS,
}: {
  transformers?: Transformer[];
}) {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t, dir, language } = useTranslation();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [counts, setCounts] = useState(() =>
    editor
      .getEditorState()
      .read(() => computeWordCounts($getRoot().getTextContent())),
  );

  useEffect(() => {
    setTarget(document.getElementById("note-header-actions"));
  }, []);

  useEffect(() => {
    return editor.registerUpdateListener(
      ({ editorState, dirtyElements, dirtyLeaves }) => {
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        setCounts(
          editorState.read(() =>
            computeWordCounts($getRoot().getTextContent()),
          ),
        );
      },
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SPEECH_TO_TEXT_COMMAND,
      (enabled) => {
        setIsListening(enabled);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  const namespace = editor._config.namespace;
  const getFileName = () =>
    toSafeFileName(`${namespace} ${new Date().toISOString()}`);

  const exportLexical = () => {
    exportFile(editor, { fileName: getFileName(), source: namespace });
  };

  const exportMarkdown = () => {
    const markdown = editor.read(() => $convertToMarkdownString(transformers));
    downloadFile(markdown, `${getFileName()}.md`, "text/markdown");
  };

  const exportHtml = () => {
    const body = editor.read(() => $generateHtmlFromNodes(editor));
    const html = `<!doctype html>\n<html lang="${language}" dir="${dir}">\n<body>\n${body}\n</body>\n</html>`;
    downloadFile(html, `${getFileName()}.html`, "text/html");
  };

  const content = (
    <div className="flex items-center gap-2">
      <span
        aria-live="polite"
        className="hidden text-xs text-muted-foreground tabular-nums sm:inline"
      >
        {counts.words} {counts.words === 1 ? "word" : "words"}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-8 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Note options"
              title="Note options"
            >
              <DotsThreeVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent dir={dir} align="end" className="w-56 p-1 text-xs">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {counts.words} {counts.words === 1 ? "word" : "words"} ·{" "}
            {counts.characters}{" "}
            {counts.characters === 1 ? "character" : "characters"}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!isEditable}
            onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          >
            <ArrowUUpLeft className="size-3.5 shrink-0" />
            <span className="flex-1 truncate">{t.undo}</span>
            <span className="text-xs text-muted-foreground">⌘Z</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!isEditable}
            onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          >
            <ArrowUUpRight className="size-3.5 shrink-0" />
            <span className="flex-1 truncate">{t.redo}</span>
            <span className="text-xs text-muted-foreground">⌘⇧Z</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exportMarkdown}>
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{t.exportMarkdown}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportHtml}>
            <FileCode className="size-3.5 shrink-0" />
            <span className="truncate">{t.exportHtml}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportLexical}>
            <FileArrowDown className="size-3.5 shrink-0" />
            <span className="truncate">{t.exportLexical}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!isEditable}
            onClick={() => importFile(editor)}
          >
            <FileArrowUp className="size-3.5 shrink-0" />
            <span className="truncate">{t.importFile}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {SUPPORT_SPEECH_RECOGNITION && (
            <DropdownMenuItem
              disabled={!isEditable}
              onClick={() =>
                editor.dispatchCommand(SPEECH_TO_TEXT_COMMAND, !isListening)
              }
            >
              <Microphone
                className={cn(
                  "size-3.5 shrink-0",
                  isListening && "text-destructive",
                )}
              />
              <span className="truncate">
                {isListening ? "Stop listening" : t.speechToText}
              </span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
            <Keyboard className="size-3.5 shrink-0" />
            <span className="truncate">{t.keyboardShortcuts}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.setEditable(!isEditable)}>
            {isEditable ? (
              <Lock className="size-3.5 shrink-0" />
            ) : (
              <LockOpen className="size-3.5 shrink-0" />
            )}
            <span className="truncate">
              {isEditable ? t.switchToReadOnly : t.switchToEditMode}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );

  if (target) {
    return createPortal(content, target);
  }

  return <div className="absolute top-2 right-2 z-10">{content}</div>;
}
