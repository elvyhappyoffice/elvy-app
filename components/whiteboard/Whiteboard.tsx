"use client";

import type { ReactNode } from "react";

export type WhiteboardContentType =
  | "paragraph"
  | "dialogue"
  | "vocabulary"
  | "exercise";

export type WhiteboardProps = {
  title?: string;
  text: string;
  type?: WhiteboardContentType;
  activeCharIndex?: number | null;
  activeWordLength?: number;
  footer?: ReactNode;
  className?: string;
};

function getTextSizeClass(text: string) {
  const length = text.trim().length;

  if (length <= 140) {
    return "text-[19px] leading-8";
  }

  if (length <= 320) {
    return "text-[17px] leading-7";
  }

  if (length <= 560) {
    return "text-[15px] leading-6";
  }

  return "text-[14px] leading-[1.45rem]";
}

function renderHighlightedText(
  text: string,
  activeCharIndex: number | null,
  activeWordLength: number,
) {
  if (activeCharIndex === null || activeCharIndex < 0) {
    return text;
  }

  const parts = text.match(/\S+|\s+/g) || [text];
  let currentIndex = 0;

  return parts.map((part, index) => {
    const start = currentIndex;
    const end = start + part.length;
    currentIndex = end;

    const isWord = /\S/.test(part);
    const activeEnd =
      activeWordLength > 0
        ? activeCharIndex + activeWordLength
        : activeCharIndex + 1;

    const isActive =
      isWord && activeCharIndex < end && activeEnd > start;

    return (
      <span
        key={`${index}-${start}`}
        className={
          isActive
            ? "rounded-md bg-[#ffe071] px-1 text-[#1f1a12] shadow-sm transition-colors duration-100"
            : undefined
        }
      >
        {part}
      </span>
    );
  });
}

export default function Whiteboard({
  title,
  text,
  type = "paragraph",
  activeCharIndex = null,
  activeWordLength = 0,
  footer,
  className = "",
}: WhiteboardProps) {
  const textSizeClass = getTextSizeClass(text);

  return (
    <section
      className={`flex h-full w-full flex-col overflow-hidden px-4 py-3 text-[#202020] ${className}`}
      aria-label="Lesson whiteboard"
      data-content-type={type}
    >
      {title && (
        <header className="shrink-0 border-b border-[#b9c4cc] pb-2 text-center">
          <h2 className="text-[18px] font-extrabold text-[#1670b9]">
            {title}
          </h2>
        </header>
      )}

      <div
        className={`min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words pt-3 text-left font-medium [scrollbar-width:thin] ${textSizeClass}`}
        aria-live="polite"
      >
        {renderHighlightedText(
          text,
          activeCharIndex,
          activeWordLength,
        )}
      </div>

      {footer && (
        <footer className="mt-2 shrink-0 border-t border-[#c8d0d6] pt-2">
          {footer}
        </footer>
      )}
    </section>
  );
}
