import { normalizeQuizData } from "./validate";
import type { RawQuizData } from "./schema";

/** Shared maximum score for quiz content. */
const QUIZ_MAX_SCORE = 100;

export interface QuizPlaybackCallbacks {
  onComplete(score?: number): void;
}

interface QuizPlaybackSession {
  destroy: () => void;
}

/**
 * Per-container playback sessions, so `unmountQuizPlayback` can tear down
 * the listeners built by `renderQuizPlayback`.
 */
const quizPlaybackSessions = new WeakMap<HTMLElement, QuizPlaybackSession>();

/** Creates a playback media `<img>`, or `null` when src is blank. */
function createMediaImage(
  className: string,
  src: string,
  alt: string | undefined,
): HTMLImageElement | null {
  if (src.length === 0) return null;
  const img = document.createElement("img");
  img.className = className;
  img.src = src;
  if (alt) img.alt = alt;
  return img;
}

/**
 * Renders a functional multiple-choice playback UI into `container`: the
 * question (with optional media), one button per option (each with optional
 * media), and immediate scoring — selecting the correct option reports the
 * maximum score, anything else 0, through `callbacks.onComplete`. Accepts
 * legacy raw documents; they are normalized before rendering.
 */
export function renderQuizPlayback(
  container: HTMLElement,
  raw: RawQuizData,
  callbacks: QuizPlaybackCallbacks,
): void {
  // Destroy any session already mounted in this container: the overlay
  // lifecycle may re-render without an intervening unmount, and overwriting
  // the WeakMap entry would leak the first root (and its click listeners).
  unmountQuizPlayback(container);

  const data = normalizeQuizData(raw);
  const root = document.createElement("div");
  root.className = "quiz-playback";

  const question = document.createElement("p");
  question.className = "quiz-playback-question";
  question.textContent = data.question.text;
  root.appendChild(question);

  const questionMedia = createMediaImage(
    "quiz-playback-question-media",
    data.question.media?.src ?? "",
    data.question.media?.alt,
  );
  if (questionMedia) root.appendChild(questionMedia);

  const optionsBox = document.createElement("div");
  optionsBox.className = "quiz-playback-options";
  root.appendChild(optionsBox);

  // An unresolved correct option means no option is marked correct; every
  // answer then scores 0 (defensive: documents may predate an authored
  // answer).
  const correctOptionId = data.correctOptionId;
  let selected: string | null = null;

  const optionEntries = data.options.map((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-playback-option";

    const text = document.createElement("span");
    text.className = "quiz-playback-option-text";
    text.textContent = option.text;
    button.appendChild(text);

    const thumbnail = createMediaImage(
      "quiz-playback-option-media",
      option.media?.src ?? "",
      option.media?.alt,
    );
    if (thumbnail) button.appendChild(thumbnail);

    button.addEventListener("click", () => {
      if (selected !== null) return; // single answer
      selected = option.id;
      // Reveal correctness and lock the options.
      optionEntries.forEach(({ button: candidate, option: candidateOption }) => {
        candidate.disabled = true;
        if (candidateOption.id === correctOptionId) {
          candidate.classList.add("quiz-playback-option-correct");
        }
      });
      if (option.id !== correctOptionId) {
        button.classList.add("quiz-playback-option-incorrect");
      }
      const score = option.id === correctOptionId ? QUIZ_MAX_SCORE : 0;
      callbacks.onComplete(score);
    });

    optionsBox.appendChild(button);
    return { button, option };
  });

  container.appendChild(root);

  quizPlaybackSessions.set(container, {
    destroy: () => {
      root.remove();
    },
  });
}

/** Cleans up the playback session mounted in `container`, if any. */
export function unmountQuizPlayback(container: HTMLElement): void {
  quizPlaybackSessions.get(container)?.destroy();
  quizPlaybackSessions.delete(container);
}
