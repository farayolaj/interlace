import { ContentType } from "@interlacejs/core";
import { renderQuizPlayback, unmountQuizPlayback } from "./quiz-player";
import { COLORS, FONTS, RADIUS, SHADOWS, SPACE, TYPE } from "./tokens";
import type {
  QuizData,
  QuizMediaRef,
  QuizOption,
  QuizQuestionSpec,
} from "./schema";

interface QuizEditorController {
  syncTo(data: QuizData, onChange: (next: QuizData) => void): void;
}

/**
 * Controllers are stashed per container so the slot can hand the same
 * controller back across the mount/update lifecycle. The slot always passes
 * the same container element to `renderEditor`/`updateEditor`/`unmount`.
 */
const quizEditorControllers = new WeakMap<HTMLElement, QuizEditorController>();

/** Builds a media ref from src/alt text; `undefined` when src is blank. */
function buildMediaRef(src: string, alt: string): QuizMediaRef | undefined {
  if (src.length === 0) return undefined;
  return alt.length > 0 ? { src, alt } : { src };
}

/** Creates a preview `<img>` for a media ref, or `null` when src is blank. */
function createPreview(
  media: QuizMediaRef | undefined,
  className: string,
): HTMLImageElement | null {
  if (!media || media.src.length === 0) return null;
  const img = document.createElement("img");
  img.className = className;
  img.src = media.src;
  img.style.maxWidth = "100%";
  img.style.height = "auto";
  img.style.borderRadius = `${RADIUS.sm}px`;
  img.style.marginTop = `${SPACE[1]}px`;
  if (media.alt) img.alt = media.alt;
  return img;
}

/** Renders `media` into `slot`, replacing any previous preview. */
function syncPreview(
  slot: HTMLElement,
  media: QuizMediaRef | undefined,
  className: string,
): void {
  slot.innerHTML = "";
  const img = createPreview(media, className);
  if (img) slot.appendChild(img);
}

/** Generates an option id that does not collide with existing ids. */
function nextOptionId(options: QuizOption[], index: number): string {
  const base = `opt-${index}`;
  if (!options.some((option) => option.id === base)) return base;
  let candidate = index + 1;
  while (options.some((option) => option.id === `opt-${candidate}`)) {
    candidate += 1;
  }
  return `opt-${candidate}`;
}

/** Generates a question id that does not collide with existing ids. */
function nextQuestionId(questions: QuizQuestionSpec[], index: number): string {
  const base = `q-${index}`;
  if (!questions.some((question) => question.id === base)) return base;
  let candidate = index + 1;
  while (questions.some((question) => question.id === `q-${candidate}`)) {
    candidate += 1;
  }
  return `q-${candidate}`;
}

/** An empty question stub so the form is never without a question. */
function emptyQuestion(id: string): QuizQuestionSpec {
  return { id, text: "", options: [], correctOptionId: null };
}

interface OptionRow {
  row: HTMLDivElement;
  textInput: HTMLInputElement;
  mediaSrcInput: HTMLInputElement;
  mediaAltInput: HTMLInputElement;
  previewSlot: HTMLDivElement;
}

/**
 * Builds the quiz authoring form once and returns a controller whose
 * `syncTo` patches inputs in place (preserving focus) instead of rebuilding
 * the DOM on every keystroke. The form has a question list (add/remove,
 * selectable tabs); the ACTIVE question's text/media/options/correct select
 * are edited below it. Switching the selected question rebuilds that
 * question's editor rows (an explicit action); within the active question,
 * edits patch in place. All edits emit canonical multi-question
 * {@link QuizData}.
 */
function createQuizEditorController(
  container: HTMLElement,
  data: QuizData,
  onChange: (next: QuizData) => void,
): QuizEditorController {
  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "quiz-editor";
  root.style.fontFamily = FONTS.body;
  root.style.color = COLORS.text;
  root.style.lineHeight = "1.5";

  let currentData: QuizData = data;
  let currentOnChange = onChange;
  let selectedIndex = 0;
  let bodyQuestionIndex = -1;
  let optionRows: OptionRow[] = [];

  const emit = (questions: QuizQuestionSpec[]): void => {
    currentOnChange({ questions });
  };

  /** Applies `mutate` to the active question and emits the canonical list. */
  const patchActiveQuestion = (
    mutate: (question: QuizQuestionSpec) => QuizQuestionSpec,
  ): void => {
    const active = currentData.questions[selectedIndex];
    if (!active) return;
    const questions = currentData.questions.slice();
    questions[selectedIndex] = mutate(active);
    emit(questions);
  };

  // --- Questions toolbar ---
  const questionsHeader = document.createElement("div");
  questionsHeader.textContent = "Questions";
  questionsHeader.style.marginBottom = `${SPACE[2]}px`;
  questionsHeader.style.fontWeight = "600";
  questionsHeader.style.fontSize = `${TYPE.sm}px`;
  questionsHeader.style.color = COLORS.textMuted;
  root.appendChild(questionsHeader);

  const tabsBar = document.createElement("div");
  tabsBar.className = "quiz-question-tabs";
  tabsBar.style.display = "flex";
  tabsBar.style.flexWrap = "wrap";
  tabsBar.style.gap = `${SPACE[2]}px`;
  tabsBar.style.marginBottom = `${SPACE[3]}px`;
  root.appendChild(tabsBar);

  const addQuestionButton = document.createElement("button");
  addQuestionButton.type = "button";
  addQuestionButton.className = "quiz-add-question";
  addQuestionButton.textContent = "Add question";
  addQuestionButton.style.marginBottom = `${SPACE[4]}px`;
  addQuestionButton.style.padding = `${SPACE[2]}px ${SPACE[4]}px`;
  addQuestionButton.style.backgroundColor = COLORS.surface;
  addQuestionButton.style.border = `1px solid ${COLORS.borderStrong}`;
  addQuestionButton.style.borderRadius = `${RADIUS.sm}px`;
  addQuestionButton.style.cursor = "pointer";
  addQuestionButton.style.fontSize = `${TYPE.sm}px`;
  addQuestionButton.style.fontWeight = "600";
  addQuestionButton.style.color = COLORS.text;
  addQuestionButton.addEventListener("click", () => {
    const id = nextQuestionId(currentData.questions, currentData.questions.length);
    const questions = [...currentData.questions, emptyQuestion(id)];
    currentData = { questions };
    selectedIndex = questions.length - 1;
    emit(questions);
    bodyQuestionIndex = -1;
    renderTabs();
    syncActiveBody();
  });
  root.appendChild(addQuestionButton);

  // --- Active question editor body ---
  const body = document.createElement("div");
  body.className = "quiz-editor-body";
  root.appendChild(body);

  const questionInput = document.createElement("input");
  questionInput.type = "text";
  questionInput.className = "quiz-question";
  questionInput.style.display = "block";
  questionInput.style.width = "100%";
  questionInput.style.boxSizing = "border-box";
  questionInput.style.padding = `${SPACE[2]}px ${SPACE[3]}px`;
  questionInput.style.fontSize = `${TYPE.md}px`;
  questionInput.style.color = COLORS.text;
  questionInput.style.border = `1px solid ${COLORS.borderStrong}`;
  questionInput.style.borderRadius = `${RADIUS.sm}px`;
  questionInput.style.backgroundColor = COLORS.surface;
  questionInput.addEventListener("input", () => {
    patchActiveQuestion((question) => ({
      ...question,
      text: questionInput.value,
    }));
  });
  const questionLabel = document.createElement("label");
  questionLabel.style.display = "block";
  questionLabel.style.marginBottom = `${SPACE[3]}px`;
  questionLabel.style.fontWeight = "600";
  questionLabel.style.fontSize = `${TYPE.sm}px`;
  questionLabel.style.color = COLORS.textMuted;
  questionLabel.appendChild(document.createTextNode("Question"));
  questionLabel.appendChild(questionInput);
  body.appendChild(questionLabel);

  // Active question media sub-block: src + alt inputs and a live preview.
  const questionMediaBox = document.createElement("div");
  questionMediaBox.className = "quiz-question-media";
  questionMediaBox.style.padding = `${SPACE[3]}px`;
  questionMediaBox.style.marginBottom = `${SPACE[4]}px`;
  questionMediaBox.style.backgroundColor = COLORS.surfaceRaised;
  questionMediaBox.style.border = `1px solid ${COLORS.border}`;
  questionMediaBox.style.borderRadius = `${RADIUS.md}px`;

  const questionMediaSrc = document.createElement("input");
  questionMediaSrc.type = "text";
  questionMediaSrc.className = "quiz-question-media-src";
  questionMediaSrc.placeholder = "Question media URL";
  questionMediaSrc.style.display = "block";
  questionMediaSrc.style.width = "100%";
  questionMediaSrc.style.boxSizing = "border-box";
  questionMediaSrc.style.padding = `${SPACE[2]}px ${SPACE[3]}px`;
  questionMediaSrc.style.marginBottom = `${SPACE[2]}px`;
  questionMediaSrc.style.fontSize = `${TYPE.base}px`;
  questionMediaSrc.style.color = COLORS.text;
  questionMediaSrc.style.border = `1px solid ${COLORS.borderStrong}`;
  questionMediaSrc.style.borderRadius = `${RADIUS.sm}px`;
  questionMediaSrc.style.backgroundColor = COLORS.surface;

  const questionMediaAlt = document.createElement("input");
  questionMediaAlt.type = "text";
  questionMediaAlt.className = "quiz-question-media-alt";
  questionMediaAlt.placeholder = "Media alt text";
  questionMediaAlt.style.display = "block";
  questionMediaAlt.style.width = "100%";
  questionMediaAlt.style.boxSizing = "border-box";
  questionMediaAlt.style.padding = `${SPACE[2]}px ${SPACE[3]}px`;
  questionMediaAlt.style.fontSize = `${TYPE.base}px`;
  questionMediaAlt.style.color = COLORS.text;
  questionMediaAlt.style.border = `1px solid ${COLORS.borderStrong}`;
  questionMediaAlt.style.borderRadius = `${RADIUS.sm}px`;
  questionMediaAlt.style.backgroundColor = COLORS.surface;
  const questionPreviewSlot = document.createElement("div");
  questionPreviewSlot.className = "quiz-question-media-preview-slot";
  const emitQuestionMedia = () => {
    const media = buildMediaRef(questionMediaSrc.value, questionMediaAlt.value);
    syncPreview(questionPreviewSlot, media, "quiz-question-media-preview");
    patchActiveQuestion((question) => ({ ...question, media }));
  };
  questionMediaSrc.addEventListener("input", emitQuestionMedia);
  questionMediaAlt.addEventListener("input", emitQuestionMedia);
  questionMediaBox.append(questionMediaSrc, questionMediaAlt, questionPreviewSlot);
  body.appendChild(questionMediaBox);

  const optionsTitle = document.createElement("div");
  optionsTitle.textContent = "Options";
  optionsTitle.style.marginBottom = `${SPACE[2]}px`;
  optionsTitle.style.fontWeight = "600";
  optionsTitle.style.fontSize = `${TYPE.sm}px`;
  optionsTitle.style.color = COLORS.textMuted;
  body.appendChild(optionsTitle);
  const optionsContainer = document.createElement("div");
  optionsContainer.style.display = "flex";
  optionsContainer.style.flexDirection = "column";
  optionsContainer.style.gap = `${SPACE[2]}px`;
  body.appendChild(optionsContainer);

  const addOptionButton = document.createElement("button");
  addOptionButton.type = "button";
  addOptionButton.className = "quiz-add-option";
  addOptionButton.textContent = "Add option";
  addOptionButton.style.marginTop = `${SPACE[2]}px`;
  addOptionButton.style.padding = `${SPACE[2]}px ${SPACE[4]}px`;
  addOptionButton.style.backgroundColor = COLORS.surface;
  addOptionButton.style.border = `1px solid ${COLORS.borderStrong}`;
  addOptionButton.style.borderRadius = `${RADIUS.sm}px`;
  addOptionButton.style.cursor = "pointer";
  addOptionButton.style.fontSize = `${TYPE.sm}px`;
  addOptionButton.style.fontWeight = "600";
  addOptionButton.style.color = COLORS.text;
  addOptionButton.addEventListener("click", () => {
    patchActiveQuestion((question) => {
      const nextOptions: QuizOption[] = [
        ...question.options,
        {
          id: nextOptionId(question.options, question.options.length),
          text: "",
        },
      ];
      // Adding the first option defaults it to correct (ported behavior).
      const nextCorrectOptionId =
        question.options.length === 0
          ? nextOptions[0]!.id
          : question.correctOptionId;
      return {
        ...question,
        options: nextOptions,
        correctOptionId: nextCorrectOptionId,
      };
    });
  });
  body.appendChild(addOptionButton);

  const correctLabel = document.createElement("label");
  correctLabel.style.display = "block";
  correctLabel.style.marginTop = `${SPACE[4]}px`;
  correctLabel.style.fontWeight = "600";
  correctLabel.style.fontSize = `${TYPE.sm}px`;
  correctLabel.style.color = COLORS.textMuted;
  correctLabel.appendChild(document.createTextNode("Correct answer"));
  const select = document.createElement("select");
  select.className = "quiz-correct-answer";
  select.style.display = "block";
  select.style.width = "100%";
  select.style.marginTop = `${SPACE[1]}px`;
  select.style.padding = `${SPACE[2]}px ${SPACE[3]}px`;
  select.style.fontSize = `${TYPE.base}px`;
  select.style.color = COLORS.text;
  select.style.border = `1px solid ${COLORS.borderStrong}`;
  select.style.borderRadius = `${RADIUS.sm}px`;
  select.style.backgroundColor = COLORS.surface;
  select.addEventListener("change", () => {
    patchActiveQuestion((question) => ({
      ...question,
      correctOptionId: select.value.length > 0 ? select.value : null,
    }));
  });
  correctLabel.appendChild(select);
  body.appendChild(correctLabel);

  container.appendChild(root);

  const createOptionRow = (option: QuizOption, optionIndex: number): OptionRow => {
    const row = document.createElement("div");
    row.className = "quiz-option-row";
    row.style.display = "flex";
    row.style.flexWrap = "wrap";
    row.style.gap = `${SPACE[2]}px`;
    row.style.alignItems = "center";
    row.style.padding = `${SPACE[2]}px`;
    row.style.backgroundColor = COLORS.surfaceRaised;
    row.style.border = `1px solid ${COLORS.border}`;
    row.style.borderRadius = `${RADIUS.md}px`;

    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.className = "quiz-option-text";
    textInput.style.flex = "1";
    textInput.style.minWidth = "120px";
    textInput.style.padding = `${SPACE[2]}px ${SPACE[3]}px`;
    textInput.style.fontSize = `${TYPE.base}px`;
    textInput.style.color = COLORS.text;
    textInput.style.border = `1px solid ${COLORS.borderStrong}`;
    textInput.style.borderRadius = `${RADIUS.sm}px`;
    textInput.style.backgroundColor = COLORS.surface;
    textInput.value = option.text;
    textInput.addEventListener("input", () => {
      patchActiveQuestion((question) => {
        const nextOptions = question.options.slice();
        nextOptions[optionIndex] = {
          ...nextOptions[optionIndex]!,
          text: textInput.value,
        };
        return { ...question, options: nextOptions };
      });
    });

    const mediaSrcInput = document.createElement("input");
    mediaSrcInput.type = "text";
    mediaSrcInput.className = "quiz-option-media-src";
    mediaSrcInput.placeholder = "Option media URL";
    mediaSrcInput.value = option.media?.src ?? "";
    mediaSrcInput.style.flex = "1";
    mediaSrcInput.style.minWidth = "120px";
    mediaSrcInput.style.padding = `${SPACE[2]}px ${SPACE[3]}px`;
    mediaSrcInput.style.fontSize = `${TYPE.base}px`;
    mediaSrcInput.style.color = COLORS.text;
    mediaSrcInput.style.border = `1px solid ${COLORS.borderStrong}`;
    mediaSrcInput.style.borderRadius = `${RADIUS.sm}px`;
    mediaSrcInput.style.backgroundColor = COLORS.surface;

    const mediaAltInput = document.createElement("input");
    mediaAltInput.type = "text";
    mediaAltInput.className = "quiz-option-media-alt";
    mediaAltInput.placeholder = "Option media alt";
    mediaAltInput.value = option.media?.alt ?? "";
    mediaAltInput.style.flex = "1";
    mediaAltInput.style.minWidth = "120px";
    mediaAltInput.style.padding = `${SPACE[2]}px ${SPACE[3]}px`;
    mediaAltInput.style.fontSize = `${TYPE.base}px`;
    mediaAltInput.style.color = COLORS.text;
    mediaAltInput.style.border = `1px solid ${COLORS.borderStrong}`;
    mediaAltInput.style.borderRadius = `${RADIUS.sm}px`;
    mediaAltInput.style.backgroundColor = COLORS.surface;

    const previewSlot = document.createElement("div");
    previewSlot.className = "quiz-option-media-preview";
    syncPreview(previewSlot, option.media, "quiz-option-thumb");

    const emitOptionMedia = () => {
      const media = buildMediaRef(mediaSrcInput.value, mediaAltInput.value);
      syncPreview(previewSlot, media, "quiz-option-thumb");
      patchActiveQuestion((question) => {
        const nextOptions = question.options.slice();
        nextOptions[optionIndex] = { ...nextOptions[optionIndex]!, media };
        return { ...question, options: nextOptions };
      });
    };
    mediaSrcInput.addEventListener("input", emitOptionMedia);
    mediaAltInput.addEventListener("input", emitOptionMedia);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quiz-option-remove";
    remove.textContent = "Remove";
    remove.style.padding = `${SPACE[1]}px ${SPACE[3]}px`;
    remove.style.backgroundColor = COLORS.errorBg;
    remove.style.border = `1px solid ${COLORS.errorBorder}`;
    remove.style.borderRadius = `${RADIUS.sm}px`;
    remove.style.cursor = "pointer";
    remove.style.fontSize = `${TYPE.sm}px`;
    remove.style.fontWeight = "600";
    remove.style.color = COLORS.errorText;
    remove.addEventListener("click", () => {
      patchActiveQuestion((question) => {
        const removed = question.options[optionIndex];
        const nextOptions = question.options.filter((_, i) => i !== optionIndex);
        return {
          ...question,
          options: nextOptions,
          // Removing the correct option clears correctness; do not shift it.
          correctOptionId:
            removed && removed.id === question.correctOptionId
              ? null
              : question.correctOptionId,
        };
      });
    });

    row.append(textInput, mediaSrcInput, mediaAltInput, previewSlot, remove);
    optionsContainer.appendChild(row);
    return { row, textInput, mediaSrcInput, mediaAltInput, previewSlot };
  };

  const selectQuestion = (index: number): void => {
    selectedIndex = index;
    bodyQuestionIndex = -1;
    renderTabs();
    syncActiveBody();
  };

  const removeQuestion = (index: number): void => {
    const next = currentData.questions.filter((_, i) => i !== index);
    const questions =
      next.length > 0 ? next : [emptyQuestion(nextQuestionId([], 0))];
    if (selectedIndex === index) {
      selectedIndex = 0; // removing the selected question selects the first remaining
    } else if (index < selectedIndex) {
      selectedIndex -= 1;
    }
    currentData = { questions };
    emit(questions);
    bodyQuestionIndex = -1;
    renderTabs();
    syncActiveBody();
  };

  const renderTabs = (): void => {
    tabsBar.innerHTML = "";
    currentData.questions.forEach((question, index) => {
      const wrap = document.createElement("div");
      wrap.className = "quiz-question-tab-wrap";
      wrap.style.display = "inline-flex";
      wrap.style.alignItems = "center";
      wrap.style.gap = `${SPACE[1]}px`;

      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "quiz-question-tab";
      tab.textContent = `Question ${index + 1}`;
      tab.style.padding = `${SPACE[1]}px ${SPACE[3]}px`;
      tab.style.borderRadius = `${RADIUS.sm}px`;
      tab.style.border = `1px solid ${COLORS.borderStrong}`;
      tab.style.cursor = "pointer";
      tab.style.fontSize = `${TYPE.sm}px`;
      tab.style.fontWeight = "600";
      if (index === selectedIndex) {
        tab.style.backgroundColor = COLORS.accent;
        tab.style.borderColor = COLORS.accent;
        tab.style.color = COLORS.white;
      } else {
        tab.style.backgroundColor = COLORS.surface;
        tab.style.color = COLORS.text;
      }
      tab.addEventListener("click", () => selectQuestion(index));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "quiz-question-remove";
      remove.textContent = "Remove";
      remove.style.padding = `${SPACE[1]}px ${SPACE[2]}px`;
      remove.style.borderRadius = `${RADIUS.sm}px`;
      remove.style.border = `1px solid ${COLORS.errorBorder}`;
      remove.style.backgroundColor = COLORS.errorBg;
      remove.style.color = COLORS.errorText;
      remove.style.cursor = "pointer";
      remove.style.fontSize = `${TYPE.xs}px`;
      remove.style.fontWeight = "600";
      remove.addEventListener("click", () => removeQuestion(index));

      wrap.append(tab, remove);
      tabsBar.appendChild(wrap);
    });
  };

  const syncActiveBody = (): void => {
    const active = currentData.questions[selectedIndex];
    if (!active) return;

    questionInput.value = active.text;
    questionMediaSrc.value = active.media?.src ?? "";
    questionMediaAlt.value = active.media?.alt ?? "";
    syncPreview(questionPreviewSlot, active.media, "quiz-question-media-preview");

    const options = active.options;
    if (bodyQuestionIndex !== selectedIndex || optionRows.length !== options.length) {
      // Question switch or option count change: rebuild the active question's rows.
      optionsContainer.innerHTML = "";
      optionRows = options.map((option, optionIndex) =>
        createOptionRow(option, optionIndex),
      );
      bodyQuestionIndex = selectedIndex;
    } else {
      // Count unchanged: patch values in place, preserving input focus.
      optionRows.forEach((row, optionIndex) => {
        const option = options[optionIndex]!;
        row.textInput.value = option.text;
        row.mediaSrcInput.value = option.media?.src ?? "";
        row.mediaAltInput.value = option.media?.alt ?? "";
        syncPreview(row.previewSlot, option.media, "quiz-option-thumb");
      });
    }

    // Patch the select in place, keyed by option id.
    while (select.options.length < options.length) {
      select.add(document.createElement("option"));
    }
    while (select.options.length > options.length) {
      select.remove(select.options.length - 1);
    }
    for (let i = 0; i < options.length; i++) {
      const el = select.options[i];
      if (!el) continue;
      const option = options[i]!;
      el.value = option.id;
      el.textContent = `Option ${i + 1}: ${option.text}`;
      el.selected = option.id === active.correctOptionId;
    }
  };

  const syncTo = (
    nextData: QuizData,
    nextOnChange: (next: QuizData) => void,
  ): void => {
    currentData = nextData;
    currentOnChange = nextOnChange;
    if (currentData.questions.length === 0) {
      currentData = { questions: [emptyQuestion("q-0")] };
    }
    if (selectedIndex >= currentData.questions.length) {
      selectedIndex = 0;
    }
    renderTabs();
    syncActiveBody();
  };

  renderTabs();
  syncActiveBody();

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

/** Tears down the editor controller mounted in `container`, if any. */
export function unmountQuizEditor(container: HTMLElement): void {
  quizEditorControllers.delete(container);
  container.innerHTML = "";
}

/**
 * Built-in Quiz editor content type. Authors the canonical multi-question
 * {@link QuizData} shape with rich media (the single supported format).
 * Registered id is `quiz-editor`, matching the player's built-in quiz
 * content type.
 */
export const QuizEditorType: ContentType<QuizData> = {
  getId: () => "quiz-editor",
  getVersion: () => 1,

  getMaximumScore(data): number | undefined {
    return data.questions.length;
  },

  async preload(): Promise<void> {
    // No preload needed for quiz content.
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

  unmountPlayback(container: HTMLElement): void {
    unmountQuizPlayback(container);
  },

  unmount(container: HTMLElement): void {
    unmountQuizEditor(container);
  },
};