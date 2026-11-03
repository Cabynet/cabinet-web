import { uploadFileToR2 } from "@/lib/api-client";

// Notes store the image URL, not base64, so autosaves and list responses stay small.
export async function uploadEditorImage(file: File): Promise<string> {
  return (await uploadFileToR2(file)).url;
}
