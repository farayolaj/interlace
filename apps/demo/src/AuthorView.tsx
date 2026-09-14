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
    <section className="demo-panel">
      <header className="demo-panel-header">
        <h2 className="demo-panel-title">Create an interactive video</h2>
        <p className="demo-panel-subtitle">
          Add a video, place hooks on the timeline, then save to play it back.
        </p>
      </header>

      {errorMessage && (
        <div className="demo-alert" role="alert">
          <span className="demo-alert-message">{errorMessage}</span>
          <button
            type="button"
            className="demo-alert-dismiss"
            onClick={() => setErrorMessage(null)}
          >
            Dismiss
          </button>
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
    </section>
  );
}
