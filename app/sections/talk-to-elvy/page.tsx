"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";

type RoomStatus = "open" | "busy" | "closed";

type Topic = {
  id: string;
  name: string;
  description: string;
  isOpen: boolean;
  repliesIncluded: number;
  sortOrder: number;
};

type AdminSettings = {
  roomStatus: RoomStatus;
  inputLimit: number;
  outputLimit: number;
  maxLiveUsers: number;
  dailyFreeRepliesPerUser: number;
  totalFreeRepliesRoom: number;
  oneUsePerDay: boolean;
};

const TOPICS_STORAGE_KEY = "talk_to_elvy_topics";
const FREE_USAGE_STORAGE_KEY = "talk_to_elvy_free_usage";
const SETTINGS_STORAGE_KEY = "talk_to_elvy_settings";
const ROOM_TOTAL_FREE_KEY = "talk_to_elvy_total_free_used";
const today = new Date().toISOString().slice(0, 10);
const visitorKey = `talk_to_elvy_visitor_${today}`;

const defaultTopics: Topic[] = [
  {
    id: "daily-check-in",
    name: "Daily Check-in",
    description: "A calm moment to see how your day is going.",
    isOpen: true,
    repliesIncluded: 3,
    sortOrder: 1,
  },
  {
    id: "simple-plan",
    name: "Simple Plan",
    description: "Help organize one or two simple steps.",
    isOpen: true,
    repliesIncluded: 3,
    sortOrder: 2,
  },
  {
    id: "remember-something",
    name: "Remember Something",
    description: "Help keep something important clear.",
    isOpen: true,
    repliesIncluded: 3,
    sortOrder: 3,
  },
  {
    id: "write-to-someone",
    name: "Write to Someone",
    description: "Help write a short and kind message.",
    isOpen: true,
    repliesIncluded: 3,
    sortOrder: 4,
  },
];

const defaultSettings: AdminSettings = {
  roomStatus: "open",
  inputLimit: 150,
  outputLimit: 200,
  maxLiveUsers: 5,
  dailyFreeRepliesPerUser: 3,
  totalFreeRepliesRoom: 100,
  oneUsePerDay: true,
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sortTopics(topics: Topic[]) {
  return [...topics].sort((a, b) => a.sortOrder - b.sortOrder);
}

function createSuggestedReply(selectedTopic: string, userMessage: string, limit: number) {
  let reply = "";

  if (selectedTopic === "Daily Check-in") {
    reply = `You said:
${userMessage}

Elvy:
I’m here with you. Let’s keep this simple. What is the most important thing for you right now?`;
  } else if (selectedTopic === "Simple Plan") {
    reply = `You said:
${userMessage}

Elvy:
Let’s choose one small step first. After that, we can decide what comes next.`;
  } else if (selectedTopic === "Remember Something") {
    reply = `You said:
${userMessage}

Elvy:
I can help you keep this clear. Let’s make it short and easy to remember.`;
  } else if (selectedTopic === "Write to Someone") {
    reply = `You said:
${userMessage}

Elvy:
Here is a calm way to say it: I wanted to share this with you clearly and kindly.`;
  } else {
    reply = `You said:
${userMessage}

Elvy:
I’m here. Let’s keep it simple and take one small step.`;
  }

  return reply.slice(0, limit);
}

export default function TalkToElvyPage() {
  const [topics, setTopics] = useState<Topic[]>(defaultTopics);
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);
  const [freeUsage, setFreeUsage] = useState<Record<string, number>>({});
  const [roomTotalFreeUsed, setRoomTotalFreeUsed] = useState(0);

  const [showTopics, setShowTopics] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [reply, setReply] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [liveUsers, setLiveUsers] = useState(1);

  const [todayCost, setTodayCost] = useState(0);
  const [monthlyCost, setMonthlyCost] = useState(0);

  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDescription, setNewTopicDescription] = useState("");
  const [newTopicReplies, setNewTopicReplies] = useState(3);

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState("");
  const [editTopicDescription, setEditTopicDescription] = useState("");
  const [editTopicIsOpen, setEditTopicIsOpen] = useState(true);
  const [editTopicReplies, setEditTopicReplies] = useState(3);
  const [editTopicSortOrder, setEditTopicSortOrder] = useState(1);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const savedTopics = safeParse<Topic[]>(
      localStorage.getItem(TOPICS_STORAGE_KEY),
      defaultTopics
    );

    const savedFreeUsage = safeParse<Record<string, number>>(
      localStorage.getItem(FREE_USAGE_STORAGE_KEY),
      {}
    );

    const savedSettings = safeParse<AdminSettings>(
      localStorage.getItem(SETTINGS_STORAGE_KEY),
      defaultSettings
    );

    const savedRoomTotal = Number(localStorage.getItem(ROOM_TOTAL_FREE_KEY) || "0");

    setTopics(sortTopics(savedTopics));
    setFreeUsage(savedFreeUsage);
    setSettings(savedSettings);
    setRoomTotalFreeUsed(savedRoomTotal);

    const role = localStorage.getItem("adminRole");
    const room = localStorage.getItem("adminRoom");

    setIsAdmin(
      role === "founder" || (role === "admin" && room === "talk-to-elvy")
    );
  }, []);
useEffect(() => {
  const savedRole = localStorage.getItem("adminRole");
  setRole(savedRole);
}, []);
  useEffect(() => {
    localStorage.setItem(TOPICS_STORAGE_KEY, JSON.stringify(sortTopics(topics)));
  }, [topics]);

  useEffect(() => {
    localStorage.setItem(FREE_USAGE_STORAGE_KEY, JSON.stringify(freeUsage));
  }, [freeUsage]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(ROOM_TOTAL_FREE_KEY, String(roomTotalFreeUsed));
  }, [roomTotalFreeUsed]);

  const openTopics = useMemo(
    () => sortTopics(topics.filter((topic) => topic.isOpen)),
    [topics]
  );

  const selectedTopicData = useMemo(
    () => topics.find((topic) => topic.name === selectedTopic) || null,
    [topics, selectedTopic]
  );

  const visitorUsedToday = freeUsage[visitorKey] || 0;

  const topicRepliesLeft = useMemo(() => {
    if (!selectedTopicData) return 0;
    const used = freeUsage[`${visitorKey}_${selectedTopicData.id}`] || 0;
    return Math.max(selectedTopicData.repliesIncluded - used, 0);
  }, [selectedTopicData, freeUsage]);

  const dailyRepliesLeft = Math.max(
    settings.dailyFreeRepliesPerUser - visitorUsedToday,
    0
  );

  const roomRepliesLeft = Math.max(
    settings.totalFreeRepliesRoom - roomTotalFreeUsed,
    0
  );

  const roomMessage = useMemo(() => {
    if (isAdmin) return "";

    if (settings.roomStatus === "closed") {
      return "This room is closed now. Please come back later.";
    }

    if (settings.roomStatus === "busy") {
      return "The room is busy now. Please wait a few minutes.";
    }

    if (liveUsers > settings.maxLiveUsers) {
      return "The room is full now. Please try again shortly.";
    }

    if (settings.oneUsePerDay && visitorUsedToday >= settings.dailyFreeRepliesPerUser) {
      return "You have used your free trial replies for today. Please come back tomorrow or continue in Daily Support.";
    }

    if (roomTotalFreeUsed >= settings.totalFreeRepliesRoom) {
      return "Free replies are temporarily finished. Please come back later or continue in Daily Support.";
    }

    return "";
  }, [
    isAdmin,
    settings.roomStatus,
    settings.maxLiveUsers,
    settings.oneUsePerDay,
    settings.dailyFreeRepliesPerUser,
    settings.totalFreeRepliesRoom,
    liveUsers,
    visitorUsedToday,
    roomTotalFreeUsed,
  ]);

  function selectTopic(topicName: string) {
    setSelectedTopic(topicName);
    setShowTopics(false);
    setReply("");
    setUserMessage("");
    setLastUserMessage("");
  }

  function handleSendToElvy() {
    if (!selectedTopic || !userMessage.trim() || !selectedTopicData) return;

    const topicUsed = freeUsage[`${visitorKey}_${selectedTopicData.id}`] || 0;

    if (settings.oneUsePerDay && visitorUsedToday >= settings.dailyFreeRepliesPerUser) {
      setReply("You have used your free trial replies for today. Please come back tomorrow.");
      return;
    }

    if (roomTotalFreeUsed >= settings.totalFreeRepliesRoom) {
      setReply("Free replies are temporarily finished. Please come back later.");
      return;
    }

    if (topicUsed >= selectedTopicData.repliesIncluded) {
      setReply("You have used the free replies for this topic today.");
      return;
    }

    setIsThinking(true);
    setReply("");

    setTimeout(() => {
      const finalReply = createSuggestedReply(
        selectedTopic,
        userMessage,
        settings.outputLimit
      );

      setLastUserMessage(userMessage);
      setReply(finalReply);

      setFreeUsage((prev) => ({
        ...prev,
        [visitorKey]: (prev[visitorKey] || 0) + 1,
        [`${visitorKey}_${selectedTopicData.id}`]:
          (prev[`${visitorKey}_${selectedTopicData.id}`] || 0) + 1,
      }));

      setRoomTotalFreeUsed((prev) => prev + 1);

      const estimatedCost = 0.002;
      setTodayCost((prev) => Number((prev + estimatedCost).toFixed(4)));
      setMonthlyCost((prev) => Number((prev + estimatedCost).toFixed(4)));

      setIsThinking(false);
    }, 900);
  }

  function handleCopyReply() {
    if (!reply.trim()) return;
    navigator.clipboard.writeText(reply);
    alert("Reply copied.");
  }

  function handleDownloadDoc() {
    if (!reply.trim()) return;

    const content = `
<html>
<head>
<meta charset="utf-8" />
<title>Elvy Reply</title>
</head>
<body style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6;">
  <h2>Elvy Reply</h2>
  <p><strong>Happy Office — Talk to Elvy</strong></p>
  <hr />
  <pre style="white-space: pre-wrap;">${reply}</pre>
</body>
</html>
`;

    const blob = new Blob([content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "elvy-reply.doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleDownloadPDF() {
    if (!reply.trim()) return;

    const doc = new jsPDF();
    const margin = 15;
    const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Elvy Reply", margin, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Happy Office — Talk to Elvy", margin, 28);

    doc.setFontSize(12);
    const lines = doc.splitTextToSize(reply, maxWidth);

    let y = 42;
    for (const line of lines) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 7;
    }

    doc.save("elvy-reply.pdf");
  }

  function handleLogout() {
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminRoom");
    localStorage.removeItem("adminUsername");
    setIsAdmin(false);
    setShowAdminDashboard(false);
  }

  function addTopic() {
    const cleanName = newTopicName.trim();
    const cleanDescription = newTopicDescription.trim();

    if (!cleanName) return;

    const created: Topic = {
      id: `topic_${Date.now()}`,
      name: cleanName,
      description: cleanDescription,
      isOpen: true,
      repliesIncluded: Math.max(1, newTopicReplies),
      sortOrder: topics.length + 1,
    };

    setTopics((prev) => sortTopics([...prev, created]));
    setNewTopicName("");
    setNewTopicDescription("");
    setNewTopicReplies(3);
  }

  function startEditTopic(topic: Topic) {
    setEditingTopicId(topic.id);
    setEditTopicName(topic.name);
    setEditTopicDescription(topic.description);
    setEditTopicIsOpen(topic.isOpen);
    setEditTopicReplies(topic.repliesIncluded);
    setEditTopicSortOrder(topic.sortOrder);
  }

  function saveEditedTopic() {
    if (!editingTopicId) return;

    setTopics((prev) =>
      sortTopics(
        prev.map((topic) =>
          topic.id === editingTopicId
            ? {
                ...topic,
                name: editTopicName.trim() || topic.name,
                description: editTopicDescription.trim(),
                isOpen: editTopicIsOpen,
                repliesIncluded: Math.max(1, editTopicReplies),
                sortOrder: Math.max(1, editTopicSortOrder),
              }
            : topic
        )
      )
    );

    setEditingTopicId(null);
  }

  function deleteTopic(topicId: string) {
    setTopics((prev) => prev.filter((topic) => topic.id !== topicId));

    if (selectedTopicData?.id === topicId) {
      setSelectedTopic("");
      setReply("");
      setUserMessage("");
      setLastUserMessage("");
    }
  }

  function resetFreeUsage() {
    setFreeUsage({});
    setRoomTotalFreeUsed(0);
    localStorage.removeItem(FREE_USAGE_STORAGE_KEY);
    localStorage.removeItem(ROOM_TOTAL_FREE_KEY);
  }

  return (
    <main
      className="relative min-h-screen w-full bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/images/talk-to-elvy.png')" }}
    >
      <div className="absolute inset-0 bg-white/10" />

      <div className="relative z-10 min-h-screen px-6 py-6">
{role === "founder" ? (
  <button
    onClick={() => {
      window.location.href = "/founder/dashboard";
    }}
    className="absolute left-[2%] top-[4%] z-30 rounded-full bg-black px-6 py-3 text-white"
  >
    ← Back to Dashboard
  </button>
) : (
  <Link
    href="/happy-office"
    className="absolute left-[2%] top-[4%] z-30 rounded-full bg-black px-6 py-3 text-white"
  >
    ← Back to Happy Office
  </Link>
)}

        {isAdmin && (
          <div className="absolute right-6 top-6 z-50 flex gap-2">
            <button
              onClick={() => setShowAdminDashboard(true)}
              className="rounded-full bg-black px-4 py-2 text-white"
            >
              Open Controls
            </button>

            <button
              onClick={handleLogout}
              className="rounded-full bg-red-600 px-4 py-2 text-white hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        )}

        <div className="absolute left-1/2 top-0 -translate-x-1/2 text-center">
          <p className="rounded-lg bg-white/60 px-6 py-2 text-lg font-medium text-stone-800 backdrop-blur">
            Please choose from the list, then write a short message to Elvy.
          </p>
        </div>

        {roomMessage && (
          <div className="absolute left-1/2 top-[28%] w-[430px] -translate-x-1/2 rounded-2xl bg-yellow-100 p-5 text-center text-stone-800 shadow-xl">
            <p className="mb-4">{roomMessage}</p>
            <Link
              href="/sections/daily-support"
              className="inline-block rounded-xl bg-green-700 px-4 py-2 text-white"
            >
              Continue in Daily Support
            </Link>
          </div>
        )}

        {!roomMessage && (
          <>
            <div className="absolute left-[56.5%] top-[10%] w-[470px] -translate-x-1/2">
              <div className="rounded-2xl bg-white/75 p-5 shadow-lg backdrop-blur">
                <h2 className="mb-3 text-center font-semibold">Elvy Reply</h2>

                <div className="min-h-[250px] max-h-[340px] overflow-y-auto whitespace-pre-line rounded-lg bg-white/80 p-4 text-gray-700">
                  {isThinking
                    ? "Elvy is preparing a calm reply..."
                    : reply || "Elvy’s reply will appear here."}
                </div>

                <div className="mt-4 flex justify-center gap-4 text-sm">
                  <button
                    onClick={handleCopyReply}
                    disabled={!reply.trim() || isThinking}
                    className="rounded bg-black px-3 py-1 text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                  >
                    Copy
                  </button>

                  <button
                    onClick={handleDownloadPDF}
                    disabled={!reply.trim() || isThinking}
                    className="rounded bg-black px-3 py-1 text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                  >
                    PDF
                  </button>

                  <button
                    onClick={handleDownloadDoc}
                    disabled={!reply.trim() || isThinking}
                    className="rounded bg-black px-3 py-1 text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                  >
                    DOC
                  </button>
                </div>
              </div>
            </div>

            <div className="absolute right-[3.5%] top-[10%] w-[310px]">
              <div className="rounded-2xl bg-white/85 p-4 shadow-lg backdrop-blur">
                <h2 className="mb-2 font-semibold">Your Message</h2>

                {selectedTopic ? (
                  <p className="mt-1 text-sm text-stone-700">
                    Selected: <span className="font-medium">{selectedTopic}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-red-600">
                    Please select from the list first.
                  </p>
                )}

                {selectedTopicData && (
                  <div className="mt-1 text-xs text-stone-600">
                    <p>Topic replies left: {topicRepliesLeft}</p>
                    <p>Daily replies left: {dailyRepliesLeft}</p>
                    <p>Room free replies left: {roomRepliesLeft}</p>
                  </div>
                )}

                <textarea
                  value={userMessage}
                  onChange={(e) => {
                    if (e.target.value.length <= settings.inputLimit) {
                      setUserMessage(e.target.value);
                    }
                  }}
                  placeholder={
                    selectedTopic
                      ? "Write a short message..."
                      : "Select a topic first..."
                  }
                  disabled={!selectedTopic || isThinking}
                  className="mb-2 mt-3 h-40 w-full rounded border p-2 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
                />

                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-stone-600">Keep it short and clear.</span>
                  <span
                    className={
                      userMessage.length > settings.inputLimit - 30
                        ? "text-red-600"
                        : "text-stone-600"
                    }
                  >
                    {userMessage.length}/{settings.inputLimit}
                  </span>
                </div>

                <button
                  onClick={handleSendToElvy}
                  disabled={!selectedTopic || !userMessage.trim() || isThinking}
                  className="w-full rounded bg-black p-2 text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                >
                  {isThinking ? "Processing..." : "Send to Elvy"}
                </button>

                {lastUserMessage && (
                  <div className="mt-4 rounded-xl bg-stone-100 p-3 text-sm text-stone-700">
                    <div className="mb-1 font-semibold">You wrote:</div>
                    <div>{lastUserMessage}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 z-30 w-full">
              <div className="flex flex-col items-center pb-4">
                {showTopics && (
                  <div className="mb-3 flex max-w-4xl flex-wrap justify-center gap-3 rounded-xl bg-white/90 p-3 shadow-lg">
                    {openTopics.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => selectTopic(item.name)}
                        className="rounded-lg bg-stone-100 px-4 py-2 text-sm text-stone-800 hover:bg-black hover:text-white"
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setShowTopics(!showTopics)}
                  className="w-80 bg-black py-3 text-center text-white"
                >
                  {showTopics ? "Hide list" : "Please select from the list"}
                </button>
              </div>
            </div>
          </>
        )}

        {isAdmin && showAdminDashboard && (
          <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/50 p-4">
            <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">
                    Talk to Elvy Control Center
                  </h2>
                  <p className="text-sm text-stone-600">
                    Admin controls are hidden from visitors.
                  </p>
                </div>

                <button
                  onClick={() => setShowAdminDashboard(false)}
                  className="rounded bg-black px-4 py-2 text-white"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border bg-stone-50 p-4">
                  <h3 className="mb-3 text-lg font-semibold">Room Settings</h3>

                  <label className="mb-2 block text-sm">Room status</label>
                  <select
                    value={settings.roomStatus}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        roomStatus: e.target.value as RoomStatus,
                      })
                    }
                    className="mb-4 w-full rounded border p-2"
                  >
                    <option value="open">Open</option>
                    <option value="busy">Busy</option>
                    <option value="closed">Closed</option>
                  </select>

                  <label className="mb-2 block text-sm">Input character limit</label>
                  <input
                    type="number"
                    value={settings.inputLimit}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        inputLimit: Math.max(20, Number(e.target.value)),
                      })
                    }
                    className="mb-4 w-full rounded border p-2"
                  />

                  <label className="mb-2 block text-sm">Output reply limit</label>
                  <input
                    type="number"
                    value={settings.outputLimit}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        outputLimit: Math.max(20, Number(e.target.value)),
                      })
                    }
                    className="mb-4 w-full rounded border p-2"
                  />

                  <label className="mb-2 block text-sm">Max live users</label>
                  <input
                    type="number"
                    value={settings.maxLiveUsers}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxLiveUsers: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="mb-4 w-full rounded border p-2"
                  />

                  <label className="mb-2 block text-sm">
                    Daily free replies per user
                  </label>
                  <input
                    type="number"
                    value={settings.dailyFreeRepliesPerUser}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        dailyFreeRepliesPerUser: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="mb-4 w-full rounded border p-2"
                  />

                  <label className="mb-2 block text-sm">
                    Total free replies for room
                  </label>
                  <input
                    type="number"
                    value={settings.totalFreeRepliesRoom}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        totalFreeRepliesRoom: Math.max(1, Number(e.target.value)),
                      })
                    }
                    className="mb-4 w-full rounded border p-2"
                  />

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.oneUsePerDay}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          oneUsePerDay: e.target.checked,
                        })
                      }
                    />
                    Limit same visitor per day
                  </label>
                </div>

                <div className="rounded-xl border bg-stone-50 p-4">
                  <h3 className="mb-3 text-lg font-semibold">Usage Monitor</h3>

                  <p className="text-sm">Cost per message: $0.002</p>
                  <p className="text-sm">Today total: ${todayCost}</p>
                  <p className="text-sm">Monthly total: ${monthlyCost}</p>

                  <h3 className="mb-3 mt-6 text-lg font-semibold">Live Users</h3>
                  <p className="mb-2 text-sm">Active now: {liveUsers}</p>

                  <input
                    type="number"
                    value={liveUsers}
                    onChange={(e) => setLiveUsers(Math.max(1, Number(e.target.value)))}
                    className="mb-4 w-full rounded border p-2"
                  />

                  <h3 className="mb-3 mt-6 text-lg font-semibold">Free Usage</h3>
                  <p className="text-sm">
                    Room free replies used: {roomTotalFreeUsed}/
                    {settings.totalFreeRepliesRoom}
                  </p>
                  <p className="text-sm">
                    Current visitor used today: {visitorUsedToday}/
                    {settings.dailyFreeRepliesPerUser}
                  </p>

                  <button
                    onClick={resetFreeUsage}
                    className="mt-4 rounded bg-red-600 px-4 py-2 text-white"
                  >
                    Reset Free Usage
                  </button>
                </div>

                <div className="rounded-xl border bg-stone-50 p-4 md:col-span-2">
                  <h3 className="mb-3 text-lg font-semibold">Add Topic</h3>

                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      value={newTopicName}
                      onChange={(e) => setNewTopicName(e.target.value)}
                      placeholder="Topic name"
                      className="rounded border p-2"
                    />

                    <input
                      value={newTopicDescription}
                      onChange={(e) => setNewTopicDescription(e.target.value)}
                      placeholder="Description"
                      className="rounded border p-2"
                    />

                    <input
                      type="number"
                      value={newTopicReplies}
                      onChange={(e) => setNewTopicReplies(Number(e.target.value))}
                      placeholder="Free replies"
                      className="rounded border p-2"
                    />
                  </div>

                  <button
                    onClick={addTopic}
                    className="mt-3 rounded bg-black px-4 py-2 text-white"
                  >
                    Add Topic
                  </button>
                </div>

                <div className="rounded-xl border bg-stone-50 p-4 md:col-span-2">
                  <h3 className="mb-3 text-lg font-semibold">Topic Controls</h3>

                  <div className="space-y-3">
                    {sortTopics(topics).map((topic) => (
                      <div key={topic.id} className="rounded-xl border bg-white p-3">
                        {editingTopicId === topic.id ? (
                          <div className="grid gap-3 md:grid-cols-5">
                            <input
                              value={editTopicName}
                              onChange={(e) => setEditTopicName(e.target.value)}
                              className="rounded border p-2"
                            />

                            <input
                              value={editTopicDescription}
                              onChange={(e) =>
                                setEditTopicDescription(e.target.value)
                              }
                              className="rounded border p-2"
                            />

                            <input
                              type="number"
                              value={editTopicReplies}
                              onChange={(e) =>
                                setEditTopicReplies(Number(e.target.value))
                              }
                              className="rounded border p-2"
                            />

                            <input
                              type="number"
                              value={editTopicSortOrder}
                              onChange={(e) =>
                                setEditTopicSortOrder(Number(e.target.value))
                              }
                              className="rounded border p-2"
                            />

                            <label className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editTopicIsOpen}
                                onChange={(e) =>
                                  setEditTopicIsOpen(e.target.checked)
                                }
                              />
                              Open
                            </label>

                            <button
                              onClick={saveEditedTopic}
                              className="rounded bg-green-700 px-3 py-2 text-white"
                            >
                              Save
                            </button>

                            <button
                              onClick={() => setEditingTopicId(null)}
                              className="rounded bg-stone-500 px-3 py-2 text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{topic.name}</div>
                              <div className="text-sm text-stone-600">
                                {topic.description}
                              </div>
                              <div className="mt-1 text-xs text-stone-600">
                                Replies: {topic.repliesIncluded} •{" "}
                                {topic.isOpen ? "Open" : "Closed"} • Order:{" "}
                                {topic.sortOrder}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => startEditTopic(topic)}
                                className="rounded bg-blue-600 px-2 py-1 text-xs text-white"
                              >
                                Edit
                              </button>

                              <button
                                onClick={() =>
                                  setTopics((prev) =>
                                    prev.map((item) =>
                                      item.id === topic.id
                                        ? { ...item, isOpen: !item.isOpen }
                                        : item
                                    )
                                  )
                                }
                                className="rounded bg-stone-700 px-2 py-1 text-xs text-white"
                              >
                                {topic.isOpen ? "Close" : "Open"}
                              </button>

                              <button
                                onClick={() => deleteTopic(topic.id)}
                                className="rounded bg-red-700 px-2 py-1 text-xs text-white"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}