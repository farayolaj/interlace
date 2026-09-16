import {
  ContentTypeRegistry,
  type ContentType,
  type SerializedInteractiveMediaDocument,
} from "@interlace/core";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { useState } from "react";
import { InterlaceEditor } from "./interlace-editor";

const VIDEO_SRC = "https://lorem.video/720p";
const VIDEO_DURATION = 20;

function makeQuizContentType(): ContentType<{
  question: string;
  options: string[];
  correctIndex: number;
}> {
  return {
    getId: () => "quiz-editor",
    getVersion: () => 1,
    getMaximumScore: () => 100,
    renderEditor: (container: HTMLElement, data: { question: string }) => {
      container.textContent = data.question;
    },
    renderPlayback: (container: HTMLElement, data: { question: string }) => {
      const p = document.createElement("p");
      p.textContent = data.question || "(empty question)";
      container.appendChild(p);
    },
  };
}

function makePollContentType(): ContentType<{ prompt: string }> {
  return {
    getId: () => "poll",
    getVersion: () => 1,
    getMaximumScore: () => undefined,
    renderEditor: (container: HTMLElement, data: { prompt: string }) => {
      container.textContent = data.prompt;
    },
    renderPlayback: (container: HTMLElement, data: { prompt: string }) => {
      const p = document.createElement("p");
      p.textContent = data.prompt;
      container.appendChild(p);
    },
  };
}

function makeDefaultRegistry(): ContentTypeRegistry {
  const registry = new ContentTypeRegistry();
  registry.register(makeQuizContentType());
  registry.register(makePollContentType());
  return registry;
}

function makeInitialDocument(): SerializedInteractiveMediaDocument {
  return {
    video: { src: VIDEO_SRC, duration: VIDEO_DURATION },
    items: [
      {
        id: "c1",
        title: "Mid-roll quiz",
        hook: {
          type: "blocking",
          timestamp: 18,
          placement: { x: 50, y: 50, width: 20, height: 20 },
        },
        content: {
          contentTypeId: "quiz-editor",
          version: 1,
          data: {
            question: "What is the capital of France?",
            options: ["Paris", "London", "Berlin"],
            correctIndex: 0,
          },
        },
      },
      {
        id: "c2",
        title: "Side poll",
        hook: {
          type: "non-blocking",
          start: 30,
          end: 45,
          placement: { x: 30, y: 30, width: 18, height: 18 },
          revealBehavior: "click",
        },
        content: {
          contentTypeId: "poll",
          version: 1,
          data: { prompt: "How are you feeling today?" },
        },
      },
    ],
  };
}

const meta: Meta<typeof InterlaceEditor> = {
  title: "Editor/InterlaceEditor",
  component: InterlaceEditor,
  args: {
    contentTypeRegistry: makeDefaultRegistry(),
    onUpload: fn(
      async (file: File) =>
        `https://cdn.example.com/${encodeURIComponent(file.name)}`,
    ),
    onSave: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const NewDocument: Story = {};

export const EditExisting: Story = {
  args: {
    document: makeInitialDocument(),
  },
};

export const UploadFailure: Story = {
  args: {
    onUpload: fn(async () => {
      throw new Error("Upload failed: network unreachable");
    }),
    onError: fn(),
  },
};

export const StringsOverride: Story = {
  args: {
    document: makeInitialDocument(),
    strings: {
      previewTitle: "Authoring surface",
      saveLabel: "Publish document",
      timelineHeading: "My hooks",
      hookHeading: "Selected hook",
      replaceVideoLabel: "Swap video",
      noItemSelectedLabel: "Pick a hook below to edit its placement.",
    },
  },
};

export const ThemeOverride: Story = {
  args: {
    document: makeInitialDocument(),
    theme: {
      accentColor: "#0d9488",
      backgroundColor: "#f8fafc",
      surfaceColor: "#fff",
      borderColor: "#e2e8f0",
      textColor: "#0f172a",
      mutedTextColor: "#64748b",
    },
  },
};

export function WithSaveLogging() {
  const [savedDoc, setSavedDoc] =
    useState<SerializedInteractiveMediaDocument | null>(null);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <InterlaceEditor
        contentTypeRegistry={makeDefaultRegistry()}
        document={makeInitialDocument()}
        onUpload={async (file) =>
          `https://cdn.example.com/${encodeURIComponent(file.name)}`
        }
        onSave={(doc) => setSavedDoc(doc)}
      />
      <pre
        style={{
          margin: 0,
          padding: 12,
          background: "#0f172a",
          color: "#f8fafc",
          fontSize: 12,
          borderRadius: 8,
          overflow: "auto",
        }}
      >
        {savedDoc
          ? JSON.stringify(savedDoc, null, 2)
          : "Click Save to capture the document."}
      </pre>
    </div>
  );
}
