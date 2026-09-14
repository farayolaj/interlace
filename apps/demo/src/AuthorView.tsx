import { InterlaceEditor } from "@interlace/editor";
import type { SerializedInteractiveMediaDocument } from "@interlace/core";
import { useState } from "react";
import { getRegistry } from "./registry";
import { saveDoc } from "./storage";

export interface AuthorViewProps {
  /** The persisted document to edit, if any (fresh authoring otherwise). */
  initialDocument: SerializedInteractiveMediaDocument | null;
  /** Called with the saved document; the host switches to Watch mode. */
  onSaved: (doc: SerializedInteractiveMediaDocument) => void;
}

/**
 * Author mode: hosts `InterlaceEditor`. Edits the persisted document when
 * present, otherwise starts a fresh authoring session (video-source step
 * first). Saves persist to local storage and hand the document to the host.
 */
export function AuthorView({ initialDocument, onSaved }: AuthorViewProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <div>
      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: "8px 12px",
            marginBottom: 12,
            background: "#fee",
            color: "#c33",
            borderRadius: 4,
          }}
        >
          {errorMessage}
        </div>
      )}
      <InterlaceEditor
        contentTypeRegistry={getRegistry()}
        document={initialDocument ?? undefined}
        onUpload={async (file: File) => URL.createObjectURL(file)}
        onSave={(doc) => {
          saveDoc(doc);
          onSaved(doc);
        }}
        onError={(error) => setErrorMessage(error.message)}
      />
    </div>
  );
}