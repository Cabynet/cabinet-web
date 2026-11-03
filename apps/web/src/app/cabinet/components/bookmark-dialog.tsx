"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field"
import { FolderPicker } from "./folder-picker"
import { TagPicker } from "./tag-picker"
import { Spinner } from "@/components/ui/spinner"
import { ClipboardText, Sparkle } from "@phosphor-icons/react"
import { AXIOS_INSTANCE } from "@/lib/api-client"
import { DuplicateBookmarkNotice } from "./duplicate-bookmark-notice"
import { itemAccess } from "@/lib/bookmark-kind"

interface BookmarkDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  bookmarkToEdit: any | null
  bookmarkForm: any
  folders: any[]
  tags?: any[]
  onClose: () => void
}

export function BookmarkDialog({
  isOpen,
  onOpenChange,
  bookmarkToEdit,
  bookmarkForm,
  folders,
  tags = [],
  onClose,
}: BookmarkDialogProps) {
  const [isScraping, setIsScraping] = useState(false)
  // Others' links in a folder you edit: folder and tags belong to the author.
  const limited = !!bookmarkToEdit && itemAccess(bookmarkToEdit) !== "owner"

  const handleScrape = async (url: string) => {
    if (!url) return
    let targetUrl = url.trim()
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl
      bookmarkForm.setFieldValue("url", targetUrl)
    }
    setIsScraping(true)
    try {
      const res = await AXIOS_INSTANCE.get("/v1/bookmarks/scrape", {
        params: { url: targetUrl },
      })
      const data = res.data
      if (data) {
        const metadata = data
        if (metadata.title) bookmarkForm.setFieldValue("title", metadata.title)
        if (metadata.description) bookmarkForm.setFieldValue("description", metadata.description)
      }
    } catch (err) {
      console.error("Failed to scrape URL:", err)
    } finally {
      setIsScraping(false)
    }
  }

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        if (text) {
          const trimmed = text.trim()
          bookmarkForm.setFieldValue("url", trimmed)
          handleScrape(trimmed)
        }
      }
    } catch (err) {
      console.warn("Clipboard access denied or unavailable", err)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl sm:w-full sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {bookmarkToEdit ? "Edit bookmark" : "New bookmark"}
          </DialogTitle>
          <DialogDescription>
            {limited
              ? "Someone else saved this link. You can edit its link, title, and description."
              : "Save a link with auto-extracted metadata."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            bookmarkForm.handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <FieldGroup>
            <bookmarkForm.Subscribe
              selector={(state: any) => state.values.type}
              children={(currentType: string) => {
                if (currentType === "NOTE") return null
                return (
                  <bookmarkForm.Field
                    name="url"
                    children={(field: any) => {
                      const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>URL</FieldLabel>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              aria-invalid={isInvalid}
                              placeholder="Paste a link"
                              type="url"
                              className="flex-1"
                            />
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handlePasteFromClipboard}
                                className="flex h-11 flex-1 items-center justify-center gap-1 rounded-md border border-border px-2.5 text-sm font-medium hover:bg-muted sm:h-9 sm:flex-initial"
                                title="Paste from clipboard and auto-fill"
                              >
                                <ClipboardText className="size-3.5" />
                                Paste
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={!field.state.value || isScraping}
                                onClick={() => handleScrape(field.state.value)}
                                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted sm:h-9 sm:flex-initial"
                              >
                                {isScraping ? (
                                  <>
                                    <Spinner className="size-3.5" />
                                    Fetching…
                                  </>
                                ) : (
                                  <>
                                    <Sparkle className="size-3.5" />
                                    Auto-fill
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          <DuplicateBookmarkNotice url={field.state.value} excludeId={bookmarkToEdit?.id} />
                          {isInvalid && (
                            <FieldError
                              errors={field.state.meta.errors.map((err: any) =>
                                typeof err === "string" ? { message: err } : err
                              )}
                            />
                          )}
                        </Field>
                      )
                    }}
                  />
                )
              }}
            />

            <bookmarkForm.Field
              name="title"
              children={(field: any) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Title (Optional)</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Leave blank to fetch from URL metadata"
                    />
                    {isInvalid && (
                      <FieldError
                        errors={field.state.meta.errors.map((err: any) =>
                          typeof err === "string" ? { message: err } : err
                        )}
                      />
                    )}
                  </Field>
                )
              }}
            />

            <bookmarkForm.Field
              name="description"
              children={(field: any) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Description (Optional)</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      placeholder="Short summary (optional)"
                    />
                    {isInvalid && (
                      <FieldError
                        errors={field.state.meta.errors.map((err: any) =>
                          typeof err === "string" ? { message: err } : err
                        )}
                      />
                    )}
                  </Field>
                )
              }}
            />

            {!limited && <div className="flex flex-col gap-4">
              {folders.length > 0 && <bookmarkForm.Field
                name="folderId"
                children={(field: any) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Folder</FieldLabel>
                      <FolderPicker id={field.name} folders={folders} value={field.state.value || ""} onChange={field.handleChange} invalid={isInvalid} />
                      {isInvalid && (
                        <FieldError
                          errors={field.state.meta.errors.map((err: any) =>
                            typeof err === "string" ? { message: err } : err
                          )}
                        />
                      )}
                    </Field>
                  )
                }}
              />}

              <bookmarkForm.Field
                name="tags"
                children={(field: any) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel id={`${field.name}-label`}>Tags</FieldLabel>
                      <TagPicker value={field.state.value || []} tags={tags} onChange={field.handleChange} onBlur={field.handleBlur} invalid={isInvalid} labelId={`${field.name}-label`} />
                      {isInvalid && (
                        <FieldError
                          errors={field.state.meta.errors.map((err: any) =>
                            typeof err === "string" ? { message: err } : err
                          )}
                        />
                      )}
                    </Field>
                  )
                }}
              />
            </div>}
          </FieldGroup>

          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <bookmarkForm.Subscribe
              selector={(state: any) => state.isSubmitting}
              children={(isSubmitting: boolean) => (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex flex-1 items-center justify-center gap-1.5"
                >
                  {isSubmitting && <Spinner className="h-3.5 w-3.5" />}
                  {bookmarkToEdit ? "Save changes" : "Save bookmark"}
                </Button>
              )}
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
