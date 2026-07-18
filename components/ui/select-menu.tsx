"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface SelectMenuOption {
  value: string;
  label: string;
  /** Renders the option visually nested (e.g. a child event under a parent event). */
  indent?: boolean;
  disabled?: boolean;
}

export interface SelectMenuGroup {
  label?: string;
  options: SelectMenuOption[];
}

interface Position {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

const EDGE_GAP = 8;

/**
 * Accessible dark-themed dropdown that replaces native `<select>` chrome the
 * browser can't be styled consistently. Implements the ARIA "select-only
 * combobox" pattern: focus stays on the trigger button, arrow keys move
 * `aria-activedescendant` across a portaled `role="listbox"`.
 */
export function SelectMenu({
  value,
  onChange,
  options,
  groups,
  ariaLabel,
  placeholder = "Select…",
  disabled,
  className,
  triggerClassName,
  size = "md",
  fullWidth,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  options?: SelectMenuOption[];
  groups?: SelectMenuGroup[];
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  id?: string;
}) {
  const generatedId = useId();
  const listboxId = id ? `${id}-listbox` : `select-menu-${generatedId}`;

  const groupList = useMemo<SelectMenuGroup[]>(
    () => groups ?? [{ options: options ?? [] }],
    [groups, options]
  );

  const flat = useMemo(() => {
    let index = 0;
    return groupList.flatMap((group) =>
      group.options.map((option) => ({ option, optionId: `${listboxId}-opt-${index++}` }))
    );
  }, [groupList, listboxId]);

  const selected = flat.find((entry) => entry.option.value === value)?.option;

  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;

    let left = rect.left;
    const width = Math.max(rect.width, 160);
    if (left + width > viewportW - EDGE_GAP) left = viewportW - EDGE_GAP - width;
    if (left < EDGE_GAP) left = EDGE_GAP;

    setPosition(
      openUp
        ? { bottom: viewportH - rect.top + 6, left, width }
        : { top: rect.bottom + 6, left, width }
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handle = () => updatePosition();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (listboxRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveValue(value || flat.find((entry) => !entry.option.disabled)?.option.value || null);
    // Only reset the highlighted option when the menu transitions open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !activeValue) return;
    const entry = flat.find((item) => item.option.value === activeValue);
    if (!entry) return;
    document.getElementById(entry.optionId)?.scrollIntoView({ block: "nearest" });
  }, [open, activeValue, flat]);

  const closeMenu = useCallback(() => setOpen(false), []);

  const commit = useCallback(
    (nextValue: string) => {
      onChange(nextValue);
      closeMenu();
    },
    [onChange, closeMenu]
  );

  const enabledFlat = useMemo(() => flat.filter((entry) => !entry.option.disabled), [flat]);

  const moveActive = useCallback(
    (direction: 1 | -1) => {
      if (!enabledFlat.length) return;
      const currentIndex = enabledFlat.findIndex((entry) => entry.option.value === activeValue);
      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = enabledFlat.length - 1;
      if (nextIndex >= enabledFlat.length) nextIndex = 0;
      setActiveValue(enabledFlat[nextIndex].option.value);
    },
    [enabledFlat, activeValue]
  );

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        else moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) setOpen(true);
        else moveActive(-1);
        break;
      case "Home":
        if (open) {
          event.preventDefault();
          if (enabledFlat[0]) setActiveValue(enabledFlat[0].option.value);
        }
        break;
      case "End":
        if (open) {
          event.preventDefault();
          if (enabledFlat.length) setActiveValue(enabledFlat[enabledFlat.length - 1].option.value);
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (!open) setOpen(true);
        else if (activeValue) commit(activeValue);
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          closeMenu();
        }
        break;
      case "Tab":
        if (open) setOpen(false);
        break;
      default:
        break;
    }
  };

  const activeOptionId = open && activeValue ? flat.find((entry) => entry.option.value === activeValue)?.optionId : undefined;

  let renderIndex = 0;

  const sizeClass = size === "sm" ? " select-trigger-sm" : "";
  const widthClass = fullWidth ? " select-trigger-full" : "";
  const triggerClasses = ["select-trigger", sizeClass, widthClass, triggerClassName ? ` ${triggerClassName}` : ""].join("");

  return (
    <span className={`select-root${className ? ` ${className}` : ""}${fullWidth ? " select-root-full" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={triggerClasses}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        aria-activedescendant={activeOptionId}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="select-trigger-label">{selected ? selected.label : placeholder}</span>
        <ChevronDown className="select-trigger-chevron" aria-hidden="true" />
      </button>
      {open && position &&
        createPortal(
          <div
            ref={listboxRef}
            role="listbox"
            id={listboxId}
            aria-label={ariaLabel}
            className="select-listbox"
            style={{
              position: "fixed",
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              width: position.width,
            }}
          >
            {groupList.map((group, groupIndex) => (
              <div key={group.label ?? groupIndex} role="group" aria-label={group.label} className="select-group">
                {group.label && (
                  <div className="select-group-label" role="presentation">
                    {group.label}
                  </div>
                )}
                {group.options.map((option) => {
                  const optionId = flat[renderIndex++]?.optionId ?? `${listboxId}-opt-${option.value}`;
                  const isActive = option.value === activeValue;
                  const isSelected = option.value === value;
                  return (
                    <div
                      key={optionId}
                      id={optionId}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled || undefined}
                      className={[
                        "select-option",
                        isActive ? " select-option-active" : "",
                        option.indent ? " select-option-indent" : "",
                        option.disabled ? " select-option-disabled" : "",
                      ].join("")}
                      onMouseEnter={() => !option.disabled && setActiveValue(option.value)}
                      onClick={() => !option.disabled && commit(option.value)}
                    >
                      <span>{option.label}</span>
                      {isSelected && <Check size={14} aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body
        )}
    </span>
  );
}
