import { ContentType, ensureInterlaceStyles } from "@interlacejs/core";
import { renderQuizPlayback, unmountQuizPlayback } from "./quiz-player";
import { COLORS, FONTS, RADIUS, SPACE, TYPE } from "./tokens";
import type {
  QuizData,
  QuizMediaRef,
  QuizOption,
  QuizQuestionSpec,
} from "./schema";
import { getQuizAuthoringIssues } from "./validate";

interface QuizEditorController {
  syncTo(data: QuizData, onChange: (next: QuizData) => void): void;
}

/**
 * Controllers are stashed per container so the slot can hand the same
 * controller back across the mount/update lifecycle. The slot always passes
 * the same container element to `renderEditor`/`updateEditor`/`unmount`.
 */
const quizEditorControllers = new WeakMap<HTMLElement, QuizEditorController>();

/** Gives each mounted editor unique element ids and radio group names. */
let editorInstanceCount = 0;

/** Fewest answers a question may be reduced to via the remove buttons. */
const MIN_ANSWERS = 2;

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
  img.style.maxHeight = "160px";
  img.style.height = "auto";
  img.style.borderRadius = `${RADIUS.sm}`;
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
/** A new question starts with the minimum of two answers, the first correct. */
function emptyQuestion(id: string): QuizQuestionSpec {
  return {
    id,
    text: "",
    options: [
      { id: `${id}-a`, text: "" },
      { id: `${id}-b`, text: "" },
    ],
    correctOptionId: `${id}-a`,
  };
}

/**
 * Shows or hides an element. Uses inline `display` rather than `hidden`
 * because the shared `interlace-*` rules set `display` and would override
 * the user-agent `[hidden]` rule.
 */
function setShown(el: HTMLElement, shown: boolean, display = ""): void {
  el.style.display = shown ? display : "none";
}

/** Sets an input's value only when it differs, so the caret is not moved. */
function setValue(input: HTMLInputElement, value: string): void {
  if (input.value !== value) input.value = value;
}

function createButton(
  text: string,
  variant: "primary" | "secondary" | "ghost",
  className: string,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `interlace-btn interlace-btn--${variant} ${className}`;
  button.textContent = text;
  return button;
}

/** A quiet "×" icon button for per-row remove actions. */
function createRemoveButton(className: string): HTMLButtonElement {
  const button = createButton("×", "ghost", `interlace-btn--icon ${className}`);
  button.style.fontSize = `${TYPE.lg}px`;
  button.style.lineHeight = "1";
  return button;
}

/** Enables a remove button, or disables it with `reason` as its tooltip. */
function setRemoveAllowed(
  button: HTMLButtonElement,
  allowed: boolean,
  reason: string,
): void {
  button.disabled = !allowed;
  if (allowed) button.removeAttribute("title");
  else button.title = reason;
}

function createInput(
  className: string,
  id: string,
  placeholder?: string,
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.id = id;
  input.className = `interlace-input ${className}`;
  input.style.width = "100%";
  input.style.boxSizing = "border-box";
  if (placeholder) input.placeholder = placeholder;
  return input;
}

function createLabel(text: string, forId: string): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "interlace-label";
  label.htmlFor = forId;
  label.textContent = text;
  label.style.fontSize = `${TYPE.sm}px`;
  label.style.fontWeight = "600";
  return label;
}

/** A labelled field (label above input) wrapped in `interlace-field`. */
function createField(
  labelText: string,
  input: HTMLInputElement,
): HTMLDivElement {
  const field = document.createElement("div");
  field.className = "interlace-field";
  field.style.display = "flex";
  field.style.flexDirection = "column";
  field.style.gap = `${SPACE[1]}px`;
  field.append(createLabel(labelText, input.id), input);
  return field;
}

/** An inline error message element, hidden until a message is set. */
function createErrorText(id: string, className: string): HTMLParagraphElement {
  const error = document.createElement("p");
  error.id = id;
  error.className = `interlace-hint quiz-field-error ${className}`;
  error.style.margin = "0";
  error.style.fontSize = `${TYPE.sm}px`;
  error.style.color = COLORS.errorText;
  setShown(error, false);
  return error;
}

/** Shows `message` for `input` (with aria wiring), or clears it on `null`. */
function setFieldError(
  input: HTMLInputElement,
  error: HTMLElement,
  message: string | null,
): void {
  if (message) {
    error.textContent = message;
    setShown(error, true);
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", error.id);
  } else {
    error.textContent = "";
    setShown(error, false);
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
  }
}

interface MediaEditor {
  root: HTMLDivElement;
  srcInput: HTMLInputElement;
  altInput: HTMLInputElement;
  previewSlot: HTMLDivElement;
  /** Patches values/preview in place and shows or collapses the panel. */
  sync(media: QuizMediaRef | undefined, expanded: boolean): void;
}

interface MediaEditorOptions {
  /** Class prefix, e.g. `quiz-question-media` → `quiz-question-media-src`. */
  classPrefix: string;
  idPrefix: string;
  /** Accessible name of the "Add image" button. */
  addLabel: string;
  previewSlotClass: string;
  previewClass: string;
  /** The author edited the URL or alt text. */
  onEdit(media: QuizMediaRef | undefined): void;
  /** The author expanded the panel via "Add image". */
  onExpand(): void;
  /** The author removed the image (fields are already cleared). */
  onRemove(): void;
}

/**
 * Image URL + alt fields tucked behind a ghost "Add image" button. The
 * panel opens on demand (or automatically when media exists, via `sync`)
 * and "Remove image" clears both fields and collapses it again.
 */
function createMediaEditor(options: MediaEditorOptions): MediaEditor {
  const { classPrefix, idPrefix } = options;
  const root = document.createElement("div");
  root.className = classPrefix;

  const addButton = createButton("+ Add image", "ghost", `${classPrefix}-add`);
  addButton.setAttribute("aria-label", options.addLabel);
  addButton.setAttribute("aria-controls", `${idPrefix}-panel`);
  addButton.style.paddingLeft = `${SPACE[2]}px`;
  addButton.style.paddingRight = `${SPACE[2]}px`;

  const panel = document.createElement("div");
  panel.id = `${idPrefix}-panel`;
  panel.className = `${classPrefix}-panel`;
  panel.style.flexDirection = "column";
  panel.style.gap = `${SPACE[2]}px`;
  panel.style.padding = `${SPACE[3]}px`;
  panel.style.backgroundColor = COLORS.surfaceRaised;
  panel.style.border = `1px solid ${COLORS.border}`;
  panel.style.borderRadius = `${RADIUS.md}`;

  const srcInput = createInput(
    `${classPrefix}-src`,
    `${idPrefix}-src`,
    "https://example.com/image.png",
  );
  const altInput = createInput(
    `${classPrefix}-alt`,
    `${idPrefix}-alt`,
    "Describe the image for screen readers",
  );
  const previewSlot = document.createElement("div");
  previewSlot.className = options.previewSlotClass;

  const removeButton = createButton(
    "Remove image",
    "ghost",
    `${classPrefix}-remove`,
  );
  removeButton.style.alignSelf = "flex-start";

  panel.append(
    createField("Image URL", srcInput),
    createField("Image description (alt text)", altInput),
    previewSlot,
    removeButton,
  );
  root.append(addButton, panel);

  const setExpanded = (expanded: boolean): void => {
    setShown(panel, expanded, "flex");
    setShown(addButton, !expanded);
    addButton.setAttribute("aria-expanded", String(expanded));
  };
  setExpanded(false);

  const handleEdit = (): void => {
    const media = buildMediaRef(srcInput.value, altInput.value);
    syncPreview(previewSlot, media, options.previewClass);
    options.onEdit(media);
  };
  srcInput.addEventListener("input", handleEdit);
  altInput.addEventListener("input", handleEdit);

  addButton.addEventListener("click", () => {
    setExpanded(true);
    options.onExpand();
    srcInput.focus();
  });
  removeButton.addEventListener("click", () => {
    srcInput.value = "";
    altInput.value = "";
    syncPreview(previewSlot, undefined, options.previewClass);
    setExpanded(false);
    options.onRemove();
    addButton.focus();
  });

  const sync = (media: QuizMediaRef | undefined, expanded: boolean): void => {
    setValue(srcInput, media?.src ?? "");
    setValue(altInput, media?.alt ?? "");
    syncPreview(previewSlot, media, options.previewClass);
    setExpanded(expanded);
  };

  return { root, srcInput, altInput, previewSlot, sync };
}

interface OptionRow {
  row: HTMLDivElement;
  radio: HTMLInputElement;
  textInput: HTMLInputElement;
  error: HTMLParagraphElement;
  media: MediaEditor;
}

/**
 * Builds the quiz authoring form once and returns a controller whose
 * `syncTo` patches inputs in place (preserving focus) instead of rebuilding
 * the DOM on every keystroke. The form has a question tab list (add,
 * select); the ACTIVE question's text, image and answers are edited in the
 * tab panel below it, with the correct answer chosen by a radio on each
 * answer row. Switching the selected question rebuilds that question's
 * answer rows (an explicit action); within the active question, edits patch
 * in place. All edits emit canonical multi-question {@link QuizData}.
 */
function createQuizEditorController(
  container: HTMLElement,
  data: QuizData,
  onChange: (next: QuizData) => void,
): QuizEditorController {
  ensureInterlaceStyles(container.ownerDocument);
  editorInstanceCount += 1;
  const uid = `quiz-editor-${editorInstanceCount}`;

  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "quiz-editor";
  root.style.fontFamily = FONTS.body;
  root.style.color = COLORS.text;
  root.style.lineHeight = "1.5";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = `${SPACE[3]}px`;

  let currentData: QuizData = data;
  let currentOnChange = onChange;
  let selectedIndex = 0;
  let bodyQuestionIndex = -1;
  let optionRows: OptionRow[] = [];
  let tabButtons: HTMLButtonElement[] = [];
  /** Fields the author has blurred; errors only show for these. */
  const touched = new Set<string>();
  /** Media panels the author opened (kept open even while empty). */
  const expandedMedia = new Set<string>();

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

  /** Stable state key for the active question (or one of its answers). */
  const activeKey = (optionIndex?: number): string => {
    const active = currentData.questions[selectedIndex];
    const questionKey = active?.id ?? `#${selectedIndex}`;
    if (optionIndex === undefined) return questionKey;
    return `${questionKey}/${active?.options[optionIndex]?.id ?? `#${optionIndex}`}`;
  };

  // --- Question tabs ---
  const questionsHeader = document.createElement("div");
  questionsHeader.id = `${uid}-questions-label`;
  questionsHeader.className = "interlace-label";
  questionsHeader.textContent = "Questions";
  questionsHeader.style.fontSize = `${TYPE.sm}px`;
  questionsHeader.style.fontWeight = "600";
  questionsHeader.style.color = COLORS.textMuted;

  const tabsRow = document.createElement("div");
  tabsRow.style.display = "flex";
  tabsRow.style.flexWrap = "wrap";
  tabsRow.style.alignItems = "center";
  tabsRow.style.gap = `${SPACE[2]}px`;

  const tabsBar = document.createElement("div");
  tabsBar.className = "quiz-question-tabs";
  tabsBar.setAttribute("role", "tablist");
  tabsBar.setAttribute("aria-labelledby", questionsHeader.id);
  tabsBar.style.display = "flex";
  tabsBar.style.flexWrap = "wrap";
  tabsBar.style.gap = `${SPACE[2]}px`;

  const addQuestionButton = createButton(
    "+ Add question",
    "secondary",
    "quiz-add-question",
  );
  addQuestionButton.addEventListener("click", () => {
    const id = nextQuestionId(
      currentData.questions,
      currentData.questions.length,
    );
    const questions = [...currentData.questions, emptyQuestion(id)];
    currentData = { questions };
    selectedIndex = questions.length - 1;
    emit(questions);
    bodyQuestionIndex = -1;
    renderTabs();
    syncActiveBody();
  });
  tabsRow.append(tabsBar, addQuestionButton);
  root.append(questionsHeader, tabsRow);

  // --- Active question panel ---
  const body = document.createElement("div");
  body.id = `${uid}-panel`;
  body.className = "quiz-editor-body";
  body.setAttribute("role", "tabpanel");
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = `${SPACE[4]}px`;
  body.style.padding = `${SPACE[4]}px`;
  body.style.backgroundColor = COLORS.surface;
  body.style.border = `1px solid ${COLORS.border}`;
  body.style.borderRadius = `${RADIUS.md}`;
  root.appendChild(body);

  // Question text: label above, remove-question action on the same line.
  const questionInput = createInput(
    "quiz-question",
    `${uid}-question`,
    "Type your question",
  );
  questionInput.style.fontSize = `${TYPE.md}px`;
  const questionError = createErrorText(
    `${uid}-question-error`,
    "quiz-question-error",
  );
  const refreshQuestionError = (): void => {
    const show =
      touched.has(`text:${activeKey()}`) &&
      questionInput.value.trim().length === 0;
    setFieldError(
      questionInput,
      questionError,
      show ? "Add the question text" : null,
    );
  };
  questionInput.addEventListener("input", () => {
    patchActiveQuestion((question) => ({
      ...question,
      text: questionInput.value,
    }));
    refreshQuestionError();
  });
  questionInput.addEventListener("blur", () => {
    touched.add(`text:${activeKey()}`);
    refreshQuestionError();
  });

  const removeQuestionButton = createRemoveButton("quiz-question-remove");
  removeQuestionButton.addEventListener("click", () =>
    removeQuestion(selectedIndex),
  );

  const questionHeader = document.createElement("div");
  questionHeader.style.display = "flex";
  questionHeader.style.alignItems = "center";
  questionHeader.style.justifyContent = "space-between";
  questionHeader.style.gap = `${SPACE[2]}px`;
  questionHeader.append(
    createLabel("Question", questionInput.id),
    removeQuestionButton,
  );

  const questionField = document.createElement("div");
  questionField.className = "interlace-field";
  questionField.style.display = "flex";
  questionField.style.flexDirection = "column";
  questionField.style.gap = `${SPACE[1]}px`;
  questionField.append(questionHeader, questionInput, questionError);

  const questionMedia = createMediaEditor({
    classPrefix: "quiz-question-media",
    idPrefix: `${uid}-question-media`,
    addLabel: "Add image to question",
    previewSlotClass: "quiz-question-media-preview-slot",
    previewClass: "quiz-question-media-preview",
    onEdit: (media) => {
      expandedMedia.add(activeKey());
      patchActiveQuestion((question) => ({ ...question, media }));
    },
    onExpand: () => expandedMedia.add(activeKey()),
    onRemove: () => {
      expandedMedia.delete(activeKey());
      patchActiveQuestion((question) => ({ ...question, media: undefined }));
    },
  });
  questionField.appendChild(questionMedia.root);
  body.appendChild(questionField);

  // Answers: heading + hint, then one row per answer with a correct radio.
  const answersSection = document.createElement("div");
  answersSection.style.display = "flex";
  answersSection.style.flexDirection = "column";
  answersSection.style.gap = `${SPACE[2]}px`;

  const answersHeading = document.createElement("div");
  answersHeading.id = `${uid}-answers-label`;
  answersHeading.className = "interlace-label quiz-answers-heading";
  answersHeading.textContent = "Answers";
  answersHeading.style.fontSize = `${TYPE.sm}px`;
  answersHeading.style.fontWeight = "600";

  const answersHint = document.createElement("p");
  answersHint.id = `${uid}-answers-hint`;
  answersHint.className = "interlace-hint quiz-answers-hint";
  answersHint.textContent = "Select the correct answer.";
  answersHint.style.margin = "0";
  answersHint.style.fontSize = `${TYPE.sm}px`;
  answersHint.style.color = COLORS.textMuted;

  const optionsContainer = document.createElement("div");
  optionsContainer.className = "quiz-options";
  optionsContainer.setAttribute("role", "radiogroup");
  optionsContainer.setAttribute("aria-labelledby", answersHeading.id);
  optionsContainer.setAttribute("aria-describedby", answersHint.id);
  optionsContainer.style.display = "flex";
  optionsContainer.style.flexDirection = "column";
  optionsContainer.style.gap = `${SPACE[2]}px`;

  const addOptionButton = createButton(
    "+ Add answer",
    "secondary",
    "quiz-add-option",
  );
  addOptionButton.style.alignSelf = "flex-start";
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

  answersSection.append(
    answersHeading,
    answersHint,
    optionsContainer,
    addOptionButton,
  );
  body.appendChild(answersSection);

  container.appendChild(root);

  const createOptionRow = (
    option: QuizOption,
    optionIndex: number,
    optionCount: number,
  ): OptionRow => {
    const number = optionIndex + 1;
    const idPrefix = `${uid}-q${selectedIndex}-opt${optionIndex}`;

    // Grid: [radio] [label / input / error + image] [remove].
    const row = document.createElement("div");
    row.className = "quiz-option-row interlace-choice";
    row.style.display = "grid";
    row.style.gridTemplateColumns = "auto minmax(0, 1fr) auto";
    row.style.alignItems = "center";
    row.style.columnGap = `${SPACE[2]}px`;
    row.style.rowGap = `${SPACE[1]}px`;
    row.style.cursor = "default";
    // The inputs draw their own focus rings; skip the card's focus-within ring.
    row.style.outline = "none";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = `${uid}-correct-${selectedIndex}`;
    radio.className = "quiz-option-correct";
    radio.value = option.id;
    radio.checked =
      option.id === currentData.questions[selectedIndex]?.correctOptionId;
    radio.setAttribute("aria-label", `Mark answer ${number} as correct`);
    radio.style.width = "18px";
    radio.style.height = "18px";
    radio.style.margin = "0";
    radio.style.accentColor = COLORS.accent;
    radio.style.cursor = "pointer";
    radio.style.gridColumn = "1";
    radio.style.gridRow = "2";
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      patchActiveQuestion((question) => ({
        ...question,
        correctOptionId: question.options[optionIndex]?.id ?? null,
      }));
    });

    const textInput = createInput(
      "quiz-option-text",
      `${idPrefix}-text`,
      "Answer text",
    );
    textInput.value = option.text;
    textInput.style.gridColumn = "2";
    textInput.style.gridRow = "2";
    const label = createLabel(`Answer ${number}`, textInput.id);
    label.style.gridColumn = "2";
    label.style.gridRow = "1";

    const error = createErrorText(`${idPrefix}-error`, "quiz-option-error");
    const refreshError = (): void => {
      const show =
        touched.has(`opt:${activeKey(optionIndex)}`) &&
        textInput.value.trim().length === 0;
      setFieldError(
        textInput,
        error,
        show ? `Answer ${number} needs text` : null,
      );
    };
    textInput.addEventListener("input", () => {
      patchActiveQuestion((question) => {
        const nextOptions = question.options.slice();
        nextOptions[optionIndex] = {
          ...nextOptions[optionIndex]!,
          text: textInput.value,
        };
        return { ...question, options: nextOptions };
      });
      refreshError();
    });
    textInput.addEventListener("blur", () => {
      touched.add(`opt:${activeKey(optionIndex)}`);
      refreshError();
    });

    const patchOptionMedia = (media: QuizMediaRef | undefined): void => {
      patchActiveQuestion((question) => {
        const nextOptions = question.options.slice();
        nextOptions[optionIndex] = { ...nextOptions[optionIndex]!, media };
        return { ...question, options: nextOptions };
      });
    };
    const media = createMediaEditor({
      classPrefix: "quiz-option-media",
      idPrefix: `${idPrefix}-media`,
      addLabel: `Add image to answer ${number}`,
      previewSlotClass: "quiz-option-media-preview",
      previewClass: "quiz-option-thumb",
      onEdit: (next) => {
        expandedMedia.add(activeKey(optionIndex));
        patchOptionMedia(next);
      },
      onExpand: () => expandedMedia.add(activeKey(optionIndex)),
      onRemove: () => {
        expandedMedia.delete(activeKey(optionIndex));
        patchOptionMedia(undefined);
      },
    });

    const details = document.createElement("div");
    details.style.gridColumn = "2";
    details.style.gridRow = "3";
    details.style.display = "flex";
    details.style.flexDirection = "column";
    details.style.alignItems = "flex-start";
    details.style.gap = `${SPACE[1]}px`;
    media.root.style.alignSelf = "stretch";
    details.append(error, media.root);

    const remove = createRemoveButton("quiz-option-remove");
    remove.setAttribute("aria-label", `Remove answer ${number}`);
    remove.style.gridColumn = "3";
    remove.style.gridRow = "2";
    setRemoveAllowed(
      remove,
      optionCount > MIN_ANSWERS,
      `A question needs at least ${MIN_ANSWERS} answers`,
    );
    remove.addEventListener("click", () => {
      patchActiveQuestion((question) => {
        const removed = question.options[optionIndex];
        const nextOptions = question.options.filter(
          (_, i) => i !== optionIndex,
        );
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

    row.append(label, radio, textInput, remove, details);
    optionsContainer.appendChild(row);
    return { row, radio, textInput, error, media };
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
    const count = currentData.questions.length;
    tabButtons = currentData.questions.map((_, index) => {
      const selected = index === selectedIndex;
      const tab = createButton(
        `Question ${index + 1}`,
        selected ? "primary" : "secondary",
        "quiz-question-tab",
      );
      tab.id = `${uid}-tab-${index}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(selected));
      tab.setAttribute("aria-controls", body.id);
      tab.tabIndex = selected ? 0 : -1;
      tab.addEventListener("click", () => selectQuestion(index));
      tab.addEventListener("keydown", (event) => {
        let target = -1;
        if (event.key === "ArrowRight") target = (index + 1) % count;
        else if (event.key === "ArrowLeft")
          target = (index - 1 + count) % count;
        else if (event.key === "Home") target = 0;
        else if (event.key === "End") target = count - 1;
        if (target < 0) return;
        event.preventDefault();
        selectQuestion(target);
        tabButtons[target]?.focus();
      });
      tabsBar.appendChild(tab);
      return tab;
    });

    body.setAttribute("aria-labelledby", `${uid}-tab-${selectedIndex}`);
    removeQuestionButton.setAttribute(
      "aria-label",
      `Remove question ${selectedIndex + 1}`,
    );
    setRemoveAllowed(
      removeQuestionButton,
      count > 1,
      "A quiz needs at least one question",
    );
  };

  const syncActiveBody = (): void => {
    const active = currentData.questions[selectedIndex];
    if (!active) return;

    setValue(questionInput, active.text);
    questionMedia.sync(
      active.media,
      !!active.media || expandedMedia.has(activeKey()),
    );
    refreshQuestionError();

    const options = active.options;
    if (
      bodyQuestionIndex !== selectedIndex ||
      optionRows.length !== options.length
    ) {
      // Question switch or option count change: rebuild the active question's rows.
      optionsContainer.innerHTML = "";
      optionRows = options.map((option, optionIndex) =>
        createOptionRow(option, optionIndex, options.length),
      );
      bodyQuestionIndex = selectedIndex;
    }
    // Patch values in place, preserving input focus.
    optionRows.forEach((row, optionIndex) => {
      const option = options[optionIndex]!;
      setValue(row.textInput, option.text);
      row.radio.value = option.id;
      row.radio.checked = option.id === active.correctOptionId;
      row.media.sync(
        option.media,
        !!option.media || expandedMedia.has(activeKey(optionIndex)),
      );
      const show =
        touched.has(`opt:${activeKey(optionIndex)}`) &&
        option.text.trim().length === 0;
      setFieldError(
        row.textInput,
        row.error,
        show ? `Answer ${optionIndex + 1} needs text` : null,
      );
    });
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
  getDisplayName: () => "Quiz",
  getDescription: () => "Multiple-choice questions that check understanding",

  validate(data: QuizData): string[] {
    return getQuizAuthoringIssues(data);
  },

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
