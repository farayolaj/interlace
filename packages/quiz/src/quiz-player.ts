import { normalizeQuizData } from "./validate";
import type { QuizOption, RawQuizData } from "./schema";
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
 * Renders a multi-question quiz into `container`: one question at a time
 * with a "Question i of n" indicator, per-question media and option buttons,
 * answer reveal + option lock, and a "Next question" affordance. When the
 * last question is answered the aggregate score
 * (`Math.round(correct / total * 100)`) is reported through
 * `callbacks.onComplete` as the handler's final statement. Accepts legacy
 * raw documents; they are normalized before rendering.
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
  const total = data.questions.length;
  const answers: (string | null)[] = data.questions.map(() => null);
  let currentIndex = 0;
  let completed = false;

  const root = document.createElement("div");
  root.className = "quiz-playback";
  root.style.fontFamily = FONTS.body;
  root.style.color = COLORS.text;
  root.style.lineHeight = "1.5";

  const indicator = document.createElement("div");
  indicator.className = "quiz-playback-indicator";
  indicator.style.fontSize = `${TYPE.xs}px`;
  indicator.style.fontWeight = "600";
  indicator.style.color = COLORS.textMuted;
  indicator.style.marginBottom = `${SPACE[2]}px`;
  indicator.style.textTransform = "uppercase";
  indicator.style.letterSpacing = "0.06em";
  root.appendChild(indicator);

  const question = document.createElement("p");
  question.className = "quiz-playback-question";
  question.style.margin = `0 0 ${SPACE[2]}px 0`;
  question.style.fontFamily = FONTS.display;
  question.style.fontSize = `${TYPE.lg}px`;
  question.style.fontWeight = "600";
  root.appendChild(question);

  const questionMediaSlot = document.createElement("div");
  root.appendChild(questionMediaSlot);

  const optionsBox = document.createElement("div");
  optionsBox.className = "quiz-playback-options";
  optionsBox.style.display = "flex";
  optionsBox.style.flexDirection = "column";
  optionsBox.style.gap = `${SPACE[2]}px`;
  root.appendChild(optionsBox);

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "quiz-playback-next";
  nextButton.textContent = "Next question";
  nextButton.style.display = "none";
  nextButton.style.marginTop = `${SPACE[4]}px`;
  nextButton.style.padding = `${SPACE[2]}px ${SPACE[4]}px`;
  nextButton.style.backgroundColor = COLORS.accent;
  nextButton.style.border = "none";
  nextButton.style.borderRadius = `${RADIUS.md}px`;
  nextButton.style.color = COLORS.white;
  nextButton.style.cursor = "pointer";
  nextButton.style.fontSize = `${TYPE.base}px`;
  nextButton.style.fontWeight = "600";
  nextButton.addEventListener("click", () => {
    if (currentIndex < total - 1) {
      renderQuestion(currentIndex + 1);
    }
  });
  root.appendChild(nextButton);

  container.appendChild(root);

  let optionEntries: { button: HTMLButtonElement; option: QuizOption }[] = [];

  const renderQuestion = (index: number): void => {
    currentIndex = index;
    const spec = data.questions[index]!;
    const correctOptionId = spec.correctOptionId;
    const answered = answers[index] ?? null;

    indicator.textContent = `Question ${index + 1} of ${total}`;
    question.textContent = spec.text;
    questionMediaSlot.innerHTML = "";
    const questionMedia = createMediaImage(
      "quiz-playback-question-media",
      spec.media?.src ?? "",
      spec.media?.alt,
    );
    if (questionMedia) questionMediaSlot.appendChild(questionMedia);

    optionsBox.innerHTML = "";
    optionEntries = spec.options.map((option) => {
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

      // If this question was already answered (e.g. navigating back), render
      // it in its locked, revealed state.
      if (answered !== null) {
        button.disabled = true;
        button.style.cursor = "default";
        if (option.id === correctOptionId) {
          button.classList.add("quiz-playback-option-correct");
          button.style.backgroundColor = COLORS.accent;
          button.style.borderColor = COLORS.accent;
          button.style.color = COLORS.white;
        }
        if (option.id === answered && answered !== correctOptionId) {
          button.classList.add("quiz-playback-option-incorrect");
          button.style.backgroundColor = COLORS.errorBg;
          button.style.borderColor = COLORS.errorBorder;
          button.style.color = COLORS.errorText;
        }
      } else {
        button.addEventListener("click", () => {
          if (completed) return;
          answers[index] = option.id;
          // Reveal correctness and lock this question's options.
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

          if (index < total - 1) {
            nextButton.style.display = "block";
          } else {
            // Final question: aggregate the per-question answers.
            completed = true;
            const correctCount = data.questions.reduce(
              (count, questionSpec, questionIndex) =>
                count +
                (answers[questionIndex] !== null &&
                answers[questionIndex] === questionSpec.correctOptionId
                  ? 1
                  : 0),
              0,
            );
            const score = Math.round(
              (correctCount / total) * QUIZ_MAX_SCORE,
            );
            callbacks.onComplete(score);
          }
        });
      }

      optionsBox.appendChild(button);
      return { button, option };
    });

    nextButton.style.display =
      index < total - 1 && answers[index] !== null ? "block" : "none";
  };

  renderQuestion(0);

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