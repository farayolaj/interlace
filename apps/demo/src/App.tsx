import { useState } from "react";
import type { SerializedInteractiveMediaDocument } from "@interlace/core";
import { AuthorView } from "./AuthorView";
import { WatchView } from "./WatchView";
import { loadDoc, saveDoc } from "./storage";
import { SAMPLE_DOC } from "./sample";
import "./index.css";

type Mode = "author" | "watch";

const TABS: { id: Mode; label: string }[] = [
  { id: "author", label: "Author" },
  { id: "watch", label: "Watch" },
];

/**
 * Demo host: tabs switch between authoring (`InterlaceEditor`) and playback
 * (`InteractiveVideoPlayer`). The persisted document (or the built-in sample
 * when none) drives both modes.
 */
function App() {
  const [mode, setMode] = useState<Mode>("author");
  const [doc, setDoc] = useState<SerializedInteractiveMediaDocument | null>(
    () => loadDoc(),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Watch plays the last saved doc, or the sample when nothing is saved.
  const watchDoc = doc ?? SAMPLE_DOC;

  const handleAuthorSaved = (saved: SerializedInteractiveMediaDocument) => {
    setDoc(saved);
    setMode("watch");
  };

  const handleResetToSample = () => {
    saveDoc(SAMPLE_DOC);
    setDoc(SAMPLE_DOC);
  };

  const dismissError = () => setErrorMessage(null);

  return (
    <div className="demo-app">
      <header className="demo-header">
        <div className="demo-header-inner">
          <h1 className="demo-wordmark">Interlace</h1>
          <p className="demo-tagline">
            A demo of interactive video authoring and playback.
          </p>
        </div>
      </header>

      <nav className="demo-nav" role="tablist" aria-label="Demo views">
        <div className="demo-nav-inner">
          <div className="demo-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                className="demo-tab"
                onClick={() => setMode(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="demo-main">
        {errorMessage && (
          <div className="demo-alert" role="alert">
            <span className="demo-alert-message">{errorMessage}</span>
            <button
              type="button"
              className="demo-alert-dismiss"
              onClick={dismissError}
            >
              Dismiss
            </button>
          </div>
        )}

        {mode === "author" ? (
          <AuthorView initialDocument={doc} onSaved={handleAuthorSaved} />
        ) : (
          <WatchView
            doc={watchDoc}
            onResetToSample={handleResetToSample}
            onError={(error) => setErrorMessage(error.message)}
          />
        )}
      </main>

      <footer className="demo-footer">
        <p>
          <strong>Author:</strong> build an interactive video ·{" "}
          <strong>Watch:</strong> play it back · Save in Author to switch to
          Watch.
        </p>
      </footer>
    </div>
  );
}

export default App;
