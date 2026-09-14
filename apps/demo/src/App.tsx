import { useState } from "react";
import "./index.css";

type TabId = "author" | "watch";

const TABS: { id: TabId; label: string; placeholder: string }[] = [
  { id: "author", label: "Author", placeholder: "Author view lands in Phase 2" },
  { id: "watch", label: "Watch", placeholder: "Watch view lands in Phase 2" },
];

/**
 * Placeholder demo shell. The Author/Watch views land in Phase 2; visuals
 * get a proper design pass in Phase 3.
 */
function App() {
  const [activeTab, setActiveTab] = useState<TabId>("author");
  const active = TABS.find((tab) => tab.id === activeTab) ?? TABS[0]!;

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
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: activeTab === tab.id ? "#0f172a" : "#ffffff",
              color: activeTab === tab.id ? "#ffffff" : "#0f172a",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main role="tabpanel" style={{ padding: 24 }}>
        <p>{active.placeholder}</p>
      </main>
    </div>
  );
}

export default App;