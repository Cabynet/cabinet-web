# Cabinet note editor

Adapted from [htmujahid/shadcn-editor](https://github.com/htmujahid/shadcn-editor), MIT (see `LICENSE`), upstream commit `b83d0a671565df48bfd4093e32994773a903df5b`, using Lexical 0.52.0.

- `note-editor.tsx` composes the upstream Editor X extensions. There is no fixed toolbar. Insertion is through the slash picker and block `+`; text formatting is contextual.
- `note-state-plugin.tsx` bridges serialized state/plain text into Cabinet autosave and enforces host read-only permissions independently of the preview toggle.
- `plugins/component-picker/extra-blocks-picker-plugin.tsx` exposes equations, emoji, image URLs, embeds, and find/replace without a top toolbar.
- `ui/` contains editor-local Base UI primitives. Cabinet's shared Radix primitives are deliberately not replaced. Editor icons use Cabinet's Phosphor preset; internal Base UI controls retain upstream Lucide icons.
- Local images are embedded as data URLs. Mentions and autocomplete retain the upstream demo names/dictionaries; they do not query Cabinet accounts.
- Upstream array indexing is adapted for `noUncheckedIndexedAccess`; async image reads and dictation honor permission changes.

Run `pnpm --filter @cabinet/web test:notes` for real-browser insertion, persistence, contextual formatting, permission, and responsive checks. Dictation requires a supported browser and microphone permission. Remote embeds require network access.
