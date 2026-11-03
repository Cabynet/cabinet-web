import { TranslateIcon } from "@phosphor-icons/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";

import { toggleRubyEditor } from "@/components/editor/extensions/ruby";
import { useTranslation } from "@/components/editor/plugins/i18n-plugin";

import { Button } from "@/components/editor/ui/button";
import { ButtonGroup } from "@/components/editor/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/editor/ui/tooltip";

export function RubyToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const isEditable = useLexicalEditable();
  const { t } = useTranslation();

  return (
    <ButtonGroup>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t.insertRuby}
              disabled={!isEditable}
              onClick={() => {
                toggleRubyEditor(editor);
              }}
            >
              <TranslateIcon />
            </Button>
          }
        />
        <TooltipContent>{t.insertRuby}</TooltipContent>
      </Tooltip>
    </ButtonGroup>
  );
}
