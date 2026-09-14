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

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Interlace demo</h1>
      </header>

      <nav
        role="tablist"
        aria-label="Demo views"
        style={{
          display: "flex",
          gap: 8,
          padding: "12px 24px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => setMode(tab.id)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: mode === tab.id ? "#0f172a" : "#ffffff",
              color: mode === tab.id ? "#ffffff" : "#0f172a",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {errorMessage && (
        <div
          role="alert"
          style={{
            margin: "12px 24px 0",
            padding: "8px 12px",
            background: "#fee",
            color: "#c33",
            borderRadius: 4,
          }}
        >
          {errorMessage}
        </div>
      )}

      <main style={{ padding: 24 }}>
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
    </div>
  );
}

export default App;