import { ContentType } from "@interlace/core";
import { normalizeQuizData } from "./validate";
import { renderQuizPlayback, unmountQuizPlayback } from "./quiz-player";
import { COLORS, FONTS, RADIUS, SHADOWS, SPACE, TYPE } from "./tokens";
import type {
  QuizData,
  QuizMediaRef,
  QuizOption,
  RawQuizData,
} from "./schema";

interface QuizEditorController {
  syncTo(rawData: RawQuizData, onChange: (next: QuizData) => void): void;
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

/**
 * Builds the quiz authoring form once and returns a controller whose
 * `syncTo` patches existing inputs in place (preserving focus) instead of
 * rebuilding the DOM on every keystroke. All edits emit canonical
 * {@link QuizData}; the incoming document may be legacy and is normalized on
 * each sync.
 */
function createQuizEditorController(
  container: HTMLElement,
  rawData: RawQuizData,
  onChange: (next: QuizData) => void,
): QuizEditorController {
  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "quiz-editor";
  root.style.fontFamily = FONTS.body;
  root.style.color = COLORS.text;
  root.style.lineHeight = "1.5";

  let currentData: QuizData = normalizeQuizData(rawData);
  let currentOnChange = onChange;

  const questionInput = document.createElement("input");
  questionInput.type = "text";
  questionInput.className = "quiz-question";
  questionInput.style.display = "block";
  questionInput.style.width = "100%";
  questionInput.style.padding = `${SPACE[2]}px ${SPACE[3]}px`;
  questionInput.style.fontSize = `${TYPE.md}px`;
  questionInput.style.color = COLORS.text;
  questionInput.style.border = `1px solid ${COLORS.borderStrong}`;
  questionInput.style.borderRadius = `${RADIUS.sm}px`;
  questionInput.style.backgroundColor = COLORS.surface;
  questionInput.addEventListener("input", () => {
    currentOnChange({
      ...currentData,
      question: { ...currentData.question, text: questionInput.value },
    });
  });
  const questionLabel = document.createElement("label");
  questionLabel.style.display = "block";
  questionLabel.style.marginBottom = `${SPACE[3]}px`;
  questionLabel.style.fontWeight = "600";
  questionLabel.style.fontSize = `${TYPE.sm}px`;
  questionLabel.style.color = COLORS.textMuted;
  questionLabel.appendChild(document.createTextNode("Question"));
  questionLabel.appendChild(questionInput);
  root.appendChild(questionLabel);

  // Question media sub-block: src + alt inputs and a live preview.
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
    currentOnChange({
      ...currentData,
      question: { ...currentData.question, media },
    });
  };
  questionMediaSrc.addEventListener("input", emitQuestionMedia);
  questionMediaAlt.addEventListener("input", emitQuestionMedia);
  questionMediaBox.append(questionMediaSrc, questionMediaAlt, questionPreviewSlot);
  root.appendChild(questionMediaBox);

  const optionsTitle = document.createElement("div");
  optionsTitle.textContent = "Options";
  optionsTitle.style.marginBottom = `${SPACE[2]}px`;
  optionsTitle.style.fontWeight = "600";
  optionsTitle.style.fontSize = `${TYPE.sm}px`;
  optionsTitle.style.color = COLORS.textMuted;
  root.appendChild(optionsTitle);
  const optionsContainer = document.createElement("div");
  optionsContainer.style.display = "flex";
  optionsContainer.style.flexDirection = "column";
  optionsContainer.style.gap = `${SPACE[2]}px`;
  root.appendChild(optionsContainer);

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
    const nextOptions: QuizOption[] = [
      ...currentData.options,
      {
        id: nextOptionId(currentData.options, currentData.options.length),
        text: "",
      },
    ];
    // Adding the first option defaults it to correct (ported behavior).
    const nextCorrectOptionId =
      currentData.options.length === 0
        ? nextOptions[0]!.id
        : currentData.correctOptionId;
    currentOnChange({
      ...currentData,
      options: nextOptions,
      correctOptionId: nextCorrectOptionId,
    });
  });
  root.appendChild(addOptionButton);

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
    currentOnChange({
      ...currentData,
      correctOptionId: select.value.length > 0 ? select.value : null,
    });
  });
  correctLabel.appendChild(select);
  root.appendChild(correctLabel);

  container.appendChild(root);

  interface OptionRow {
    row: HTMLDivElement;
    textInput: HTMLInputElement;
    mediaSrcInput: HTMLInputElement;
    mediaAltInput: HTMLInputElement;
    previewSlot: HTMLDivElement;
  }

  let optionRows: OptionRow[] = [];

  const createOptionRow = (option: QuizOption, index: number): OptionRow => {
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
      const nextOptions = currentData.options.slice();
      nextOptions[index] = { ...nextOptions[index]!, text: textInput.value };
      currentOnChange({ ...currentData, options: nextOptions });
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
    const emitOptionMedia = () => {
      const media = buildMediaRef(mediaSrcInput.value, mediaAltInput.value);
      syncPreview(previewSlot, media, "quiz-option-thumb");
      const nextOptions = currentData.options.slice();
      nextOptions[index] = { ...nextOptions[index]!, media };
      currentOnChange({ ...currentData, options: nextOptions });
    };
    mediaSrcInput.addEventListener("input", emitOptionMedia);
    mediaAltInput.addEventListener("input", emitOptionMedia);

    const previewSlot = document.createElement("div");
    previewSlot.className = "quiz-option-media-preview";
    syncPreview(previewSlot, option.media, "quiz-option-thumb");

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
      const removed = currentData.options[index];
      const nextOptions = currentData.options.filter((_, i) => i !== index);
      currentOnChange({
        ...currentData,
        options: nextOptions,
        // Removing the correct option clears correctness; do not shift it.
        correctOptionId:
          removed && removed.id === currentData.correctOptionId
            ? null
            : currentData.correctOptionId,
      });
    });

    row.append(textInput, mediaSrcInput, mediaAltInput, previewSlot, remove);
    optionsContainer.appendChild(row);
    return { row, textInput, mediaSrcInput, mediaAltInput, previewSlot };
  };

  const syncTo = (
    nextRawData: RawQuizData,
    nextOnChange: (next: QuizData) => void,
  ): void => {
    currentData = normalizeQuizData(nextRawData);
    currentOnChange = nextOnChange;
    const data = currentData;
    const options = data.options;

    questionInput.value = data.question.text;
    questionMediaSrc.value = data.question.media?.src ?? "";
    questionMediaAlt.value = data.question.media?.alt ?? "";
    syncPreview(
      questionPreviewSlot,
      data.question.media,
      "quiz-question-media-preview",
    );

    if (optionRows.length !== options.length) {
      // Option count changed: rebuild rows (an explicit add/remove action).
      optionsContainer.innerHTML = "";
      optionRows = options.map((option, index) =>
        createOptionRow(option, index),
      );
    } else {
      // Count unchanged: patch values in place, preserving input focus.
      optionRows.forEach((row, index) => {
        const option = options[index]!;
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
      el.selected = option.id === data.correctOptionId;
    }
  };

  return { syncTo };
}

function getOrCreateQuizEditorController(
  container: HTMLElement,
  rawData: RawQuizData,
  onChange: (next: QuizData) => void,
): QuizEditorController {
  let controller = quizEditorControllers.get(container);
  if (!controller) {
    controller = createQuizEditorController(container, rawData, onChange);
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
 * Built-in Quiz editor content type. Authors the canonical {@link QuizData}
 * shape with rich media; legacy documents are normalized on mount so they
 * edit seamlessly. Registered id is `quiz-editor`, matching the player's
 * built-in quiz content type.
 */
export const QuizEditorType: ContentType<QuizData> = {
  getId: () => "quiz-editor",
  getVersion: () => 1,

  getMaximumScore(): number | undefined {
    return 100;
  },

  async preload(): Promise<void> {
    // No preload needed for quiz content.
  },

  renderEditor(
    container: HTMLElement,
    data: QuizData,
    onChange: (newData: QuizData) => void,
  ): void {
    const raw = data;
    getOrCreateQuizEditorController(container, raw, onChange).syncTo(
      raw,
      onChange,
    );
  },

  updateEditor(
    container: HTMLElement,
    data: QuizData,
    onChange: (newData: QuizData) => void,
  ): void {
    const raw = data;
    getOrCreateQuizEditorController(container, raw, onChange).syncTo(
      raw,
      onChange,
    );
  },

  renderPlayback(
    container: HTMLElement,
    data: QuizData,
    callbacks: { onComplete(score?: number): void },
  ): void {
    renderQuizPlayback(container, data as unknown as RawQuizData, callbacks);
  },

  unmountPlayback(container: HTMLElement): void {
    unmountQuizPlayback(container);
  },

  unmount(container: HTMLElement): void {
    unmountQuizEditor(container);
  },
};
