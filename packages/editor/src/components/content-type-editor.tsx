import React, { useRef } from "react";
import { ContentTypeRegistry } from "@interlacejs/core";
import { useContentTypeEditorMount } from "./content-type-editor-mount";

export interface ContentTypeEditorProps<TData = unknown> {
  /** The content type to mount, or `null` while the hook has no content type yet. */
  contentTypeId: string | null;
  registry: ContentTypeRegistry;
  data: TData;
  onChange: (newData: TData) => void;
}

/**
 * ContentTypeEditor - the inline, chrome-free surface that mounts a
 * content type's own editing interface (`renderEditor` /
 * `updateEditor` / `unmount` via the shared
 * `useContentTypeEditorMount` lifecycle).
 *
 * Renders nothing while `contentTypeId` is null (a newly created hook
 * without a content type yet) or when the type is not registered —
 * callers label the subsection and decide visibility.
 */
export function ContentTypeEditor<TData = unknown>({
  contentTypeId,
  registry,
  data,
  onChange,
}: ContentTypeEditorProps<TData>) {
  const containerRef = useRef<HTMLDivElement>(null);

  useContentTypeEditorMount<TData>({
    containerRef,
    active: contentTypeId != null,
    contentTypeId,
    registry,
    data,
    onChange,
  });

  const contentType = contentTypeId ? registry.get(contentTypeId) : undefined;
  if (!contentTypeId || !contentType) return null;

  return (
    <div
      ref={containerRef}
      className="content-type-editor"
      data-testid="content-type-editor"
      style={{ minHeight: 60 }}
    />
  );
}
