import { normalizeQuizData } from "./validate";
import type { RawQuizData } from "./schema";
import { COLORS, FONTS, RADIUS, SHADOWS, SPACE, TYPE } from "./tokens";

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
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  img.style.borderRadius = `${RADIUS.sm}px`;
  img.style.marginBottom = `${SPACE[2]}px`;
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
  root.style.fontFamily = FONTS.body;
  root.style.color = COLORS.text;
  root.style.lineHeight = "1.5";

  const question = document.createElement("p");
  question.className = "quiz-playback-question";
  question.textContent = data.question.text;
  question.style.margin = `0 0 ${SPACE[2]}px 0`;
  question.style.fontFamily = FONTS.display;
  question.style.fontSize = `${TYPE.lg}px`;
  question.style.fontWeight = "600";
  root.appendChild(question);

  const questionMedia = createMediaImage(
    "quiz-playback-question-media",
    data.question.media?.src ?? "",
    data.question.media?.alt,
  );
  if (questionMedia) root.appendChild(questionMedia);

  const optionsBox = document.createElement("div");
  optionsBox.className = "quiz-playback-options";
  optionsBox.style.display = "flex";
  optionsBox.style.flexDirection = "column";
  optionsBox.style.gap = `${SPACE[2]}px`;
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
    button.style.display = "flex";
    button.style.alignItems = "center";
    button.style.gap = `${SPACE[2]}px`;
    button.style.width = "100%";
    button.style.padding = `${SPACE[3]}px ${SPACE[4]}px`;
    button.style.backgroundColor = COLORS.surface;
    button.style.border = `1px solid ${COLORS.borderStrong}`;
    button.style.borderRadius = `${RADIUS.md}px`;
    button.style.cursor = "pointer";
    button.style.fontSize = `${TYPE.base}px`;
    button.style.color = COLORS.text;
    button.style.textAlign = "left";
    button.style.transition =
      "background-color 150ms ease, border-color 150ms ease, color 150ms ease";

    const text = document.createElement("span");
    text.className = "quiz-playback-option-text";
    text.textContent = option.text;
    text.style.flex = "1";
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
        candidate.style.cursor = "default";
        if (candidateOption.id === correctOptionId) {
          candidate.classList.add("quiz-playback-option-correct");
          candidate.style.backgroundColor = COLORS.accent;
          candidate.style.borderColor = COLORS.accent;
          candidate.style.color = COLORS.white;
        }
      });
      if (option.id !== correctOptionId) {
        button.classList.add("quiz-playback-option-incorrect");
        button.style.backgroundColor = COLORS.errorBg;
        button.style.borderColor = COLORS.errorBorder;
        button.style.color = COLORS.errorText;
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
