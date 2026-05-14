"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";

type UserStatus =
  | "Visitor"
  | "Pending"
  | "Setup Sent"
  | "In Chat"
  | "Active"
  | "Suspended"
  | "Blocked";

type MemoryReminder = {
  task: string;
  time?: string;
  day?: string;
  frequency?: string;
  createdAt: string;
};

type UserMemory = {
  reminders: MemoryReminder[];
  preferences: {
    preferredTime?: string;
    preferredChannel?: string;
    messageStyle?: string;
  };
  patterns: string[];
  notes: string[];
  lastIntent?: string;
  lastUpdated?: string;
};

type SupportUser = {
  code: string;
  name: string;
  ageGroup: string;
  helpType: string;
  contactMethod: string;
  contactValue: string;
  status: UserStatus;
  repliesLimit: number;
  repliesUsed: number;
  aiCost: number;
  contactCost: number;
  startDate: string;
  endDate: string;
  adminMessages: string[];
  userMessages: string[];
  privateAdminMessages?: string[];
  privateUserMessages?: string[];
  setupAccessNumber?: string;
  telegramChatId?: string;
  needsAdminReply?: boolean;
  memory?: UserMemory;
};

const ROOM_KEY = "dailySupportRoomOpen";
const CODE_GEN_KEY = "dailySupportCodeGenerationOpen";
const MAX_USER_MESSAGE_LENGTH = 300;

const TELEGRAM_BOT_LINK = "https://t.me/happy_office_support_bot";

async function loadUsersFromServer(): Promise<SupportUser[]> {
  try {
    const res = await fetch("/api/daily-support-users", { cache: "no-store" });
    const data = await res.json();
    return data.users || [];
  } catch {
    return [];
  }
}

async function saveUsersToServer(users: SupportUser[]) {
  await fetch("/api/daily-support-users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ users }),
  });
}

function createEmptyMemory(): UserMemory {
  return {
    reminders: [],
    preferences: {},
    patterns: [],
    notes: [],
  };
}

function uniqueList(items: string[]) {
  return Array.from(new Set(items.filter(Boolean))).slice(-12);
}

function detectElvyIntent(message: string) {
  const text = message.toLowerCase();

  if (text.includes("remind") || text.includes("don't forget") || text.includes("appointment")) {
    return "reminder";
  }

  if (text.includes("routine") || text.includes("daily") || text.includes("schedule")) {
    return "routine";
  }

  if (text.includes("prefer") || text.includes("usually") || text.includes("as usual")) {
    return "preference";
  }

  if (text.includes("tired") || text.includes("stress") || text.includes("problem") || text.includes("worried")) {
    return "support";
  }

  if (text.includes("family") || text.includes("mother") || text.includes("father") || text.includes("child")) {
    return "family";
  }

  return "general";
}

function extractTime(message: string) {
  const timeMatch = message.match(/\b([01]?\d|2[0-3])(?::([0-5]\d))?\s?(am|pm)?\b/i);
  if (!timeMatch) return undefined;

  const hour = timeMatch[1];
  const minute = timeMatch[2] || "00";
  const period = timeMatch[3] ? ` ${timeMatch[3].toUpperCase()}` : "";
  return `${hour}:${minute}${period}`;
}

function extractDay(message: string) {
  const text = message.toLowerCase();
  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "tomorrow",
    "today",
  ];

  return days.find((day) => text.includes(day));
}

function extractFrequency(message: string) {
  const text = message.toLowerCase();

  if (text.includes("every day") || text.includes("daily")) return "daily";
  if (text.includes("every week") || text.includes("weekly")) return "weekly";
  if (text.includes("every month") || text.includes("monthly")) return "monthly";
  if (text.includes("every friday")) return "weekly-friday";

  return undefined;
}

function buildUpdatedMemory(user: SupportUser, message: string): UserMemory {
  const memory = user.memory || createEmptyMemory();
  const text = message.toLowerCase();
  const intent = detectElvyIntent(message);
  const now = new Date().toLocaleString();

  const nextMemory: UserMemory = {
    reminders: [...(memory.reminders || [])],
    preferences: { ...(memory.preferences || {}) },
    patterns: [...(memory.patterns || [])],
    notes: [...(memory.notes || [])],
    lastIntent: intent,
    lastUpdated: now,
  };

  if (intent === "reminder") {
    const cleanedTask = message
      .replace(/remind me to/i, "")
      .replace(/please/i, "")
      .trim();

    nextMemory.reminders = [
      ...nextMemory.reminders,
      {
        task: cleanedTask || message,
        time: extractTime(message),
        day: extractDay(message),
        frequency: extractFrequency(message),
        createdAt: now,
      },
    ].slice(-10);
  }

  if (text.includes("morning")) {
    nextMemory.preferences.preferredTime = "morning";
  } else if (text.includes("evening") || text.includes("night")) {
    nextMemory.preferences.preferredTime = "evening";
  }

  if (text.includes("short") || text.includes("simple")) {
    nextMemory.preferences.messageStyle = "short and simple";
  }

  if (intent === "support") {
    nextMemory.patterns = uniqueList([...nextMemory.patterns, "needs calm support"]);
  }

  if (intent === "family") {
    nextMemory.patterns = uniqueList([...nextMemory.patterns, "family-related support"]);
  }

  if (intent === "routine") {
    nextMemory.patterns = uniqueList([...nextMemory.patterns, "routine organization"]);
  }

  if (message.length <= MAX_USER_MESSAGE_LENGTH) {
    nextMemory.notes = uniqueList([...nextMemory.notes, `${intent}: ${message.slice(0, 90)}`]);
  }

  return nextMemory;
}

function getMemorySummary(memory?: UserMemory) {
  if (!memory) return "No memory yet";

  const parts = [];
  if (memory.reminders?.length) parts.push(`${memory.reminders.length} reminder(s)`);
  if (memory.preferences?.preferredTime) parts.push(`prefers ${memory.preferences.preferredTime}`);
  if (memory.patterns?.length) parts.push(memory.patterns.slice(-2).join(", "));

  return parts.length ? parts.join(" • ") : "Memory ready";
}

function getElvyMemoryReply(message: string, user: SupportUser, memory: UserMemory) {
  const intent = detectElvyIntent(message);
  const preferredTime = memory.preferences?.preferredTime;
  const lastReminder = memory.reminders?.[memory.reminders.length - 1];

  if (message.length > MAX_USER_MESSAGE_LENGTH) {
    return "That is a lot to carry at once. Let’s take one step together. Please share one short message so I can understand you clearly.";
  }

  if (message.toLowerCase().includes(" and ") || message.split("?").length > 2) {
    return "I see more than one thing here. Let’s begin with one. What matters most now?";
  }

  if (intent === "reminder") {
    if (!lastReminder?.time) {
      return preferredTime
        ? `I can help with that. Would you like it in the ${preferredTime}, as you usually prefer?`
        : "Of course. What time should I remember this for you?";
    }

    if (!lastReminder?.day && !lastReminder?.frequency) {
      return `I noted the time: ${lastReminder.time}. Should this be for today, tomorrow, or repeated?`;
    }

    return "I understand. I will keep this reminder clear and focused.";
  }

  if (intent === "routine") {
    return preferredTime
      ? `Let’s keep it simple. Since you prefer the ${preferredTime}, what is the first step you want to organize?`
      : "Let’s organize this gently. What is the first step you want to start with?";
  }

  if (intent === "preference") {
    return "I understand. I will keep this preference in mind while guiding you.";
  }

  if (intent === "support") {
    return "Let’s take one step together. What feels most important right now?";
  }

  if (intent === "family") {
    return "Family messages need care. What would you like to say or remember first?";
  }

  return `I understand, ${user.name}. Please share one clear thing you want help with now.`;
}

export default function DailySupportPage() {
  const [role, setRole] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const [users, setUsers] = useState<SupportUser[]>([]);
  const [roomOpen, setRoomOpen] = useState(true);
  const [codeGenerationOpen, setCodeGenerationOpen] = useState(true);

  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("18–30");
  const [contactMethod, setContactMethod] = useState("Telegram");
  const [contactValue, setContactValue] = useState("");

  const [activeCode, setActiveCode] = useState("");
  const [openedUser, setOpenedUser] = useState<SupportUser | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [openAdminChats, setOpenAdminChats] = useState<string[]>([]);
  const [adminReplyInputs, setAdminReplyInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    setRole(localStorage.getItem("adminRole"));
    setRoom(localStorage.getItem("adminRoom"));

    loadUsersFromServer().then((loadedUsers) => {
      setUsers(loadedUsers);
      setStorageReady(true);
    });

    const savedRoom = localStorage.getItem(ROOM_KEY);
    if (savedRoom !== null) setRoomOpen(savedRoom === "true");

    const savedCodeGen = localStorage.getItem(CODE_GEN_KEY);
    if (savedCodeGen !== null) setCodeGenerationOpen(savedCodeGen === "true");
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    const interval = window.setInterval(async () => {
      const latestUsers = await loadUsersFromServer();

      setUsers((currentUsers) => {
        const currentString = JSON.stringify(currentUsers);
        const latestString = JSON.stringify(latestUsers);

        if (currentString !== latestString) {
          return latestUsers;
        }

        return currentUsers;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [storageReady]);

  useEffect(() => {
    localStorage.setItem(ROOM_KEY, String(roomOpen));
  }, [roomOpen]);

  useEffect(() => {
    localStorage.setItem(CODE_GEN_KEY, String(codeGenerationOpen));
  }, [codeGenerationOpen]);

  const isAdmin = role === "founder" || (role === "admin" && room === "daily-support");

  function generateCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "ELVY-";

    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code;
  }

  function generateSetupNumber() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  function updateUser(code: string, changes: Partial<SupportUser>) {
    setUsers((prev) => {
      const updated = prev.map((u) => (u.code === code ? { ...u, ...changes } : u));
      saveUsersToServer(updated);
      return updated;
    });

    if (openedUser?.code === code) {
      setOpenedUser((prev) => (prev ? { ...prev, ...changes } : prev));
    }
  }

  async function sendTelegramMessage(message: string, chatId?: string) {
    const res = await fetch("/api/telegram/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        chatId,
      }),
    });

    return res.json();
  }

  async function syncTelegramUsers() {
    try {
      const res = await fetch("/api/telegram/send");
      const data = await res.json();

      if (!data.success) {
        alert("Telegram sync failed.");
        console.log(data);
        return;
      }

      setUsers((prev) => {
        const updated = prev.map((user) => {
          if (user.contactMethod !== "Telegram") return user;

          const userContact = user.contactValue.trim().toLowerCase();
          const normalizedUserContact = userContact.startsWith("@") ? userContact : `@${userContact}`;

          const match = data.users.find(
            (tg: any) => String(tg.username).trim().toLowerCase() === normalizedUserContact
          );

          if (!match) return user;

          return {
            ...user,
            telegramChatId: String(match.chatId),
          };
        });

        saveUsersToServer(updated);
        return updated;
      });

      alert("Telegram users synced successfully.");
    } catch (error) {
      console.log(error);
      alert("Telegram sync error.");
    }
  }

  async function createUser() {
    if (!roomOpen) {
      window.alert("Daily Support is currently closed. Please try again later.");
      return;
    }

    if (!codeGenerationOpen) {
      window.alert("Code generation is currently closed. Please try again later.");
      return;
    }

    if (!name.trim()) {
      window.alert("Please enter your name first.");
      return;
    }

    if (!contactValue.trim()) {
      window.alert("Please add your Telegram username first. Example: @username");
      return;
    }

    const today = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);

    const cleanTelegram = contactValue.trim().startsWith("@")
      ? contactValue.trim().toLowerCase()
      : `@${contactValue.trim().toLowerCase()}`;

    const newUser: SupportUser = {
      code: generateCode(),
      name: name.trim(),
      ageGroup,
      helpType: "General support",
      contactMethod,
      contactValue: contactMethod === "Telegram" ? cleanTelegram : contactValue.trim(),
      status: "Pending",
      repliesLimit: 100,
      repliesUsed: 0,
      aiCost: 0,
      contactCost: 0,
      startDate: today.toLocaleDateString(),
      endDate: end.toLocaleDateString(),
      adminMessages: [],
      userMessages: [],
      privateAdminMessages: [],
      privateUserMessages: [],
      memory: createEmptyMemory(),
    };

    const updatedUsers = [newUser, ...users];

    setUsers(updatedUsers);

    const notice =
      `Your request has been received.\n\n` +
      `Your code is: ${newUser.code}\n\n` +
      `Please open our Telegram bot and press START:\n${TELEGRAM_BOT_LINK}\n\n` +
      `Then return here and wait for your access number.`;

    window.alert(notice);

    saveUsersToServer(updatedUsers).catch((error) => {
      console.log("Daily Support save error:", error);
      window.alert("The code was shown, but saving to the server failed. Please check /api/daily-support-users.");
    });

    setName("");
    setContactValue("");
  }

  async function sendSetupMessage(code: string) {
    const user = users.find((u) => u.code === code);
    if (!user) return;

    if (user.contactMethod === "Telegram" && !user.telegramChatId) {
      alert("This Telegram user is not synced yet. Ask the user to start the bot, then click Sync Telegram Users.");
      return;
    }

    const setupNumber = generateSetupNumber();

    const setupMessage =
      `Hello ${user.name}, this is Happy Office.\n\n` +
      `Your access number is: ${setupNumber}\n\n` +
      `Use this full code to open private chat with the Happy Office team:\n\n` +
      `${user.code}-${setupNumber}\n\n` +
      `After opening the private chat, the team will guide you through activation.`;

    try {
      const data = await sendTelegramMessage(setupMessage, user.telegramChatId);

      if (!data.success) {
        alert("Telegram failed. Check token, chat ID, or route.");
        console.log(data);
        return;
      }

      updateUser(code, {
        status: "Setup Sent",
        setupAccessNumber: setupNumber,
        adminMessages: [...user.adminMessages, setupMessage],
        contactCost: user.contactCost + 0.01,
      });

      alert("Access number sent successfully.");
    } catch (error) {
      console.log(error);
      alert("Telegram request failed.");
    }
  }

  function openPrivateChat() {
    const entered = activeCode.trim().toUpperCase();

    const user = users.find((u) => `${u.code}-${u.setupAccessNumber}` === entered);

    if (!user) {
      alert("Chat access denied. Please enter the full code and access number sent to you.");
      return;
    }

    if (user.status === "Blocked" || user.status === "Suspended") {
      alert("This code is not active at the moment.");
      return;
    }

    if (user.status !== "Setup Sent" && user.status !== "In Chat") {
      alert("This code is not ready for admin chat.");
      return;
    }

    const cleanPrivateChatUser = {
      ...user,
      privateAdminMessages: user.privateAdminMessages || [],
      privateUserMessages: user.privateUserMessages || [],
    };

    setOpenedUser(cleanPrivateChatUser);
    updateUser(user.code, {
      status: "In Chat",
      privateAdminMessages: user.privateAdminMessages || [],
      privateUserMessages: user.privateUserMessages || [],
    });
  }

  function sendUserChatMessage() {
    if (!openedUser || !chatInput.trim()) return;

    if (chatInput.length > MAX_USER_MESSAGE_LENGTH) {
      const gentleLimitMessage =
        "That is a lot to carry at once. Let’s take one step together. Please share your message in one short sentence.";

      updateUser(openedUser.code, {
        privateAdminMessages: [
          ...(openedUser.privateAdminMessages || []),
          gentleLimitMessage,
        ],
      });

      setOpenedUser({
        ...openedUser,
        privateAdminMessages: [
          ...(openedUser.privateAdminMessages || []),
          gentleLimitMessage,
        ],
      });

      setChatInput("");
      return;
    }

    const updatedPrivateUserMessages = [
      ...(openedUser.privateUserMessages || []),
      chatInput,
    ];

    updateUser(openedUser.code, {
      privateUserMessages: updatedPrivateUserMessages,
      needsAdminReply: true,
    });

    setOpenedUser({
      ...openedUser,
      privateUserMessages: updatedPrivateUserMessages,
      needsAdminReply: true,
    });

    setChatInput("");
  }

  async function activateElvy(code: string) {
    const user = users.find((u) => u.code === code);
    if (!user) return;

    if (user.contactMethod === "Telegram" && !user.telegramChatId) {
      alert("This user must be synced with Telegram before activating Elvy.");
      return;
    }

    const elvyMessage =
      `Hello ${user.name}.\n\n` +
      `I am Elvy.\n\n` +
      `Your support is now active. This space is calm, simple, and here to help you with clear and meaningful communication.\n\n` +
      `Please send short and focused messages so I can understand you clearly.`;

    try {
      const data = await sendTelegramMessage(elvyMessage, user.telegramChatId);

      if (!data.success) {
        alert("Elvy welcome message was not sent. Check Telegram connection.");
        console.log(data);
        return;
      }

      updateUser(code, {
        status: "Active",
        adminMessages: [...user.adminMessages, elvyMessage],
        contactCost: user.contactCost + 0.01,
        memory: user.memory || createEmptyMemory(),
      });

      alert("Elvy activated and welcome message sent.");
    } catch (error) {
      console.log(error);
      alert("Elvy activation failed.");
    }
  }

  function canDeleteUser(user: SupportUser) {
    if (user.status !== "Active") return true;
    return user.repliesUsed >= user.repliesLimit;
  }

  function deleteUser(code: string) {
    const user = users.find((u) => u.code === code);
    if (!user) return;

    if (!canDeleteUser(user)) {
      alert("Active users cannot be deleted until all replies are used.");
      return;
    }

    setUsers((prev) => {
      const updated = prev.filter((u) => u.code !== code);
      saveUsersToServer(updated);
      return updated;
    });

    if (openedUser?.code === code) setOpenedUser(null);
  }

  function logout() {
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminRoom");
    localStorage.removeItem("adminUsername");
    window.location.href = "/admin";
  }

  function toggleAdminChat(code: string) {
    setOpenAdminChats((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  function sendAdminReply(code: string) {
    const user = users.find((u) => u.code === code);
    if (!user) return;

    const reply = adminReplyInputs[code]?.trim();
    if (!reply) return;

    updateUser(code, {
      privateAdminMessages: [...(user.privateAdminMessages || []), reply],
      needsAdminReply: false,
    });

    setAdminReplyInputs((prev) => ({
      ...prev,
      [code]: "",
    }));
  }

  function rowColor(status: UserStatus) {
    if (status === "Active") return "bg-green-50";
    if (status === "Blocked") return "bg-red-50";
    if (status === "Suspended") return "bg-gray-100";
    return "bg-yellow-50";
  }

  function statusBadge(status: UserStatus) {
    if (status === "Active") return "bg-green-100 text-green-800 border-green-500";
    if (status === "Blocked") return "bg-red-100 text-red-800 border-red-500";
    if (status === "Suspended") return "bg-gray-100 text-gray-800 border-gray-500";
    return "bg-yellow-100 text-yellow-800 border-yellow-500";
  }

  const activeUsers = users.filter((u) => u.status === "Active").length;

  const waitingUsers = users.filter(
    (u) => u.status === "Pending" || u.status === "Setup Sent" || u.status === "In Chat"
  ).length;

  const totalReplies = users.reduce((s, u) => s + u.repliesUsed, 0);

  return (
    <main
      className="relative min-h-screen bg-cover bg-center text-[#4b2a12]"
      style={{ backgroundImage: "url('/images/daily-support.png')" }}
    >
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
        <div className="absolute right-[2%] top-[4%] z-40 flex gap-3">
          <button
            onClick={() => setDashboardOpen(!dashboardOpen)}
            className="rounded-xl bg-[#7a3b1d] px-5 py-3 font-bold text-white"
          >
            Dashboard
          </button>

          <button onClick={logout} className="rounded-xl bg-black px-5 py-3 font-bold text-white">
            Logout
          </button>
        </div>
      )}

      {!dashboardOpen && (
        <section
          className="absolute z-20 overflow-hidden rounded-3xl bg-white/90 p-5 shadow-2xl backdrop-blur"
          style={{
            left: "4%",
            top: "4%",
            width: "92%",
            height: "120vh",
          }}
        >
          <div
            className="h-full gap-5"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              alignItems: "stretch",
            }}
          >
            {/* LEFT CARD: Daily Support */}
            <div className="flex h-full flex-col justify-center overflow-hidden rounded-2xl bg-[#fffaf5] p-8 shadow">
              <h1 className="text-4xl font-bold text-[#7a3b1d]">Daily Support</h1>

              <p className="mt-4 text-lg font-semibold">Welcome to Daily Support Room</p>

              <p className="mt-5 text-base font-semibold text-[#6b4428]">How it works</p>

              <p className="mt-2 text-base leading-relaxed text-[#6b4428]">
                Add your details on the right to receive your access code.
              </p>

              <p className="mt-2 text-base leading-relaxed text-[#6b4428]">
                You can also continue through Telegram:
              </p>

<div className="mt-3">
  <a
    href={TELEGRAM_BOT_LINK}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      display: "block",
      width: "100%",
      backgroundColor: "#229ED9",
      color: "white",
      textAlign: "center",
      padding: "14px",
      borderRadius: "12px",
      fontWeight: "bold",
      fontSize: "16px",
      textDecoration: "none",
    }}
  >
    Telegram Support
  </a>
</div>

              <p className="mt-6 text-base leading-relaxed text-[#6b4428]">
                WhatsApp support will be available soon.
              </p>

              <button
                type="button"
                disabled
                className="mt-2 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white opacity-60"
              >
                WhatsApp Coming Soon
              </button>
            </div>

            {/* RIGHT CARD: User Form + Access Code */}
            <div className="flex h-full flex-col gap-4 overflow-hidden">
              <div className="rounded-2xl bg-white/95 p-5 shadow">
                <h2 className="text-2xl font-bold text-[#7a3b1d]">Tell me about you</h2>

                <p className="mt-1 text-sm">
                  Add simple details so Happy Office can prepare your access code.
                </p>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                  className="mt-3 w-full rounded-xl border border-[#7a3b1d] px-4 py-2"
                />

                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#7a3b1d] px-4 py-2"
                >
                  <option>Under 18</option>
                  <option>18–30</option>
                  <option>31–45</option>
                  <option>46+</option>
                </select>

                <select
                  value={contactMethod}
                  onChange={(e) => setContactMethod(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#7a3b1d] px-4 py-2"
                >
                  <option>Telegram</option>
                  <option>WhatsApp</option>
                </select>

                <input
                  value={contactValue}
                  onChange={(e) => setContactValue(e.target.value)}
                  placeholder={contactMethod === "Telegram" ? "Telegram username, example: @username" : "WhatsApp number"}
                  className="mt-2 w-full rounded-xl border border-[#7a3b1d] px-4 py-2"
                />

                <button
                  onClick={createUser}
                  className="mt-3 w-full rounded-xl bg-[#7a3b1d] px-6 py-3 font-bold text-white"
                >
                  Generate My Access Code
                </button>
              </div>

              <div className="flex-1 rounded-2xl bg-[#f7efe6] p-5 shadow">
                <h2 className="text-xl font-bold text-[#7a3b1d]">
                  To contact Happy Office team, please enter your access code.
                </h2>

                <p className="mt-1 text-sm">
                  If you already have your access code and number, enter them here. If not, generate your access code
                  first. Happy Office team will then send your access number.
                </p>

                <input
                  value={activeCode}
                  onChange={(e) => setActiveCode(e.target.value)}
                  placeholder="Example: ELVY-7K2P9-4821"
                  className="mt-3 w-full rounded-xl border border-[#7a3b1d] px-4 py-2"
                />

                <button
                  onClick={openPrivateChat}
                  className="mt-3 w-full rounded-xl bg-black px-6 py-3 font-bold text-white"
                >
                  Continue
                </button>

                <p className="mt-2 text-sm">Your code is personal. Please do not share it with others.</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {openedUser && !dashboardOpen && (
        <div className="fixed right-6 top-[16%] z-50 h-[74%] w-[720px] rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#7a3b1d]">Private Chat with Happy Office</h2>
              <p className="text-sm font-semibold text-[#4b2a12]">Code: {openedUser.code}</p>
            </div>

            <button
              onClick={() => setOpenedUser(null)}
              className="rounded-full bg-black px-4 py-2 text-sm font-bold text-white"
              title="Close chat"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid h-[52%] grid-cols-2 gap-4">
            <div className="h-full overflow-y-auto rounded-xl border bg-white p-4">
              <p className="mb-3 text-sm font-bold text-[#7a3b1d]">Your messages</p>

              {(openedUser.privateUserMessages || []).length === 0 ? (
                <div className="rounded-xl bg-[#f7efe6] p-3 text-sm">
                  Please write your message here to contact the team.
                </div>
              ) : (
                (openedUser.privateUserMessages || []).map((m, i) => (
                  <div key={`private-user-${i}`} className="mb-3 rounded-xl bg-[#f7efe6] p-3 shadow">
                    {m}
                  </div>
                ))
              )}
            </div>

            <div className="h-full overflow-y-auto rounded-xl border bg-[#faf7f2] p-4">
              <p className="mb-3 text-sm font-bold text-[#7a3b1d]">Happy Office replies</p>

              {(openedUser.privateAdminMessages || []).length === 0 ? (
                <div className="rounded-xl bg-white p-3 text-sm shadow">
                  The team reply will appear here.
                </div>
              ) : (
                (openedUser.privateAdminMessages || []).map((m, i) => (
                  <div key={`private-admin-${i}`} className="mb-3 whitespace-pre-line rounded-xl bg-[#7a3b1d] p-3 text-white">
                    {m}
                  </div>
                ))
              )}
            </div>
          </div>

          <textarea
            maxLength={MAX_USER_MESSAGE_LENGTH + 80}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Write your message here to contact the team..."
            className="mt-4 h-24 w-full rounded-xl border px-4 py-3"
          />

          <p className={`mt-1 text-sm font-semibold ${chatInput.length > MAX_USER_MESSAGE_LENGTH ? "text-red-700" : "text-gray-600"}`}>
            {chatInput.length}/{MAX_USER_MESSAGE_LENGTH}
          </p>

          <button onClick={sendUserChatMessage} className="mt-3 rounded-xl bg-[#7a3b1d] px-6 py-3 font-bold text-white">
            Send
          </button>
        </div>
      )}

      {dashboardOpen && isAdmin && (
        <section className="absolute left-[4%] top-[12%] z-30 h-[84%] w-[92%] overflow-hidden rounded-3xl bg-white/95 p-8 shadow-2xl">
          <div className="h-full overflow-y-auto">
            <h1 className="text-4xl font-bold text-[#7a3b1d]">Daily Support Dashboard</h1>

            <div className="mt-6 grid grid-cols-6 gap-4">
              <div className="rounded-xl bg-white p-4 shadow">
                <p>Room</p>
                <p className="text-2xl font-bold">{roomOpen ? "Open" : "Closed"}</p>
                <button onClick={() => setRoomOpen(!roomOpen)} className="mt-3 rounded bg-[#7a3b1d] px-4 py-2 text-white">
                  {roomOpen ? "Close Room" : "Open Room"}
                </button>
              </div>

              <div className="rounded-xl bg-white p-4 shadow">
                <p>Code Generation</p>
                <p className="text-2xl font-bold">{codeGenerationOpen ? "Open" : "Closed"}</p>
                <button onClick={() => setCodeGenerationOpen(!codeGenerationOpen)} className="mt-3 rounded bg-black px-4 py-2 text-white">
                  {codeGenerationOpen ? "Close Codes" : "Open Codes"}
                </button>
              </div>

              <div className="rounded-xl bg-white p-4 shadow">
                <p>Telegram</p>
                <p className="text-2xl font-bold">Sync Users</p>
                <button onClick={syncTelegramUsers} className="mt-3 rounded bg-blue-700 px-4 py-2 text-white">
                  Sync Telegram Users
                </button>
              </div>

              <div className="rounded-xl bg-white p-4 shadow">
                <p>Total Users</p>
                <p className="text-3xl font-bold">{users.length}</p>
              </div>

              <div className="rounded-xl bg-yellow-50 p-4 shadow">
                <p>Waiting</p>
                <p className="text-3xl font-bold">{waitingUsers}</p>
              </div>

              <div className="rounded-xl bg-green-50 p-4 shadow">
                <p>Active Users</p>
                <p className="text-3xl font-bold">{activeUsers}</p>
              </div>
            </div>

            <div className="mt-8 overflow-x-auto rounded-2xl bg-white p-5 shadow">
              <h2 className="text-2xl font-bold text-[#7a3b1d]">User Requests</h2>

              <table className="mt-4 w-full min-w-[1500px] text-sm">
                <thead>
                  <tr className="bg-[#7a3b1d] text-white">
                    <th className="p-3 text-left">Code</th>
                    <th className="p-3 text-left">Access No.</th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Age</th>
                    <th className="p-3 text-left">Help</th>
                    <th className="p-3 text-left">Contact</th>
                    <th className="p-3 text-left">Telegram ID</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Replies</th>
                    <th className="p-3 text-left">Controls</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((u) => (
                    <Fragment key={u.code}>
                      <tr className={`border-b ${rowColor(u.status)}`}>
                        <td className="p-3 font-bold">{u.code}</td>
                        <td className="p-3 font-bold">{u.setupAccessNumber || "Not sent"}</td>
                        <td className="p-3">{u.name}</td>
                        <td className="p-3">{u.ageGroup}</td>
                        <td className="p-3">{u.helpType}</td>
                        <td className="p-3">
                          {u.contactMethod}: {u.contactValue}
                        </td>
                        <td className="p-3">
                          {u.telegramChatId ? (
                            <span className="rounded bg-green-100 px-2 py-1 font-bold text-green-800">Synced</span>
                          ) : u.contactMethod === "Telegram" ? (
                            <span className="rounded bg-red-100 px-2 py-1 font-bold text-red-800">Not synced</span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {u.status === "In Chat" ? (
                            <button
                              onClick={() => toggleAdminChat(u.code)}
                              className={`rounded-full border px-3 py-1 font-bold ${
                                u.needsAdminReply
                                  ? "bg-red-100 text-red-800 border-red-600"
                                  : "bg-yellow-100 text-yellow-800 border-yellow-500"
                              }`}
                            >
                              In Chat
                            </button>
                          ) : (
                            <span className={`rounded-full border px-3 py-1 font-bold ${statusBadge(u.status)}`}>{u.status}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={u.repliesLimit}
                            onChange={(e) =>
                              updateUser(u.code, {
                                repliesLimit: Number(e.target.value),
                              })
                            }
                            className="w-24 rounded border px-2 py-1"
                          />
                          <span className="ml-2">used {u.repliesUsed}</span>
                        </td>
                        <td className="space-x-2 p-3">
                          <button onClick={() => sendSetupMessage(u.code)} className="rounded bg-blue-700 px-3 py-1 text-white">
                            Send Access
                          </button>

                          <button onClick={() => activateElvy(u.code)} className="rounded bg-green-700 px-3 py-1 text-white">
                            Activate Elvy
                          </button>

                          <button onClick={() => updateUser(u.code, { status: "Suspended" })} className="rounded bg-yellow-600 px-3 py-1 text-white">
                            Suspend
                          </button>

                          <button onClick={() => updateUser(u.code, { status: "Blocked" })} className="rounded bg-red-700 px-3 py-1 text-white">
                            Block
                          </button>

                          <button
                            disabled={!canDeleteUser(u)}
                            onClick={() => deleteUser(u.code)}
                            className={`rounded px-3 py-1 text-white ${canDeleteUser(u) ? "bg-black" : "cursor-not-allowed bg-gray-400"}`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>

                      {openAdminChats.includes(u.code) && (
                        <tr>
                          <td colSpan={10} className="bg-[#f7efe6] p-4">
                            <div className="rounded-2xl border bg-white p-5 shadow">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <h3 className="text-xl font-bold text-[#7a3b1d]">Chat with {u.name}</h3>
                                  <p className="text-sm font-semibold text-[#4b2a12]">Help selected: {u.helpType}</p>
                                  <p className="text-sm font-semibold text-[#4b2a12]">Memory: {getMemorySummary(u.memory)}</p>
                                  <p className="text-sm font-semibold text-[#4b2a12]">Code: {u.code}</p>
                                </div>

                                <button onClick={() => toggleAdminChat(u.code)} className="rounded bg-black px-3 py-1 text-sm text-white">
                                  Hide Chat
                                </button>
                              </div>

                              <div className="mt-4 max-h-[260px] overflow-y-auto rounded-xl border bg-[#faf7f2] p-4">
                                {(u.privateUserMessages || []).length === 0 &&
                                (u.privateAdminMessages || []).length === 0 ? (
                                  <div className="rounded-xl bg-white p-3 text-sm shadow">
                                    No private admin chat messages yet.
                                  </div>
                                ) : (
                                  <>
                                    {(u.privateUserMessages || []).map((m, i) => (
                                      <div key={`private-user-${u.code}-${i}`} className="mb-3 rounded-xl bg-white p-3 shadow">
                                        User: {m}
                                      </div>
                                    ))}

                                    {(u.privateAdminMessages || []).map((m, i) => (
                                      <div key={`private-admin-${u.code}-${i}`} className="mb-3 whitespace-pre-line rounded-xl bg-[#7a3b1d] p-3 text-white">
                                        Happy Office: {m}
                                      </div>
                                    ))}
                                  </>
                                )}
                              </div>

                              <textarea
                                value={adminReplyInputs[u.code] || ""}
                                onChange={(e) =>
                                  setAdminReplyInputs((prev) => ({
                                    ...prev,
                                    [u.code]: e.target.value,
                                  }))
                                }
                                placeholder="Write admin reply..."
                                className="mt-4 h-24 w-full rounded-xl border px-4 py-3"
                              />

                              <button onClick={() => sendAdminReply(u.code)} className="mt-3 rounded-xl bg-[#7a3b1d] px-6 py-3 font-bold text-white">
                                Send Reply
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-6 text-center">
                        No user requests yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-lg font-semibold">AI Replies Used: {totalReplies}</p>
          </div>
        </section>
      )}
    </main>
  );
}
