import { ContentInstance, ContentTypeRegistry } from "@interlace/core";
import type {
  ContentRecord,
  ContentState,
  ContentType,
  Hook,
  Placement,
  SerializedInteractiveMediaDocument,
} from "@interlace/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthoringStore } from "../hooks/use-authoring-store";
import type { InteractiveMediaItem } from "../hooks/use-authoring-store";
import { ContentTypeEditorSlot } from "./content-type-editor-slot";
import { ContentTypePicker } from "./content-type-picker";
import { PlacementEditor } from "./placement-editor";
import { Timeline } from "./timeline";

export interface InteractiveMediaAuthoringProps {
  videoSrc: string;
  videoDuration: number;
  /**
   * Registry of content types available for authoring. Captured when the
   * initial document is loaded; swapping the registry after load is not
   * supported (loaded items keep their resolved content types).
   */
  registry: ContentTypeRegistry;
  initialDocument?: SerializedInteractiveMediaDocument;
  /**
   * Continuous snapshot stream: fires on the initial mount and on every
   * state change with the latest serialized document (last-write-wins).
   * Consumers that persist should debounce or coalesce.
   */
  onSerializedChange?: (doc: SerializedInteractiveMediaDocument) => void;
}

const DEFAULT_CONTENT_TYPE_ID = "quiz";
const EDIT_CONTENT_LABEL = "Edit Content";

const DEFAULT_PLACEMENT: Placement = { x: 50, y: 50, width: 20, height: 20 };

/**
 * Default authored data for quiz content. Content types without a dedicated
 * factory get an empty object; the store round-trip keeps whatever shape is
 * recorded on the instance.
 */
function makeDefaultData(contentTypeId: string): unknown {
  if (contentTypeId === "quiz" || contentTypeId === "quiz-editor") {
    return { question: "", options: ["", ""], correctIndex: 0 };
  }
  return {};
}

function makeHook(hookType: "blocking" | "non-blocking"): Hook {
  if (hookType === "blocking") {
    return { type: "blocking", timestamp: 0, placement: DEFAULT_PLACEMENT };
  }
  return {
    type: "non-blocking",
    start: 0,
    end: 10,
    placement: DEFAULT_PLACEMENT,
    revealBehavior: "click",
  };
}

function buildContentInstance(
  id: string,
  title: string,
  contentType: ContentType,
  hook: Hook,
  data: unknown,
): ContentInstance {
  const record: ContentRecord = {
    id,
    title,
    contentTypeId: contentType.getId(),
    data,
    state: "pending" as ContentState,
    hook,
  };
  return new ContentInstance(record, contentType);
}

/**
 * Rebuilds a `ContentInstance` from its public getters plus optional
 * overrides. `ContentInstance`'s record is private, so any edit (title or
 * authored data) requires constructing a new instance.
 */
function rebuildContentInstance(
  content: ContentInstance,
  contentType: ContentType,
  overrides: { title?: string; data?: unknown },
): ContentInstance {
  const record: ContentRecord = {
    id: content.getId(),
    title: overrides.title ?? content.getTitle(),
    contentTypeId: content.getContentTypeId(),
    data: overrides.data !== undefined ? overrides.data : content.getData(),
    state: content.getState(),
    hook: content.getHook(),
  };
  return new ContentInstance(record, contentType);
}

function pickDefaultContentTypeId(registry: ContentTypeRegistry): string {
  const ids = registry.getAll().map((ct) => ct.getId());
  if (ids.includes(DEFAULT_CONTENT_TYPE_ID)) return DEFAULT_CONTENT_TYPE_ID;
  if (ids.includes("quiz-editor")) return "quiz-editor";
  return ids[0] ?? DEFAULT_CONTENT_TYPE_ID;
}

/**
 * InteractiveMediaAuthoring - the top-level authoring surface. Compose the
 * placement editor, timeline, content-type picker and content-type editor
 * slot over the authoring store.
 *
 * Memoization notes (Phase 2 Oracle risk #2):
 * - The slot `data` prop is derived through `useMemo` keyed on the selected
 *   `ContentInstance`; it only gets a new identity when the selected item's
 *   content is actually replaced, so the slot does not remount on unrelated
 *   parent re-renders.
 * - The slot `onChange` is a `useCallback`; the slot stores the latest
 *   callback in a ref, so its effect does not re-run on callback identity
 *   churn.
 */
export function InteractiveMediaAuthoring({
  videoSrc,
  videoDuration,
  registry,
  initialDocument,
  onSerializedChange,
}: InteractiveMediaAuthoringProps) {
  const { state, addItem, removeItem, updateItem, loadDocument, serialize } =
    useAuthoringStore(videoSrc, videoDuration);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [slotOpen, setSlotOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<string>(() =>
    pickDefaultContentTypeId(registry),
  );

  const nextIdRef = useRef(1);
  const registryRef = useRef(registry);
  registryRef.current = registry;
  const loadedInitialDocRef = useRef<SerializedInteractiveMediaDocument | null>(
    null,
  );
  const initialLoadPendingRef = useRef(false);

  // Load the initial document once per document identity. The effect is keyed
  // on the document only (not the registry) so a consumer that recreates the
  // registry on every render does not reload and wipe in-progress edits.
  useEffect(() => {
    if (!initialDocument) return;
    if (loadedInitialDocRef.current === initialDocument) return;
    loadedInitialDocRef.current = initialDocument;
    initialLoadPendingRef.current = true;
    const { validationErrors, warnings } = loadDocument(
      initialDocument,
      registryRef.current,
    );
    if (validationErrors.length > 0) {
      console.warn(
        "[InteractiveMediaAuthoring] validation errors:",
        validationErrors,
      );
    }
    if (warnings.length > 0) {
      console.warn("[InteractiveMediaAuthoring] warnings:", warnings);
    }
  }, [initialDocument, loadDocument]);

  // Publish serialized changes whenever the store state changes. The first
  // emission after an initial-document load is suppressed so consumers do not
  // receive a transient empty snapshot before the loaded items arrive.
  useEffect(() => {
    if (!onSerializedChange) return;
    if (initialLoadPendingRef.current) {
      initialLoadPendingRef.current = false;
      return;
    }
    onSerializedChange(serialize());
  }, [state, onSerializedChange, serialize]);

  const selectedItem = useMemo(
    () =>
      state.items.find((item) => item.content.getId() === selectedItemId) ??
      null,
    [state.items, selectedItemId],
  );
  const selectedContent = selectedItem?.content ?? null;

  const slotContentTypeId = selectedContent?.getContentTypeId() ?? null;

  const slotData = useMemo(
    () => (selectedContent ? selectedContent.getData() : null),
    [selectedContent],
  );

  const registeredTypeIds = useMemo(
    () => registry.getAll().map((ct) => ct.getId()),
    [registry],
  );

  const timelineEntries = useMemo(
    () =>
      state.items.map((item) => {
        const hook = item.hook;
        if (hook.type === "blocking") {
          return {
            id: item.content.getId(),
            title: item.content.getTitle(),
            hookType: "blocking" as const,
            timestamp: hook.timestamp,
          };
        }
        return {
          id: item.content.getId(),
          title: item.content.getTitle(),
          hookType: "non-blocking" as const,
          start: hook.start,
          end: hook.end,
        };
      }),
    [state.items],
  );

  const handleSelectEntry = useCallback((id: string) => {
    setSelectedItemId(id);
  }, []);

  const handleAddEntry = useCallback(
    (hookType: "blocking" | "non-blocking") => {
      const contentType =
        registry.get(newItemType) ??
        registry.get(DEFAULT_CONTENT_TYPE_ID) ??
        registry.getAll()[0];
      if (!contentType) return;
      const id = `new-${nextIdRef.current++}`;
      const hook = makeHook(hookType);
      const item = buildContentInstance(
        id,
        `New ${contentType.getId()}`,
        contentType,
        hook,
        makeDefaultData(contentType.getId()),
      );
      addItem({ content: item, hook });
      setSelectedItemId(id);
      setSlotOpen(false);
    },
    [newItemType, registry, addItem],
  );

  const handleDeleteEntry = useCallback(
    (id: string) => {
      removeItem(id);
      setSelectedItemId((prev) => (prev === id ? null : prev));
      setSlotOpen(false);
    },
    [removeItem],
  );

  const handleUpdateEntry = useCallback(
    (id: string, updates: { title?: string; timestamp?: number; start?: number; end?: number }) => {
      const current = state.items.find((item) => item.content.getId() === id);
      if (!current) return;
      const contentType = registry.get(current.content.getContentTypeId());
      if (!contentType) return;
      const title =
        typeof updates.title === "string"
          ? updates.title
          : current.content.getTitle();
      let hook = current.hook;
      if (hook.type === "blocking") {
        hook = { ...hook, timestamp: updates.timestamp ?? hook.timestamp };
      } else {
        hook = {
          ...hook,
          start: updates.start ?? hook.start,
          end: updates.end ?? hook.end,
        };
      }
      updateItem(id, {
        content: rebuildContentInstance(current.content, contentType, {
          title,
        }),
        hook,
      });
    },
    [state.items, registry, updateItem],
  );

  const handlePlacementChange = useCallback(
    (nextPlacement: Placement) => {
      if (!selectedItemId) return;
      const current = state.items.find(
        (item) => item.content.getId() === selectedItemId,
      );
      if (!current) return;
      updateItem(selectedItemId, {
        content: current.content,
        hook: { ...current.hook, placement: nextPlacement },
      });
    },
    [selectedItemId, state.items, updateItem],
  );

  const handleSlotChange = useCallback(
    (newData: unknown) => {
      if (!selectedItemId) return;
      const current = state.items.find(
        (item) => item.content.getId() === selectedItemId,
      );
      if (!current) return;
      const contentType = registry.get(current.content.getContentTypeId());
      if (!contentType) return;
      const updatedContent = rebuildContentInstance(
        current.content,
        contentType,
        { data: newData },
      );
      const updatedItem: InteractiveMediaItem = {
        content: updatedContent,
        hook: current.hook,
      };
      updateItem(selectedItemId, updatedItem);
    },
    [selectedItemId, state.items, registry, updateItem],
  );

  return (
    <div
      className="interactive-media-authoring"
      style={{ maxWidth: 960, margin: "0 auto", padding: 16 }}
    >
      <header>
        <h1 style={{ margin: "0 0 4px 0" }}>Interactive Media Authoring</h1>
        <p style={{ margin: "0 0 16px 0", color: "#666", fontSize: "14px" }}>
          {state.videoSrc} &middot; {state.videoDuration}s
        </p>
      </header>

      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: "18px" }}>Hook placement</h2>
          <button
            type="button"
            onClick={() => setSlotOpen(true)}
            disabled={!selectedItem}
            style={{
              padding: "8px 16px",
              backgroundColor: selectedItem ? "#0066cc" : "#ccc",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: selectedItem ? "pointer" : "not-allowed",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {EDIT_CONTENT_LABEL}
          </button>
        </div>
        {selectedItem ? (
          <PlacementEditor
            placement={selectedItem.hook.placement}
            onPlacementChange={handlePlacementChange}
          />
        ) : (
          <div
            style={{
              width: 640,
              height: 360,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f0f0f0",
              border: "1px solid #ccc",
              color: "#999",
            }}
          >
            Select an item below to edit its placement.
          </div>
        )}
      </section>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>Add content</h2>
        <ContentTypePicker
          registeredTypes={registeredTypeIds}
          selectedType={newItemType}
          onSelect={setNewItemType}
        />
      </section>

      <Timeline
        entries={timelineEntries}
        selectedId={selectedItemId ?? undefined}
        onSelectEntry={handleSelectEntry}
        onUpdateEntry={handleUpdateEntry}
        onDeleteEntry={handleDeleteEntry}
        onAddEntry={handleAddEntry}
      />

      <ContentTypeEditorSlot
        contentTypeId={slotContentTypeId}
        isOpen={slotOpen && selectedItem != null}
        onClose={() => setSlotOpen(false)}
        onSave={() => setSlotOpen(false)}
        registry={registry}
        data={slotData}
        onChange={handleSlotChange}
      />
    </div>
  );
}
