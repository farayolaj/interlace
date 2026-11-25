import type {
  QualityCapableAdapter,
  QualityLevel,
  VideoAdapter,
} from "@interlacejs/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { COLORS, FONTS, RADIUS, SPACE, TYPE } from "../tokens";

export interface QualityControlStrings {
  /** Menu title and accessible-name prefix. */
  qualityLabel: string;
  /** The adaptive (automatic) option. */
  qualityAutoLabel: string;
  /** Prefix for the lowest level. */
  qualityDataSaverLabel: string;
}

export const DEFAULT_QUALITY_CONTROL_STRINGS: QualityControlStrings = {
  qualityLabel: "Quality",
  qualityAutoLabel: "Auto",
  qualityDataSaverLabel: "Data saver",
};

export interface QualityControlProps {
  adapter: VideoAdapter & QualityCapableAdapter;
  strings?: Partial<QualityControlStrings>;
}

/** How often the control checks whether the video's clock is moving. */
const PLAYBACK_POLL_MS = 500;

/** Idle time while playing before the control fades out. */
export const QUALITY_CONTROL_HIDE_DELAY_MS = 2500;

const AUTO = -1;
const INSET = SPACE[2];
const BUTTON_SIZE = 36;

interface QualitySnapshot {
  levels: QualityLevel[];
  selected: number;
  active: number | null;
}

function readSnapshot(adapter: QualityCapableAdapter): QualitySnapshot {
  return {
    levels: [...adapter.getQualityLevels()].sort((a, b) => b.height - a.height),
    selected: adapter.getQualityLevel(),
    active: adapter.getActiveQualityLevel(),
  };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function pointOf(event: Event): { x: number; y: number } | null {
  if ("touches" in event) {
    const touch = (event as TouchEvent).touches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  const mouse = event as MouseEvent;
  return { x: mouse.clientX, y: mouse.clientY };
}

/**
 * QualityControl - a video-style quality menu anchored to the top-right of
 * the video frame. Renders nothing unless the adapter reports at least two
 * levels. While playing it fades out after a short idle period and comes
 * back on pointer movement over the video, touch or keyboard focus.
 */
export const QualityControl: React.FC<QualityControlProps> = ({
  adapter,
  strings: stringsOverride,
}) => {
  const strings = { ...DEFAULT_QUALITY_CONTROL_STRINGS, ...stringsOverride };
  const [snapshot, setSnapshot] = useState(() => readSnapshot(adapter));
  const [playing, setPlaying] = useState(false);
  const [recentActivity, setRecentActivity] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    setSnapshot(readSnapshot(adapter));
    return adapter.on("qualitychange", () =>
      setSnapshot(readSnapshot(adapter)),
    );
  }, [adapter]);

  // Show the control, then hide it again after an idle period.
  const reveal = useCallback(() => {
    setRecentActivity(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(
      () => setRecentActivity(false),
      QUALITY_CONTROL_HIDE_DELAY_MS,
    );
  }, []);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const offPlay = adapter.on("play", () => {
      setPlaying(true);
      reveal();
    });
    const offPause = adapter.on("pause", () => setPlaying(false));
    // Adapters don't emit play/pause for their own calls (e.g. resuming
    // after a quiz's Continue), so also infer playback from the clock.
    let lastTime = adapter.getCurrentTime();
    const poll = setInterval(() => {
      const time = adapter.getCurrentTime();
      setPlaying(time !== lastTime);
      lastTime = time;
    }, PLAYBACK_POLL_MS);
    return () => {
      offPlay();
      offPause();
      clearInterval(poll);
    };
  }, [adapter, reveal]);

  // The overlay is click-through, so pointer activity over the video is
  // detected at the document level and hit-tested against the frame.
  useEffect(() => {
    const onActivity = (event: Event) => {
      const frame = frameRef.current;
      const point = pointOf(event);
      if (!frame || !point) return;
      const rect = frame.getBoundingClientRect();
      if (
        point.x >= rect.left &&
        point.x <= rect.right &&
        point.y >= rect.top &&
        point.y <= rect.bottom &&
        rect.width > 0 &&
        rect.height > 0
      ) {
        reveal();
      }
    };
    const events = ["mousemove", "mousedown", "touchstart"] as const;
    events.forEach((type) =>
      document.addEventListener(type, onActivity, { passive: true }),
    );
    return () =>
      events.forEach((type) => document.removeEventListener(type, onActivity));
  }, [reveal]);

  // Outside click closes the menu (focus stays where the user clicked).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      const target = event.target as Node;
      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  const { levels, selected, active } = snapshot;
  if (levels.length < 2) return null;

  // Menu order: Auto first, then each level high → low.
  const options = [AUTO, ...levels.map((level) => level.id)];
  const activeLevel = levels.find((level) => level.id === active);
  const selectedLevel = levels.find((level) => level.id === selected);
  const lowestId = levels[levels.length - 1]!.id;

  const optionLabel = (id: number): string => {
    if (id === AUTO) {
      return activeLevel
        ? `${strings.qualityAutoLabel} · ${activeLevel.label}`
        : strings.qualityAutoLabel;
    }
    const level = levels.find((l) => l.id === id)!;
    return id === lowestId
      ? `${strings.qualityDataSaverLabel} · ${level.label}`
      : level.label;
  };

  const currentLabel = selectedLevel
    ? selectedLevel.label
    : activeLevel
      ? `${strings.qualityAutoLabel} (${activeLevel.label})`
      : strings.qualityAutoLabel;
  const effectiveHeight = (selectedLevel ?? activeLevel)?.height ?? 0;
  const selectedIndex = Math.max(
    0,
    options.indexOf(selectedLevel ? selected : AUTO),
  );

  const openMenu = (index: number) => {
    setFocusIndex(index);
    setOpen(true);
  };

  const closeMenu = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const select = (id: number) => {
    adapter.setQualityLevel(id);
    closeMenu(true);
  };

  const onButtonKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openMenu(selectedIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(options.length - 1);
    }
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const last = options.length - 1;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setFocusIndex((i) => (i >= last ? 0 : i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusIndex((i) => (i <= 0 ? last : i - 1));
        break;
      case "Home":
        event.preventDefault();
        setFocusIndex(0);
        break;
      case "End":
        event.preventDefault();
        setFocusIndex(last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        select(options[focusIndex]!);
        break;
      case "Escape":
        event.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  const visible = !playing || open || focusWithin || recentActivity;
  const interactive = visible ? "auto" : "none";

  return (
    <div
      ref={frameRef}
      data-testid="interlace-quality-control"
      data-visible={visible}
      // Only keyboard focus keeps it visible: after a mouse selection focus
      // returns to the button, which must not pin the control on screen.
      onFocus={(event) => setFocusWithin(isKeyboardFocus(event.target))}
      onBlur={(event) => {
        if (!frameRef.current?.contains(event.relatedTarget as Node | null)) {
          setFocusWithin(false);
        }
      }}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: reducedMotion ? "none" : "opacity 200ms ease",
        fontFamily: FONTS.body,
        zIndex: 20,
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="interlace-focusable"
        aria-label={`${strings.qualityLabel}: ${currentLabel}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={strings.qualityLabel}
        onClick={() => (open ? closeMenu(false) : openMenu(selectedIndex))}
        onKeyDown={onButtonKeyDown}
        style={{
          position: "absolute",
          top: INSET,
          right: INSET,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: RADIUS.md,
          background: "rgba(0, 0, 0, 0.6)",
          color: COLORS.white,
          cursor: "pointer",
          pointerEvents: interactive,
        }}
      >
        <GearIcon />
        {effectiveHeight >= 720 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 3,
              right: 2,
              padding: "0 2px",
              borderRadius: 3,
              background: COLORS.accent,
              color: COLORS.accentContrast,
              fontSize: 8,
              fontWeight: 700,
              lineHeight: "11px",
            }}
          >
            HD
          </span>
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={strings.qualityLabel}
          onKeyDown={onMenuKeyDown}
          style={{
            position: "absolute",
            top: INSET + BUTTON_SIZE + SPACE[1],
            right: INSET,
            minWidth: 168,
            maxHeight: `calc(100% - ${INSET * 2 + BUTTON_SIZE + SPACE[1]}px)`,
            overflowY: "auto",
            boxSizing: "border-box",
            padding: SPACE[1],
            borderRadius: RADIUS.md,
            background: "rgba(0, 0, 0, 0.8)",
            color: COLORS.white,
            fontSize: TYPE.sm,
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
            pointerEvents: "auto",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              padding: `${SPACE[1]}px ${SPACE[2]}px`,
              fontSize: TYPE.xs,
              fontWeight: 600,
              opacity: 0.7,
            }}
          >
            {strings.qualityLabel}
          </div>
          {options.map((id, index) => {
            const checked = selectedLevel ? id === selected : id === AUTO;
            return (
              <button
                key={id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                className="interlace-focusable"
                onClick={() => select(id)}
                onMouseEnter={() => setFocusIndex(index)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACE[2],
                  width: "100%",
                  minHeight: 36,
                  padding: `0 ${SPACE[3]}px 0 ${SPACE[2]}px`,
                  border: "none",
                  borderRadius: RADIUS.sm,
                  background:
                    index === focusIndex
                      ? "rgba(255, 255, 255, 0.16)"
                      : "transparent",
                  color: "inherit",
                  font: "inherit",
                  fontWeight: checked ? 600 : 400,
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    width: 16,
                    color: COLORS.accent,
                  }}
                >
                  {checked && <CheckIcon />}
                </span>
                {optionLabel(id)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const GearIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function isKeyboardFocus(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true; // Engines without :focus-visible: treat focus as keyboard focus.
  }
}
