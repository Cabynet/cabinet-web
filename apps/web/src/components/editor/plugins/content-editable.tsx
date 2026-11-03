import {
  type ContentEditableElementProps,
  ContentEditable as LexicalContentEditable,
} from "@lexical/react/LexicalContentEditable";

import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

import {
  type LocalizedText,
  useTranslation,
} from "@/components/editor/plugins/i18n-plugin";

const contentEditableVariants = cva(
  "min-h-full w-full bg-transparent text-sm outline-none",
  {
    variants: {
      variant: {
        default: "px-2.5 py-2",
        toolbar: "px-4 py-4",
        draggable: "px-4 py-4 md:px-12",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const placeholderVariants = cva(
  "pointer-events-none absolute text-sm text-muted-foreground select-none",
  {
    variants: {
      variant: {
        default: "start-2.5 top-2",
        toolbar: "start-4 top-4",
        draggable: "start-4 top-4 md:start-12",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function ContentEditable({
  variant,
  className,
  placeholder,
  placeholderClassName,
  ...props
}: VariantProps<typeof contentEditableVariants> &
  Omit<ContentEditableElementProps, "editor" | "className"> & {
    className?: string;
    placeholder?: LocalizedText;
    placeholderClassName?: string;
  }) {
  const { language, dir, t } = useTranslation();
  const placeholderText = placeholder?.[language] ?? t.typeSomething;

  return (
    <LexicalContentEditable
      {...props}
      dir={dir}
      className={cn(contentEditableVariants({ variant }), className)}
      aria-placeholder={placeholderText}
      placeholder={
        <div
          className={cn(placeholderVariants({ variant }), placeholderClassName)}
        >
          {placeholderText}
        </div>
      }
    />
  );
}
