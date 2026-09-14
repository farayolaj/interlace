import type { SerializedInteractiveMediaDocument } from "@interlace/core";

/**
 * The built-in sample document: a short trailer with one blocking quiz and
 * one non-blocking anchor quiz, both authored in the canonical rich shape
 * (text-only media-free data keeps the sample resilient).
 */
export const SAMPLE_DOC: SerializedInteractiveMediaDocument = {
  video: {
    src: "https://samplelib.com/mp4/sample-20s-360p.mp4",
    duration: 20,
  },
  items: [
    {
      id: "quiz-trailer-hook",
      title: "Mid-roll quiz",
      hook: {
        type: "blocking",
        timestamp: 5,
        placement: { x: 50, y: 50, width: 20, height: 20 },
      },
      content: {
        contentTypeId: "quiz-editor",
        version: 1,
        data: {
          question: { text: "What does the demo plug on this trailer?" },
          options: [
            { id: "plug-blazes", text: "For Bigger Blazes" },
            { id: "plug-safety", text: "A fire safety lesson" },
            { id: "plug-nothing", text: "Nothing in particular" },
          ],
          correctOptionId: "plug-blazes",
        },
      },
    },
    {
      id: "anchor-corner",
      title: "Side note",
      hook: {
        type: "non-blocking",
        start: 0.5,
        end: 14.5,
        revealBehavior: "click",
        placement: { x: 75, y: 15, width: 16, height: 12 },
      },
      content: {
        contentTypeId: "quiz-editor",
        version: 1,
        data: {
          question: { text: "Which trailer feature is the demo's core?" },
          options: [
            { id: "choice-hook", text: "Interactive hooks" },
            { id: "choice-linear", text: "Linear playback" },
          ],
          correctOptionId: "choice-hook",
        },
      },
    },
  ],
};
