import type { SerializedInteractiveMediaDocument } from "@interlacejs/core";

/**
 * The built-in sample document: a short trailer with one multi-question
 * blocking quiz and one single-question non-blocking anchor quiz, both in
 * the canonical rich shape (text-only media-free data keeps the sample
 * resilient). The mixed shapes exercise the normalizer's multi and
 * flat→single paths.
 */
export const SAMPLE_DOC: SerializedInteractiveMediaDocument = {
  video: {
    src: "https://lorem.video/720p",
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
          questions: [
            {
              id: "q-1",
              text: "What does the demo plug on this trailer?",
              options: [
                { id: "plug-blazes", text: "For Bigger Blazes" },
                { id: "plug-safety", text: "A fire safety lesson" },
                { id: "plug-nothing", text: "Nothing in particular" },
              ],
              correctOptionId: "plug-blazes",
            },
            {
              id: "q-2",
              text: "Which part of this trailer is the interactive demo?",
              options: [
                { id: "feature-hook", text: "The quiz that pauses the video" },
                { id: "feature-credits", text: "The end credits" },
              ],
              correctOptionId: "feature-hook",
            },
          ],
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
          questions: [
            {
              id: "q-1",
              text: "Which trailer feature is the demo's core?",
              options: [
                { id: "choice-hook", text: "Interactive hooks" },
                { id: "choice-linear", text: "Linear playback" },
              ],
              correctOptionId: "choice-hook",
            },
          ],
        },
      },
    },
  ],
};
