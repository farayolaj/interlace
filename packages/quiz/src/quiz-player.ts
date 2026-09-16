import type { QuizData, QuizOption } from "./schema";
import { COLORS, FONTS, RADIUS, SPACE, TYPE } from "./tokens";

export interface QuizPlaybackCallbacks {
  onComplete(score?: number): void;
}

interface QuizPlaybackSession {
  destroy: () => void;
}

interface OptionEntry {
  button: HTMLButtonElement;
  option: QuizOption;
  statusGlyph: HTMLSpanElement;
  statusLabel: HTMLSpanElement;
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

/** Locks an option button so it can no longer be clicked. */
function lockOption(button: HTMLButtonElement): void {
  button.disabled = true;
  button.style.cursor = "default";
}

/** Reveals the correct-answer state on an option button. */
function revealCorrect(
  button: HTMLButtonElement,
  glyph: HTMLSpanElement,
  label: HTMLSpanElement,
): void {
  button.classList.add("quiz-playback-option-correct");
  button.style.backgroundColor = COLORS.correctBg;
  button.style.borderColor = COLORS.correctBg;
  button.style.color = COLORS.correctText;
  glyph.textContent = "✓";
  label.textContent = "Correct";
  glyph.style.opacity = "1";
  label.style.opacity = "1";
}

/** Reveals the wrong-answer state on the selected option button. */
function revealIncorrect(
  button: HTMLButtonElement,
  glyph: HTMLSpanElement,
  label: HTMLSpanElement,
): void {
  button.classList.add("quiz-playback-option-incorrect");
  button.style.backgroundColor = COLORS.incorrectBg;
  button.style.borderColor = COLORS.incorrectBorder;
  button.style.color = COLORS.incorrectText;
  glyph.textContent = "✕";
  label.textContent = "Incorrect";
  glyph.style.opacity = "1";
  label.style.opacity = "1";
}

/**
 * Renders a multi-question quiz into `container`: one question at a time
 * with a "Question i of n" indicator, per-question media and option buttons,
 * and an explicit navigation footer. Answering a question reveals
 * correctness and locks its options; the user then advances with **Next**.
 * On the final question, clicking **Next** reports the per-question
 * correct count (`onComplete(correctCount)`, one point per question) ONCE,
 * as the click handler's final statement. **Previous** returns to an
 * answered question in its locked, review-only state. The document is the
 * canonical single-format {@link QuizData} shape.
 */
export function renderQuizPlayback(
  container: HTMLElement,
  data: QuizData,
  callbacks: QuizPlaybackCallbacks,
): void {
  // Destroy any session already mounted in this container: the overlay
  // lifecycle may re-render without an intervening unmount, and overwriting
  // the WeakMap entry would leak the first root (and its click listeners).
  unmountQuizPlayback(container);

  const total = data.questions.length;
  // Per-question recorded selections; back-navigation and the final
  // aggregate both read from here, and reveal locks make it stable.
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

  // Navigation footer: Previous (review-only back) and Next. The final
  // question uses the same Next label; clicking it aggregates the score
  // and fires onComplete once.
  const navFooter = document.createElement("div");
  navFooter.className = "quiz-playback-nav";
  navFooter.style.display = "flex";
  navFooter.style.justifyContent = "flex-end";
  navFooter.style.gap = `${SPACE[2]}px`;
  navFooter.style.marginTop = `${SPACE[4]}px`;
  root.appendChild(navFooter);

  const prevButton = document.createElement("button");
  prevButton.type = "button";
  prevButton.className = "quiz-playback-prev";
  prevButton.textContent = "Previous";
  prevButton.style.padding = `${SPACE[2]}px ${SPACE[4]}px`;
  prevButton.style.backgroundColor = COLORS.surface;
  prevButton.style.border = `1px solid ${COLORS.borderStrong}`;
  prevButton.style.borderRadius = `${RADIUS.md}px`;
  prevButton.style.color = COLORS.text;
  prevButton.style.cursor = "pointer";
  prevButton.style.fontSize = `${TYPE.base}px`;
  prevButton.style.fontWeight = "600";
  prevButton.style.transition = "background-color 150ms ease";
  prevButton.addEventListener("click", () => {
    if (currentIndex > 0) {
      renderQuestion(currentIndex - 1);
    }
  });
  navFooter.appendChild(prevButton);

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "quiz-playback-next";
  nextButton.textContent = "Next";
  nextButton.disabled = true;
  nextButton.style.padding = `${SPACE[2]}px ${SPACE[4]}px`;
  nextButton.style.backgroundColor = COLORS.accent;
  nextButton.style.border = "none";
  nextButton.style.borderRadius = `${RADIUS.md}px`;
  nextButton.style.color = COLORS.white;
  nextButton.style.cursor = "pointer";
  nextButton.style.fontSize = `${TYPE.base}px`;
  nextButton.style.fontWeight = "600";
  nextButton.style.transition =
    "background-color 150ms ease, opacity 150ms ease";
  nextButton.addEventListener("click", () => {
    if (completed) return;
    if (currentIndex < total - 1) {
      renderQuestion(currentIndex + 1);
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
      nextButton.disabled = true;
      nextButton.style.opacity = "0.55";
      callbacks.onComplete(correctCount);
    }
  });
  navFooter.appendChild(nextButton);

  container.appendChild(root);

  let optionEntries: OptionEntry[] = [];

  const syncFooter = (index: number): void => {
    prevButton.style.display = index > 0 ? "block" : "none";
    nextButton.textContent = "Next";
    const answered = answers[index] !== null;
    nextButton.disabled = completed || !answered;
    nextButton.style.opacity = nextButton.disabled ? "0.55" : "1";
  };

  const createOptionButton = (
    option: QuizOption,
    isReview: boolean,
  ): OptionEntry => {
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

    const status = document.createElement("span");
    status.style.display = "flex";
    status.style.alignItems = "center";
    status.style.gap = `${SPACE[1]}px`;
    status.style.marginLeft = "auto";
    status.style.transition = "opacity 150ms ease";

    const glyph = document.createElement("span");
    glyph.style.fontWeight = "700";
    glyph.style.fontSize = `${TYPE.md}px`;
    glyph.style.lineHeight = "1";
    status.appendChild(glyph);

    const label = document.createElement("span");
    label.style.fontWeight = "600";
    label.style.fontSize = `${TYPE.sm}px`;
    label.style.letterSpacing = "0.04em";
    status.appendChild(label);

    button.appendChild(status);

    if (isReview) {
      lockOption(button);
    }

    return { button, option, statusGlyph: glyph, statusLabel: label };
  };

  const revealQuestion = (
    questionIndex: number,
    selectedOptionId: string,
  ): void => {
    const spec = data.questions[questionIndex]!;
    const correctOptionId = spec.correctOptionId;

    optionEntries.forEach((entry) => {
      lockOption(entry.button);
      if (entry.option.id === correctOptionId) {
        revealCorrect(entry.button, entry.statusGlyph, entry.statusLabel);
      }
      if (
        entry.option.id === selectedOptionId &&
        selectedOptionId !== correctOptionId
      ) {
        revealIncorrect(entry.button, entry.statusGlyph, entry.statusLabel);
      }
    });
  };

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
      const isReview = answered !== null;
      const entry = createOptionButton(option, isReview);

      if (isReview) {
        if (option.id === correctOptionId) {
          revealCorrect(entry.button, entry.statusGlyph, entry.statusLabel);
        }
        if (option.id === answered && answered !== correctOptionId) {
          revealIncorrect(entry.button, entry.statusGlyph, entry.statusLabel);
        }
      } else {
        entry.button.addEventListener("click", () => {
          if (completed) return;
          answers[index] = option.id;
          // Reveal correctness and lock this question's options. No
          // auto-advance and no auto-complete: the footer gates progress.
          revealQuestion(index, option.id);
          syncFooter(index);
        });
      }

      optionsBox.appendChild(entry.button);
      return entry;
    });

    syncFooter(index);
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
