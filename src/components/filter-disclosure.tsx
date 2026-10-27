"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { BsCheckLg } from "react-icons/bs";
import { FaCanadianMapleLeaf, FaFlagUsa } from "react-icons/fa";
import { PiCheckCircleBold, PiCircleDashedBold, PiFunnelSimpleBold, PiListBold } from "react-icons/pi";

// Icons are chosen by name here, because a page rendered on the server can
// pass text to this component but not icon components themselves.
const ICONS = {
  all: PiListBold,
  unused: PiCircleDashedBold,
  used: PiCheckCircleBold,
  canada: FaCanadianMapleLeaf,
  usa: FaFlagUsa,
} as const;
export type FilterIcon = keyof typeof ICONS;

export type FilterOption = {
  id: string;
  label: string;
  icon: FilterIcon;
  /** Shown after the label, e.g. a count. */
  detail?: string;
  /** If set, choosing this option opens this address (for filters kept in the URL). */
  href?: string;
};

const SPRING = { type: "spring", stiffness: 240, damping: 20, mass: 1 } as const;

/**
 * A compact single-choice filter: a funnel button showing the current
 * choice, which opens into the full list. Based on a "filter disclosure"
 * pattern, adapted to the app's colours, both themes, the keyboard and
 * screen readers. Works in a form too: give it a `name` and the chosen id
 * is sent as that field.
 */
export function FilterDisclosure({
  label,
  options,
  value,
  name,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  value: string;
  name?: string;
  onChange?: (id: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  // Set when the list closes, so focus goes back to the button once it is shown again.
  const returnFocus = useRef(false);

  const current = options.find((o) => o.id === active) ?? options[0];
  const ActiveIcon = ICONS[current.icon];

  // While open: Escape or a click elsewhere closes it, and focus moves to the
  // chosen option so the keyboard starts in the right place.
  useEffect(() => {
    if (!open) {
      if (returnFocus.current) triggerRef.current?.focus();
      returnFocus.current = false;
      return;
    }
    listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        returnFocus.current = true;
        setOpen(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const choose = (option: FilterOption) => {
    setActive(option.id);
    onChange?.(option.id);
    if (option.href) router.push(option.href, { scroll: false });
    // A short pause lets the tick animate before the list folds away.
    setTimeout(() => {
      returnFocus.current = true;
      setOpen(false);
    }, 220);
  };

  return (
    <div ref={rootRef} className="relative flex w-fit">
      {name ? <input type="hidden" name={name} value={current.id} /> : null}
      <span className="sr-only" id={`${listId}-label`}>{label}</span>
      {/* Holds the button's place while the list is open, so the page doesn't jump. */}
      {open ? <span aria-hidden className="block h-11 w-56" /> : null}
      {/* reducedMotion="user": people who ask their system for less motion get none. */}
      <MotionConfig reducedMotion="user" transition={{ type: "spring", bounce: 0.25, duration: 0.6 }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {open ? (
            <motion.div
              key="open"
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={`${listId}-label`}
              layoutId={`${listId}-panel`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              style={{ transformOrigin: "0% 0%", borderRadius: 20 }}
              className="absolute left-0 top-0 z-30 flex w-72 flex-col gap-1 overflow-hidden border border-border bg-surface p-2 shadow-xl"
            >
              {options.map((option, index) => {
                const Icon = ICONS[option.icon];
                const selected = option.id === current.id;
                return (
                  <motion.button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => choose(option)}
                    initial={{ opacity: 0, scale: 1.05, y: 24 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ ...SPRING, delay: (2 + index) * 0.04 }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-border/60 focus-visible:bg-border/60"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon aria-hidden className="h-5 w-5 shrink-0 text-muted" />
                      <span className="min-w-0 text-sm font-semibold">
                        {option.label}
                        {option.detail ? <span className="ml-1.5 font-normal text-muted">{option.detail}</span> : null}
                      </span>
                    </span>
                    <motion.span
                      aria-hidden
                      animate={{ backgroundColor: selected ? "var(--primary)" : "rgba(0,0,0,0)" }}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-primary" : "border-border"}`}
                    >
                      <motion.span
                        animate={{ scale: selected ? 1 : 0, opacity: selected ? 1 : 0 }}
                        transition={{ type: "spring", stiffness: 520, damping: 30 }}
                      >
                        <BsCheckLg className="h-3.5 w-3.5 text-primary-foreground" />
                      </motion.span>
                    </motion.span>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <motion.button
              key="closed"
              ref={triggerRef}
              type="button"
              layoutId={`${listId}-panel`}
              aria-haspopup="listbox"
              aria-expanded={false}
              aria-controls={listId}
              onClick={() => setOpen(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0 } }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{ borderRadius: 999 }}
              className="flex h-11 items-center gap-2 border border-border bg-surface pl-2 pr-4 text-sm shadow-sm"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <PiFunnelSimpleBold aria-hidden className="h-4 w-4" />
              </span>
              <span className="text-muted">{label}:</span>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={current.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-1.5 font-semibold"
                >
                  <ActiveIcon aria-hidden className="h-4 w-4 text-muted" />
                  {current.label}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          )}
        </AnimatePresence>
      </MotionConfig>
    </div>
  );
}
