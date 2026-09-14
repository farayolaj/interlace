import { ContentType } from "@interlace/core";

/**
 * Data shape for the built-in quiz playback content type. Matches the
 * data authored by `@interlace/editor`'s built-in QuizEditor
 * (`options` + zero-based optional `correctIndex`), so editor-authored
 * documents play out of the box.
 */
export interface QuizData {
  question: string;
  options: string[];
  correctIndex?: number;
}

export interface QuizResult {
  score: number;
  answered: boolean;
}

/** Shared maximum score for quiz content. */
const QUIZ_MAX_SCORE = 100;

interface QuizPlaybackCallbacks {
  onComplete(score?: number): void;
}

interface QuizPlaybackSession {
  destroy: () => void;
}

/**
 * Per-container playback sessions, so `unmountPlayback` can tear down
 * the listeners built by `renderQuizPlayback`.
 */
const quizPlaybackSessions = new WeakMap<HTMLElement, QuizPlaybackSession>();

/**
 * Renders a functional multiple-choice playback UI into `container`:
 * the question, one button per option, and immediate scoring —
 * selecting the correct option reports the maximum score, anything
 * else 0, through `callbacks.onComplete`. Exported so the editor
 * package's built-in quiz type can delegate to the same renderer.
 */
export function renderQuizPlayback(
  container: HTMLElement,
  data: QuizData,
  callbacks: QuizPlaybackCallbacks,
): void {
  const root = document.createElement("div");
  root.className = "quiz-playback";

  const question = document.createElement("p");
  question.className = "quiz-playback-question";
  question.textContent = data.question ?? "";
  root.appendChild(question);

  const optionsBox = document.createElement("div");
  optionsBox.className = "quiz-playback-options";
  root.appendChild(optionsBox);

  const options: string[] = Array.isArray(data.options) ? data.options : [];
  // An unset correctIndex means no option is marked correct; every
  // answer then scores 0 (defensive: documents may predate an authored
  // answer).
  const correctIndex = data.correctIndex ?? -1;
  let selected: number | null = null;

  const optionButtons = options.map((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-playback-option";
    button.textContent = option;
    button.addEventListener("click", () => {
      if (selected !== null) return; // single answer
      selected = index;
      // Reveal correctness and lock the options.
      optionButtons.forEach((button, buttonIndex) => {
        button.disabled = true;
        if (buttonIndex === correctIndex) {
          button.classList.add("quiz-playback-option-correct");
        }
        if (buttonIndex === selected && selected !== correctIndex) {
          button.classList.add("quiz-playback-option-incorrect");
        }
      });
      const score = index === correctIndex ? QUIZ_MAX_SCORE : 0;
      callbacks.onComplete(score);
    });
    optionsBox.appendChild(button);
    return button;
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

/**
 * Built-in Quiz content type for the player. Aligned with the current
 * core `ContentType` contract; `renderPlayback` is a functional
 * multiple-choice UI with scoring. Registered id is `quiz-editor` —
 * the id `@interlace/editor`'s built-in QuizEditor authors with — so
 * a document authored by the editor plays with no extra registry
 * wiring.
 */
export const QuizContentType: ContentType<QuizData> = {
  getId: () => "quiz-editor",
  getVersion: () => 1,

  getMaximumScore(): number {
    return QUIZ_MAX_SCORE;
  },

  async preload(): Promise<void> {
    // No preload needed for quiz content.
  },

  renderEditor(
    container: HTMLElement,
    data: QuizData,
    onChange: (newData: QuizData) => void,
  ): void {
    // Minimal authoring fallback: full authoring lives in
    // @interlace/editor's QuizEditor, which hosts pass into the
    // editor separately. This keeps the player self-sufficient if a
    // host renders it as an editor.
    const root = document.createElement("div");
    root.className = "quiz-editor";

    const questionInput = document.createElement("input");
    questionInput.type = "text";
    questionInput.className = "quiz-question";
    questionInput.value = data.question ?? "";
    questionInput.addEventListener("input", () => {
      onChange({ ...data, question: questionInput.value });
    });
    root.appendChild(questionInput);

    container.appendChild(root);
  },

  renderPlayback(
    container: HTMLElement,
    data: QuizData,
    callbacks: QuizPlaybackCallbacks,
  ): void {
    renderQuizPlayback(container, data, callbacks);
  },

  unmountPlayback(container: HTMLElement): void {
    unmountQuizPlayback(container);
  },

  unmount(container: HTMLElement): void {
    container.innerHTML = "";
  },
};
