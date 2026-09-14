import { ContentType } from "@interlace/core";
import { renderQuizPlayback } from "@interlace/player";

/**
 * Data shape for quiz content authored through the editor.
 */
export interface QuizData {
  question: string;
  options: string[];
  correctIndex?: number;
}

/**
 * Normalizes the correct-index selection to a valid option position.
 * Undefined or out-of-range indices fall back to 0.
 */
function clampCorrectIndex(
  correctIndex: number | undefined,
  count: number,
): number {
  if (count === 0) return 0;
  if (correctIndex === undefined || correctIndex < 0 || correctIndex >= count) {
    return 0;
  }
  return correctIndex;
}

/**
 * Computes the correct index after an option is removed so the emitted data
 * never points at a missing or shifted option.
 * - Removed index < correctIndex: the correct option shifts down by one.
 * - Otherwise: clamp to the new valid range (or undefined when empty).
 */
function adjustCorrectIndexOnRemove(
  correctIndex: number | undefined,
  removedIndex: number,
  newCount: number,
): number | undefined {
  if (correctIndex === undefined) return undefined;
  if (newCount === 0) return undefined;
  if (removedIndex < correctIndex) return correctIndex - 1;
  return Math.min(correctIndex, newCount - 1);
}

interface QuizEditorController {
  syncTo(data: QuizData, onChange: (next: QuizData) => void): void;
}

/**
 * Controllers are stashed per container so the slot can hand the same
 * controller back across the mount/update lifecycle. The slot always passes
 * the same container element to `renderEditor`/`updateEditor`/`unmount`.
 */
const quizEditorControllers = new WeakMap<HTMLElement, QuizEditorController>();

/**
 * Builds the quiz authoring form once and returns a controller whose
 * `syncTo` patches existing inputs in place (preserving focus) instead of
 * rebuilding the DOM on every keystroke.
 */
function createQuizEditorController(
  container: HTMLElement,
  data: QuizData,
  onChange: (next: QuizData) => void,
): QuizEditorController {
  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "quiz-editor";

  let currentData = data;
  let currentOnChange = onChange;

  const questionInput = document.createElement("input");
  questionInput.type = "text";
  questionInput.className = "quiz-question";
  questionInput.style.display = "block";
  questionInput.style.width = "100%";
  questionInput.addEventListener("input", () => {
    currentOnChange({ ...currentData, question: questionInput.value });
  });
  const questionLabel = document.createElement("label");
  questionLabel.style.display = "block";
  questionLabel.style.marginBottom = "8px";
  questionLabel.appendChild(document.createTextNode("Question"));
  questionLabel.appendChild(questionInput);
  root.appendChild(questionLabel);

  const optionsTitle = document.createElement("div");
  optionsTitle.textContent = "Options";
  root.appendChild(optionsTitle);
  const optionsContainer = document.createElement("div");
  root.appendChild(optionsContainer);

  const addOptionButton = document.createElement("button");
  addOptionButton.type = "button";
  addOptionButton.textContent = "Add option";
  addOptionButton.style.marginTop = "4px";
  addOptionButton.addEventListener("click", () => {
    const currentOptions = Array.isArray(currentData.options)
      ? currentData.options
      : [];
    const nextOptions = [...currentOptions, ""];
    const nextCorrectIndex =
      currentOptions.length === 0 ? 0 : currentData.correctIndex;
    currentOnChange({
      ...currentData,
      options: nextOptions,
      correctIndex: nextCorrectIndex,
    });
  });
  root.appendChild(addOptionButton);

  const correctLabel = document.createElement("label");
  correctLabel.style.display = "block";
  correctLabel.style.marginTop = "12px";
  correctLabel.appendChild(document.createTextNode("Correct answer"));
  const select = document.createElement("select");
  select.addEventListener("change", () => {
    currentOnChange({ ...currentData, correctIndex: Number(select.value) });
  });
  correctLabel.appendChild(select);
  root.appendChild(correctLabel);

  container.appendChild(root);

  let optionRows: { row: HTMLDivElement; input: HTMLInputElement }[] = [];

  const createOptionRow = (option: string, index: number) => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "8px";
    row.style.marginBottom = "4px";
    const input = document.createElement("input");
    input.type = "text";
    input.value = option;
    input.style.flex = "1";
    input.addEventListener("input", () => {
      const next = (currentData.options ?? []).slice();
      next[index] = input.value;
      currentOnChange({ ...currentData, options: next });
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      const nextOptions = (currentData.options ?? []).filter(
        (_, i) => i !== index,
      );
      currentOnChange({
        ...currentData,
        options: nextOptions,
        correctIndex: adjustCorrectIndexOnRemove(
          currentData.correctIndex,
          index,
          nextOptions.length,
        ),
      });
    });
    row.append(input, remove);
    optionsContainer.appendChild(row);
    return { row, input };
  };

  const syncTo = (
    nextData: QuizData,
    nextOnChange: (next: QuizData) => void,
  ): void => {
    currentData = nextData;
    currentOnChange = nextOnChange;
    const question = nextData.question ?? "";
    const options = Array.isArray(nextData.options) ? nextData.options : [];
    const correct = clampCorrectIndex(nextData.correctIndex, options.length);

    questionInput.value = question;

    if (optionRows.length !== options.length) {
      // Option count changed: rebuild rows (an explicit add/remove action).
      optionsContainer.innerHTML = "";
      optionRows = options.map((option, index) =>
        createOptionRow(option, index),
      );
    } else {
      // Count unchanged: patch values in place, preserving input focus.
      optionRows.forEach((row, index) => {
        row.input.value = options[index] ?? "";
      });
    }

    // Patch the select in place.
    while (select.options.length < options.length) {
      select.add(document.createElement("option"));
    }
    while (select.options.length > options.length) {
      select.remove(select.options.length - 1);
    }
    for (let i = 0; i < options.length; i++) {
      const el = select.options[i];
      if (el) {
        el.value = String(i);
        el.textContent = options[i]
          ? `Option ${i + 1}: ${options[i]}`
          : `Option ${i + 1}`;
        el.selected = i === correct;
      }
    }
  };

  return { syncTo };
}

function getOrCreateQuizEditorController(
  container: HTMLElement,
  data: QuizData,
  onChange: (next: QuizData) => void,
): QuizEditorController {
  let controller = quizEditorControllers.get(container);
  if (!controller) {
    controller = createQuizEditorController(container, data, onChange);
    quizEditorControllers.set(container, controller);
  }
  return controller;
}

/**
 * Built-in Quiz editor for creating/editing quiz content.
 */
export const QuizEditor: ContentType<QuizData> = {
  getId: () => "quiz-editor",
  getVersion: () => 1,

  getMaximumScore(): number | undefined {
    return 100;
  },

  async preload(): Promise<void> {
    // No preload needed
  },

  renderEditor(
    container: HTMLElement,
    data: QuizData,
    onChange: (newData: QuizData) => void,
  ): void {
    getOrCreateQuizEditorController(container, data, onChange).syncTo(
      data,
      onChange,
    );
  },

  updateEditor(
    container: HTMLElement,
    data: QuizData,
    onChange: (newData: QuizData) => void,
  ): void {
    getOrCreateQuizEditorController(container, data, onChange).syncTo(
      data,
      onChange,
    );
  },

  renderPlayback(
    container: HTMLElement,
    data: QuizData,
    callbacks: { onComplete(score?: number): void },
  ): void {
    renderQuizPlayback(container, data, callbacks);
  },

  unmount(container: HTMLElement): void {
    quizEditorControllers.delete(container);
    container.innerHTML = "";
  },
};