"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type MessageTitlePageProps = {
  storageKey: string;
  defaultMessages: string[];
  imageSrc: string;
  imageAlt: string;
  emptyText: string;
  addLabel: string;
  editLabel: string;
  downloadFileName: string;
};

export default function MessageTitlePage({
  storageKey,
  defaultMessages,
  imageSrc,
  imageAlt,
  emptyText,
  addLabel,
  editLabel,
  downloadFileName,
}: MessageTitlePageProps) {
  const [messages, setMessages] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [role, setRole] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [showAddBox, setShowAddBox] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  const [showEditBox, setShowEditBox] = useState(false);
  const [editMessage, setEditMessage] = useState("");

  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRole(localStorage.getItem("adminRole"));
    setRoom(localStorage.getItem("adminRoom"));

    const savedMessages = localStorage.getItem(storageKey);

    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        } else {
          setMessages(defaultMessages);
          localStorage.setItem(storageKey, JSON.stringify(defaultMessages));
        }
      } catch {
        setMessages(defaultMessages);
        localStorage.setItem(storageKey, JSON.stringify(defaultMessages));
      }
    } else {
      setMessages(defaultMessages);
      localStorage.setItem(storageKey, JSON.stringify(defaultMessages));
    }

    setReady(true);
  }, [storageKey, defaultMessages]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, ready, storageKey]);

  const showAdminControls =
    ready &&
    (role === "founder" || (role === "room_admin" && room === "messages"));

  const handleDownload = async () => {
    if (!frameRef.current) return;

    try {
      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default;

      const canvas = await html2canvas(frameRef.current, {
        backgroundColor: null,
        scale: 2,
      });

      const link = document.createElement("a");
      link.download = downloadFileName;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleNext = () => {
    if (currentIndex < messages.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleAddMessage = () => {
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    const updatedMessages = [...messages, trimmed];
    setMessages(updatedMessages);
    setCurrentIndex(updatedMessages.length - 1);
    setNewMessage("");
    setShowAddBox(false);
  };

  const handleDeleteCurrent = () => {
    if (messages.length === 0) return;

    const updated = messages.filter((_, index) => index !== currentIndex);
    setMessages(updated);

    if (updated.length === 0) {
      setCurrentIndex(0);
      return;
    }

    if (currentIndex >= updated.length) {
      setCurrentIndex(updated.length - 1);
    }
  };

  const handleOpenEditBox = () => {
    if (messages.length === 0) return;
    setEditMessage(messages[currentIndex]);
    setShowEditBox(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editMessage.trim();
    if (!trimmed || messages.length === 0) return;

    const updated = [...messages];
    updated[currentIndex] = trimmed;
    setMessages(updated);
    setShowEditBox(false);
    setEditMessage("");
  };

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-[#e6d6b8]">
      <img
        src={imageSrc}
        alt={imageAlt}
        className="h-full w-full object-fill"
      />

      <Link
        href="/sections/messages"
        className="absolute left-6 top-6 z-50 inline-block rounded-full bg-black px-4 py-2 text-white"
      >
        ← Back to Messages Room
      </Link>

      <div ref={frameRef} className="absolute inset-0">
        <div className="absolute left-1/2 top-[46%] z-40 w-[36%] max-w-[36%] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/80 p-6 shadow-lg backdrop-blur">
          <p className="break-words whitespace-pre-wrap text-lg leading-relaxed text-stone-800">
            {messages.length > 0 ? messages[currentIndex] : emptyText}
          </p>
        </div>
      </div>

      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-sm text-stone-600">
        {messages.length > 0
          ? `Message ${currentIndex + 1} of ${messages.length}`
          : "0 / 0"}
      </div>

      <div className="absolute bottom-10 left-1/2 z-40 flex -translate-x-1/2 gap-4">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0 || messages.length === 0}
          className="rounded-full bg-black px-6 py-3 text-white disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          Previous
        </button>

        <button
          onClick={handleNext}
          disabled={currentIndex === messages.length - 1 || messages.length === 0}
          className="rounded-full bg-black px-6 py-3 text-white disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          Next
        </button>

        <button
          onClick={handleDownload}
          className="rounded-full bg-black px-6 py-3 text-white"
        >
          Download
        </button>
      </div>

      {showAdminControls && (
        <>
          {showAddBox && (
            <div className="absolute bottom-32 left-1/2 z-50 w-[560px] max-w-[90%] -translate-x-1/2 rounded-2xl bg-black/85 p-4 text-white shadow-xl">
              <p className="mb-3 font-semibold">{addLabel}</p>

              <textarea
                rows={4}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Write the new message here..."
                className="w-full rounded-xl border border-white/20 bg-white p-3 text-black outline-none"
              />

              <div className="mt-3 flex gap-3">
                <button
                  onClick={handleAddMessage}
                  className="rounded bg-white px-4 py-2 text-black"
                >
                  Save Message
                </button>

                <button
                  onClick={() => {
                    setShowAddBox(false);
                    setNewMessage("");
                  }}
                  className="rounded bg-red-500 px-4 py-2 text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showEditBox && (
            <div className="absolute bottom-32 left-1/2 z-50 w-[560px] max-w-[90%] -translate-x-1/2 rounded-2xl bg-black/85 p-4 text-white shadow-xl">
              <p className="mb-3 font-semibold">{editLabel}</p>

              <textarea
                rows={4}
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                placeholder="Edit the current message..."
                className="w-full rounded-xl border border-white/20 bg-white p-3 text-black outline-none"
              />

              <div className="mt-3 flex gap-3">
                <button
                  onClick={handleSaveEdit}
                  className="rounded bg-white px-4 py-2 text-black"
                >
                  Save Changes
                </button>

                <button
                  onClick={() => {
                    setShowEditBox(false);
                    setEditMessage("");
                  }}
                  className="rounded bg-red-500 px-4 py-2 text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-black/80 px-6 py-4 text-white shadow-lg">
            <div className="flex flex-wrap justify-center gap-4">
              <button
                onClick={() => setShowAddBox(true)}
                className="rounded bg-white px-3 py-2 text-black"
              >
                Add Message
              </button>

              <button
                onClick={handleOpenEditBox}
                className="rounded bg-white px-3 py-2 text-black"
              >
                Edit Current
              </button>

              <button
                onClick={handleDeleteCurrent}
                className="rounded bg-white px-3 py-2 text-black"
              >
                Delete Current
              </button>

              <button
                onClick={() => {
                  localStorage.removeItem("adminRole");
                  localStorage.removeItem("adminRoom");
                  window.location.reload();
                }}
                className="rounded bg-red-500 px-3 py-2 text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}