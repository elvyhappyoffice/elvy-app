"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";

type StoryItem = {
  id: number;
  title: string;
  text: string;
  music?: string;
};

type StoryTitlePageProps = {
  storageKey: string;
  imageSrc: string;
  imageAlt: string;
  emptyTitle: string;
  emptyText: string;
  addLabel: string;
  editLabel: string;
  downloadFileName: string;
};

export default function StoryTitlePage({
  storageKey,
  imageSrc,
  imageAlt,
  emptyTitle,
  emptyText,
  addLabel,
  editLabel,
  downloadFileName,
}: StoryTitlePageProps) {
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [role, setRole] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [showAddBox, setShowAddBox] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [newMusic, setNewMusic] = useState("");

  const [showEditBox, setShowEditBox] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [editMusic, setEditMusic] = useState("");

  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRole(localStorage.getItem("adminRole"));
    setRoom(localStorage.getItem("adminRoom"));

    const savedStories = localStorage.getItem(storageKey);

    if (savedStories) {
      try {
        const parsed = JSON.parse(savedStories);
        if (Array.isArray(parsed)) {
          setStories(parsed);
        } else {
          setStories([]);
          localStorage.setItem(storageKey, JSON.stringify([]));
        }
      } catch {
        setStories([]);
        localStorage.setItem(storageKey, JSON.stringify([]));
      }
    } else {
      setStories([]);
      localStorage.setItem(storageKey, JSON.stringify([]));
    }

    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(storageKey, JSON.stringify(stories));
  }, [stories, ready, storageKey]);

  const showAdminControls =
    ready &&
    (role === "founder" || (role === "room_admin" && room === "stories"));

  const currentStory = stories.length > 0 ? stories[currentIndex] : null;

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
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleMusicUpload = (e: ChangeEvent<HTMLInputElement>, mode: "add" | "edit") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (mode === "add") {
        setNewMusic(result);
      } else {
        setEditMusic(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddStory = () => {
    const cleanTitle = newTitle.trim();
    const cleanText = newText.trim();

    if (!cleanTitle || !cleanText) return;

    const newStory: StoryItem = {
      id: Date.now(),
      title: cleanTitle,
      text: cleanText,
      music: newMusic || "",
    };

    const updatedStories = [...stories, newStory];
    setStories(updatedStories);
    setCurrentIndex(updatedStories.length - 1);

    setNewTitle("");
    setNewText("");
    setNewMusic("");
    setShowAddBox(false);
  };

  const handleDeleteCurrent = () => {
    if (stories.length === 0) return;

    const updated = stories.filter((_, index) => index !== currentIndex);
    setStories(updated);

    if (updated.length === 0) {
      setCurrentIndex(0);
      return;
    }

    if (currentIndex >= updated.length) {
      setCurrentIndex(updated.length - 1);
    }
  };

  const handleOpenEditBox = () => {
    if (!currentStory) return;

    setEditTitle(currentStory.title);
    setEditText(currentStory.text);
    setEditMusic(currentStory.music || "");
    setShowEditBox(true);
  };

  const handleSaveEdit = () => {
    if (!currentStory) return;

    const cleanTitle = editTitle.trim();
    const cleanText = editText.trim();

    if (!cleanTitle || !cleanText) return;

    const updated = [...stories];
    updated[currentIndex] = {
      ...currentStory,
      title: cleanTitle,
      text: cleanText,
      music: editMusic || "",
    };

    setStories(updated);
    setShowEditBox(false);
    setEditTitle("");
    setEditText("");
    setEditMusic("");
  };

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-[#e6d6b8]">
      <img
        src={imageSrc}
        alt={imageAlt}
        className="h-full w-full object-fill"
      />

      <Link
        href="/sections/stories"
        className="absolute left-6 top-6 z-50 inline-block rounded-full bg-black px-4 py-2 text-white"
      >
        ← Back to Stories Room
      </Link>

      <div ref={frameRef} className="absolute inset-0">
        <div className="absolute left-1/2 top-[46%] z-40 w-[38%] max-w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white/80 p-6 shadow-lg backdrop-blur">
          <h2 className="mb-4 text-center text-2xl font-bold text-stone-900">
            {currentStory ? currentStory.title : emptyTitle}
          </h2>

          <p className="break-words whitespace-pre-wrap text-lg leading-relaxed text-stone-800">
            {currentStory ? currentStory.text : emptyText}
          </p>

          {currentStory?.music && (
            <div className="mt-5">
              <audio controls className="w-full">
                <source src={currentStory.music} />
              </audio>
            </div>
          )}
        </div>
      </div>

      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-sm text-stone-600">
        {stories.length > 0
          ? `Story ${currentIndex + 1} of ${stories.length}`
          : "0 / 0"}
      </div>

      <div className="absolute bottom-10 left-1/2 z-40 flex -translate-x-1/2 gap-4">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0 || stories.length === 0}
          className="rounded-full bg-black px-6 py-3 text-white disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          Previous
        </button>

        <button
          onClick={handleNext}
          disabled={currentIndex === stories.length - 1 || stories.length === 0}
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
            <div className="absolute bottom-32 left-1/2 z-50 w-[640px] max-w-[92%] -translate-x-1/2 rounded-2xl bg-black/85 p-4 text-white shadow-xl">
              <p className="mb-3 font-semibold">{addLabel}</p>

              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Story title..."
                className="mb-3 w-full rounded-xl border border-white/20 bg-white p-3 text-black outline-none"
              />

              <textarea
                rows={6}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Write the story here..."
                className="w-full rounded-xl border border-white/20 bg-white p-3 text-black outline-none"
              />

              <div className="mt-3">
                <label className="mb-2 block text-sm">Add music</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleMusicUpload(e, "add")}
                  className="block w-full text-sm"
                />
                {newMusic && (
                  <audio controls className="mt-3 w-full">
                    <source src={newMusic} />
                  </audio>
                )}
              </div>

              <div className="mt-3 flex gap-3">
                <button
                  onClick={handleAddStory}
                  className="rounded bg-white px-4 py-2 text-black"
                >
                  Save Story
                </button>

                <button
                  onClick={() => {
                    setShowAddBox(false);
                    setNewTitle("");
                    setNewText("");
                    setNewMusic("");
                  }}
                  className="rounded bg-red-500 px-4 py-2 text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {showEditBox && (
            <div className="absolute bottom-32 left-1/2 z-50 w-[640px] max-w-[92%] -translate-x-1/2 rounded-2xl bg-black/85 p-4 text-white shadow-xl">
              <p className="mb-3 font-semibold">{editLabel}</p>

              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Story title..."
                className="mb-3 w-full rounded-xl border border-white/20 bg-white p-3 text-black outline-none"
              />

              <textarea
                rows={6}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Edit the story here..."
                className="w-full rounded-xl border border-white/20 bg-white p-3 text-black outline-none"
              />

              <div className="mt-3">
                <label className="mb-2 block text-sm">Change music</label>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleMusicUpload(e, "edit")}
                  className="block w-full text-sm"
                />
                {editMusic && (
                  <audio controls className="mt-3 w-full">
                    <source src={editMusic} />
                  </audio>
                )}
              </div>

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
                    setEditTitle("");
                    setEditText("");
                    setEditMusic("");
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
                Add Story
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