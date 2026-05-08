"use client";

import { useEffect, useState } from "react";

type AdminKey = "daily_admin" | "talk_admin" | "meet_admin";

type AdminControl = {
  username: AdminKey;
  label: string;
  room: string;
  blocked: boolean;
  password: string;
};

type DailySupportUser = {
  code: string;
  name: string;
  status: "Pending" | "Setup Sent" | "In Chat" | "Active" | "Suspended" | "Blocked";
  repliesLimit: number;
  repliesUsed: number;
  helpType?: string;
  contactMethod?: string;
  contactValue?: string;
  paymentStatus?: "Unpaid" | "Pending" | "Paid" | "Failed";
  paymentMethod?: "PayPal" | "Skrill";
  paymentReference?: string;
  paidAt?: string;
  paid?: boolean;
  adminMessages?: string[];
  userMessages?: string[];
  telegramChatId?: string;
};

type TalkSettings = {
  totalFreeRepliesRoom?: number;
  dailyFreeRepliesPerUser?: number;
};

const AI_SETTINGS_KEY = "founder_ai_settings";
const ADMIN_CONTROLS_KEY = "founder_admin_controls";
const HAPPY_OFFICE_KEY = "happy_office_global_open";

const DAILY_USERS_KEY = "dailySupportUsers";
const TALK_TOTAL_FREE_USED_KEY = "talk_to_elvy_total_free_used";
const TALK_SETTINGS_KEY = "talk_to_elvy_settings";

const DEFAULT_ADMINS: AdminControl[] = [
  {
    username: "daily_admin",
    label: "Daily Support Admin",
    room: "daily-support",
    blocked: false,
    password: "1234",
  },
  {
    username: "talk_admin",
    label: "Talk to Elvy Admin",
    room: "talk-to-elvy",
    blocked: false,
    password: "1234",
  },
  {
    username: "meet_admin",
    label: "Meet Elvy Admin",
    room: "meet-elvy",
    blocked: false,
    password: "1234",
  },
];

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default function FounderDashboardPage() {
  const [happyOfficeOpen, setHappyOfficeOpen] = useState(true);

  const [aiActive, setAiActive] = useState(false);
  const [confirmAI, setConfirmAI] = useState(false);
  const [aiBudget, setAiBudget] = useState(5);
  const [inputTokens, setInputTokens] = useState(2050);
  const [outputTokens, setOutputTokens] = useState(90);
  const [inputTokenPrice, setInputTokenPrice] = useState(0.0000004);
  const [outputTokenPrice, setOutputTokenPrice] = useState(0.0000016);
  const [freeTalkReplies, setFreeTalkReplies] = useState(100);

  const [ticketPrice, setTicketPrice] = useState(4);
  const [repliesPerTicket, setRepliesPerTicket] = useState(500);

  const [admins, setAdmins] = useState<AdminControl[]>(DEFAULT_ADMINS);
  const [dailyUsers, setDailyUsers] = useState<DailySupportUser[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  const [directorMessage, setDirectorMessage] = useState("");
  const [selectedUserCode, setSelectedUserCode] = useState(""); 
  // === Payment Control (NEW) ===
 const [paymentOpen, setPaymentOpen] = useState(false);

  // === Payment Settings (NEW) ===
  const [paypalActive, setPaypalActive] = useState(false);
  const [paypalLink, setPaypalLink] = useState("");
  const [skrillActive, setSkrillActive] = useState(false);
  const [skrillLink, setSkrillLink] = useState("");

  const [talkFreeUsed, setTalkFreeUsed] = useState(0);
  const [talkTotalFreeLimit, setTalkTotalFreeLimit] = useState(100);

  async function loadRealData() {
    try {
      const res = await fetch("/api/daily-support-users", {
        cache: "no-store",
      });

      const data = await res.json();

      if (Array.isArray(data?.users)) {
        setDailyUsers(data.users);
      }
    } catch (error) {
      console.error("Could not load Daily Support users from server:", error);

      const fallbackUsers = safeParse<DailySupportUser[]>(
        localStorage.getItem(DAILY_USERS_KEY),
        []
      );

      setDailyUsers(fallbackUsers);
    }

    const talkSettings = safeParse<TalkSettings>(
      localStorage.getItem(TALK_SETTINGS_KEY),
      {}
    );

    const talkUsed = Number(localStorage.getItem(TALK_TOTAL_FREE_USED_KEY) || "0");

    setTalkFreeUsed(talkUsed);
    setTalkTotalFreeLimit(talkSettings.totalFreeRepliesRoom || freeTalkReplies || 100);
  }

  useEffect(() => {
    const savedAI = safeParse<any>(localStorage.getItem(AI_SETTINGS_KEY), null);
    const savedAdmins = safeParse<AdminControl[]>(
      localStorage.getItem(ADMIN_CONTROLS_KEY),
      DEFAULT_ADMINS
    );
// === Load Payment Setting (NEW) ===
fetch("/api/founder-settings")
  .then((res) => res.json())
  .then((data) => {
    if (data?.settings) {
      setPaymentOpen(data.settings.automaticPaymentOpen);
    }
  })
  .catch(() => {});

// === Load Payment Links Settings (NEW) ===
fetch("/api/payment-settings")
  .then((res) => res.json())
  .then((data) => {
    if (data?.settings) {
      setPaypalActive(Boolean(data.settings.paypalActive));
      setPaypalLink(data.settings.paypalLink || "");
      setSkrillActive(Boolean(data.settings.skrillActive));
      setSkrillLink(data.settings.skrillLink || "");
    }
  })
  .catch(() => {});

    const officeOpen = localStorage.getItem(HAPPY_OFFICE_KEY);

    if (savedAI) {
      setAiActive(savedAI.aiActive ?? false);
      setAiBudget(savedAI.aiBudget ?? 5);
      setInputTokens(savedAI.inputTokens ?? 2050);
      setOutputTokens(savedAI.outputTokens ?? 90);
      setInputTokenPrice(savedAI.inputTokenPrice ?? 0.0000004);
      setOutputTokenPrice(savedAI.outputTokenPrice ?? 0.0000016);
      setFreeTalkReplies(savedAI.freeTalkReplies ?? 100);
      setTicketPrice(savedAI.ticketPrice ?? 4);
      setRepliesPerTicket(savedAI.repliesPerTicket ?? 500);
    }

    setAdmins(savedAdmins);

    if (officeOpen !== null) {
      setHappyOfficeOpen(officeOpen === "true");
    }

    loadRealData();

    const interval = window.setInterval(() => {
      void loadRealData();
    }, 1500);

    return () => window.clearInterval(interval);
  }, []);

  function saveAll() {
    localStorage.setItem(
      AI_SETTINGS_KEY,
      JSON.stringify({
        aiActive,
        aiBudget,
        inputTokens,
        outputTokens,
        inputTokenPrice,
        outputTokenPrice,
        freeTalkReplies,
        ticketPrice,
        repliesPerTicket,
      })
    );

    localStorage.setItem(ADMIN_CONTROLS_KEY, JSON.stringify(admins));
    localStorage.setItem(HAPPY_OFFICE_KEY, String(happyOfficeOpen));

    alert("Founder settings saved");
  }

  function enterRoom(room: "daily-support" | "talk-to-elvy" | "meet-elvy") {
    localStorage.setItem("adminRole", "founder");
    localStorage.setItem("adminRoom", room);
    window.location.href = `/sections/${room}`;
  }
// === Toggle Payment (NEW) ===
async function toggleAutomaticPayment() {
  try {
    const res = await fetch("/api/founder-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        automaticPaymentOpen: !paymentOpen,
      }),
    });

    const data = await res.json();

    if (data?.settings) {
      setPaymentOpen(data.settings.automaticPaymentOpen);
    }
  } catch (err) {
    console.error("Payment toggle failed", err);
  }
}

// === Save Payment Links Settings (NEW) ===
async function savePaymentSettings() {
  try {
    const res = await fetch("/api/payment-settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paypalActive,
        paypalLink,
        skrillActive,
        skrillLink,
      }),
    });

    const data = await res.json();

    if (data?.ok) {
      alert("Payment settings saved.");
    } else {
      alert("Could not save payment settings.");
    }
  } catch (err) {
    console.error("Payment settings save failed", err);
    alert("Could not save payment settings.");
  }
}

  function toggleAI() {
    if (!confirmAI) {
      alert("Please check the confirmation box first.");
      return;
    }
    setAiActive(!aiActive);
  }

  function resetAdminPassword(username: AdminKey) {
    const newPassword = prompt("Enter new password:");
    if (!newPassword) return;

    setAdmins((prev) =>
      prev.map((admin) =>
        admin.username === username ? { ...admin, password: newPassword } : admin
      )
    );

    alert("Password reset saved in founder controls.");
  }

  function toggleAdminBlock(username: AdminKey) {
    setAdmins((prev) =>
      prev.map((admin) =>
        admin.username === username
          ? { ...admin, blocked: !admin.blocked }
          : admin
      )
    );
  }

  async function sendDirectorMessage() {
    const cleanMessage = directorMessage.trim();

    if (!selectedUserCode || !cleanMessage) {
      alert("Select a user and write a message first.");
      return;
    }

    const selectedUser = dailyUsers.find((user) => user.code === selectedUserCode);

    if (!selectedUser) {
      alert("Selected user was not found. Please refresh real data and try again.");
      return;
    }

    const finalMessage = `Director of Happy Office: ${cleanMessage}`;

    const updatedUsers = dailyUsers.map((user) => {
      if (user.code !== selectedUserCode) return user;

      return {
        ...user,
        adminMessages: [...(user.adminMessages || []), finalMessage],
      };
    });

    try {
      const saveRes = await fetch("/api/daily-support-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ users: updatedUsers }),
      });

      if (!saveRes.ok) {
        alert("Message was not saved. Please check /api/daily-support-users.");
        return;
      }

      setDailyUsers(updatedUsers);
      setDirectorMessage("");

      if (selectedUser.telegramChatId) {
        const telegramRes = await fetch("/api/telegram/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chatId: selectedUser.telegramChatId,
            message: finalMessage,
          }),
        });

        const telegramData = await telegramRes.json();

        if (!telegramData?.success) {
          alert("Message saved, but Telegram sending failed. Check the Telegram route or chat ID.");
          return;
        }

        alert("Director message saved and sent to Telegram.");
        return;
      }

      alert("Message saved. This user has no Telegram chat ID yet, so it was not sent to Telegram.");
    } catch (error) {
      console.error("Director message failed:", error);
      alert("Message failed. Check the console or server logs.");
    }
  }

  function logout() {
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminRoom");
    localStorage.removeItem("adminUsername");
    window.location.href = "/admin";
  }

  const inputCostPerReply = inputTokens * inputTokenPrice;
  const outputCostPerReply = outputTokens * outputTokenPrice;
  const pricePerReply = inputCostPerReply + outputCostPerReply;

  const totalPossibleAIReplies =
    pricePerReply > 0 ? Math.floor(aiBudget / pricePerReply) : 0;

  const costPerTicket = pricePerReply * repliesPerTicket;

  const totalTicketsAvailable =
    costPerTicket > 0 ? Math.floor(aiBudget / costPerTicket) : 0;

  const totalDailyUsers = dailyUsers.length;
  const activeDailyUsers = dailyUsers.filter((u) => u.status === "Active");
  const waitingDailyUsers = dailyUsers.filter(
    (u) => u.status === "Pending" || u.status === "Setup Sent" || u.status === "In Chat"
  );
  const blockedDailyUsers = dailyUsers.filter((u) => u.status === "Blocked");

  const dailyRepliesSold = dailyUsers.filter(
    (user) =>
      user.status === "Active" ||
      user.paymentStatus === "Paid" ||
      Boolean(user.paidAt)
  ).length;

  const dailyRepliesUsed = dailyUsers.reduce(
    (sum, user) => sum + Number(user.repliesUsed || 0),
    0
  );

  const dailyRepliesLeft = dailyUsers.reduce(
    (sum, user) =>
      sum +
      Math.max(
        Number(user.repliesLimit || 0) - Number(user.repliesUsed || 0),
        0
      ),
    0
  );

  const ticketsSold = dailyUsers.filter(
    (user) =>
      user.status === "Active" ||
      user.paymentStatus === "Paid" ||
      Boolean(user.paidAt) ||
      Boolean(user.paid)
  ).length;

  const ticketsRemaining = Math.max(totalTicketsAvailable - ticketsSold, 0);
  const ticketGenerationOpen = aiActive && ticketsRemaining > 0;
  const grossIncome = ticketsSold * ticketPrice;
  const estimatedAICost = (dailyRepliesUsed + talkFreeUsed) * pricePerReply;
  const reservedTicketAICost = ticketsSold * costPerTicket;
  const netProfit = grossIncome - reservedTicketAICost;
  const talkFreeLeft = Math.max(talkTotalFreeLimit - talkFreeUsed, 0);

  return (
    <main className="min-h-screen bg-[#f5e6d3] p-6 text-[#3b2114]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between rounded-2xl bg-white p-5 shadow">
          <div>
            <h1 className="text-3xl font-bold text-[#7a3b1d]">
              Founder Dashboard
            </h1>
            <p className="text-sm">
              Real control center for Happy Office, Daily Support, and Talk to Elvy.
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-xl bg-black px-5 py-2 font-bold text-white"
          >
            Logout
          </button>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <button
            onClick={() => enterRoom("daily-support")}
            className="rounded-2xl bg-white p-5 text-center font-bold shadow hover:bg-yellow-50"
          >
            Enter Daily Support as Admin
          </button>

          <button
            onClick={() => enterRoom("talk-to-elvy")}
            className="rounded-2xl bg-white p-5 text-center font-bold shadow hover:bg-yellow-50"
          >
            Enter Talk to Elvy as Admin
          </button>

          <button
            onClick={() => enterRoom("meet-elvy")}
            className="rounded-2xl bg-white p-5 text-center font-bold shadow hover:bg-yellow-50"
          >
            Enter Meet Elvy as Admin
          </button>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-2xl font-bold text-[#7a3b1d]">
            Real Room Activity
          </h2>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-[#f5e6d3] p-4">
              <p>Total Users</p>
              <p className="text-3xl font-bold">{totalDailyUsers}</p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p>Active Daily Users</p>
              <p className="text-3xl font-bold">{activeDailyUsers.length}</p>
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-4">
              <p>Daily Replies Sold</p>
              <p className="text-3xl font-bold">{dailyRepliesSold}</p>
              <p className="mt-1 text-xs text-[#6b4428]">
                Activated tickets
              </p>
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-4">
              <p>Talk to Elvy Free Used</p>
              <p className="text-3xl font-bold">
                {talkFreeUsed}/{talkTotalFreeLimit}
              </p>
              <p className="mt-1 text-xs text-[#6b4428]">
                Free replies provided
              </p>
            </div>
          </div>

          <button
            onClick={loadRealData}
            className="mt-4 rounded-xl bg-black px-5 py-2 font-bold text-white"
          >
            Refresh Real Data
          </button>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-2xl font-bold text-[#7a3b1d]">
            Happy Office Global Control
          </h2>

          <p className="mb-3">
            Status:{" "}
            <span
              className={
                happyOfficeOpen
                  ? "font-bold text-green-700"
                  : "font-bold text-red-700"
              }
            >
              {happyOfficeOpen ? "Open" : "Closed"}
            </span>
          </p>

          <button
            onClick={() => setHappyOfficeOpen(!happyOfficeOpen)}
            className={`rounded-xl px-5 py-2 font-bold text-white ${
              happyOfficeOpen ? "bg-red-700" : "bg-green-700"
            }`}
          >
            {happyOfficeOpen ? "Close Happy Office" : "Open Happy Office"}
          </button>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-2xl font-bold text-[#7a3b1d]">
            AI Control
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-bold">
                Available AI budget ($)
              </label>
              <input
                type="number"
                value={aiBudget}
                onChange={(e) => setAiBudget(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
              <p className="mt-1 text-xs text-gray-600">
                Enter the real AI credit or budget available.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">
                Total input tokens per reply
              </label>
              <input
                type="number"
                value={inputTokens}
                onChange={(e) => setInputTokens(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
              <p className="mt-1 text-xs text-gray-600">
                Includes Elvy prompt, memory, history, and user message.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">
                Max output tokens per reply
              </label>
              <input
                type="number"
                value={outputTokens}
                onChange={(e) => setOutputTokens(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
              <p className="mt-1 text-xs text-gray-600">
                Maximum tokens allowed for Elvy reply.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">
                Input token price ($)
              </label>
              <input
                type="number"
                step="0.0000001"
                value={inputTokenPrice}
                onChange={(e) => setInputTokenPrice(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
              <p className="mt-1 text-xs text-gray-600">
                Example GPT-4.1 mini: 0.0000004
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">
                Output token price ($)
              </label>
              <input
                type="number"
                step="0.0000001"
                value={outputTokenPrice}
                onChange={(e) => setOutputTokenPrice(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
              <p className="mt-1 text-xs text-gray-600">
                Example GPT-4.1 mini: 0.0000016
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">
                Talk to Elvy free replies limit
              </label>
              <input
                type="number"
                value={freeTalkReplies}
                onChange={(e) => setFreeTalkReplies(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
              <p className="mt-1 text-xs text-gray-600">
                Free replies reserved for Talk to Elvy room.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-[#f5e6d3] p-4">
              <p className="text-sm">Input cost / reply</p>
              <p className="text-xl font-bold">${inputCostPerReply.toFixed(6)}</p>
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-4">
              <p className="text-sm">Output cost / reply</p>
              <p className="text-xl font-bold">${outputCostPerReply.toFixed(6)}</p>
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-4">
              <p className="text-sm">Max cost / reply</p>
              <p className="text-xl font-bold">${pricePerReply.toFixed(6)}</p>
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-4">
              <p className="text-sm">Replies from $1</p>
              <p className="text-xl font-bold">
                {pricePerReply > 0 ? Math.floor(1 / pricePerReply) : 0}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-[#f5e6d3] p-4">
            <p>
              AI Status:{" "}
              <span className={aiActive ? "font-bold text-green-700" : "font-bold text-red-700"}>
                {aiActive ? "Active" : "Inactive"}
              </span>
            </p>
            <p>Total possible replies from budget: {totalPossibleAIReplies}</p>
            <p>Replies per ticket: {repliesPerTicket}</p>
            <p>Estimated AI cost per ticket: ${costPerTicket.toFixed(4)}</p>
            <p>Total tickets available from AI budget: {totalTicketsAvailable}</p>
            <p>Tickets sold: {ticketsSold}</p>
            <p>
              Tickets remaining:{" "}
              <span className={ticketsRemaining > 0 ? "font-bold text-green-700" : "font-bold text-red-700"}>
                {ticketsRemaining}
              </span>
            </p>
            <p>
              Ticket generation status:{" "}
              <span className={ticketGenerationOpen ? "font-bold text-green-700" : "font-bold text-red-700"}>
                {ticketGenerationOpen ? "Open" : "Closed"}
              </span>
            </p>
          </div>

          <label className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={confirmAI}
              onChange={(e) => setConfirmAI(e.target.checked)}
            />
            I confirm that I want to change AI activation.
          </label>

          <button
            onClick={toggleAI}
            className={`mt-3 rounded-xl px-5 py-2 font-bold text-white ${
              aiActive ? "bg-red-700" : "bg-green-700"
            }`}
          >
            {aiActive ? "Deactivate AI" : "Activate AI"}
          </button>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-2xl font-bold text-[#7a3b1d]">
            Business Monitor from Real Data
          </h2>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-bold">Ticket price ($)</label>
              <input
                type="number"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">Replies per ticket</label>
              <input
                type="number"
                value={repliesPerTicket}
                onChange={(e) => setRepliesPerTicket(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-3">
              <p className="text-sm">AI cost per ticket</p>
              <p className="text-xl font-bold">${costPerTicket.toFixed(4)}</p>
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-3">
              <p className="text-sm">Profit per ticket</p>
              <p className="text-xl font-bold">
                ${(ticketPrice - costPerTicket).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-[#f5e6d3] p-3">
              Tickets available: {totalTicketsAvailable}
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-3">
              Tickets sold: {ticketsSold}
            </div>

            <div
              className={`rounded-xl p-3 ${
                ticketsRemaining > 0 ? "bg-green-50" : "bg-red-50"
              }`}
            >
              Tickets remaining: {ticketsRemaining}
            </div>

            <div
              className={`rounded-xl p-3 ${
                ticketGenerationOpen ? "bg-green-50" : "bg-red-50"
              }`}
            >
              Code generation: {ticketGenerationOpen ? "Open" : "Closed"}
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-3">
              Total possible replies: {totalPossibleAIReplies}
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-3">
              Replies reserved by sold tickets: {ticketsSold * repliesPerTicket}
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-3">
              Gross: ${grossIncome.toFixed(2)}
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-3">
              Net profit: ${netProfit.toFixed(2)}
            </div>
          </div>

          {ticketsRemaining <= 0 && (
            <div className="mt-4 rounded-xl bg-red-50 p-4 font-semibold text-red-800">
              No AI tickets are currently available. Add more AI budget to continue generating new codes or tickets.
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-2xl font-bold text-[#7a3b1d]">
            Payment Activity
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#f5e6d3] text-[#3b2114]">
                  <th className="border p-3">User Code</th>
                  <th className="border p-3">Name</th>
                  <th className="border p-3">Payment Status</th>
                  <th className="border p-3">Method</th>
                  <th className="border p-3">Paid At</th>
                  <th className="border p-3">Replies Left</th>
                </tr>
              </thead>
              <tbody>
                {dailyUsers.length === 0 && (
                  <tr>
                    <td className="border p-3" colSpan={6}>
                      No payment activity yet.
                    </td>
                  </tr>
                )}

                {dailyUsers.map((user) => {
                  const left = Math.max(
                    Number(user.repliesLimit || 0) - Number(user.repliesUsed || 0),
                    0
                  );

                  return (
                    <tr key={`payment-${user.code}`}>
                      <td className="border p-3 font-bold text-[#7a3b1d]">
                        {user.code}
                      </td>
                      <td className="border p-3">{user.name}</td>
                      <td className="border p-3">
                        <span
                          className={
                            user.paymentStatus === "Paid"
                              ? "font-bold text-green-700"
                              : user.paymentStatus === "Pending"
                                ? "font-bold text-yellow-700"
                                : user.paymentStatus === "Failed"
                                  ? "font-bold text-red-700"
                                  : "font-bold text-gray-700"
                          }
                        >
                          {user.paymentStatus || "Unpaid"}
                        </span>
                      </td>
                      <td className="border p-3">{user.paymentMethod || "—"}</td>
                      <td className="border p-3">
                        {user.paidAt
                          ? new Date(user.paidAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="border p-3">{left}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-2xl font-bold text-[#7a3b1d]">
            Payment Control
          </h2>

          <p className="mb-3">
            Automatic Payment:{" "}
            <span
              className={
                paymentOpen
                  ? "font-bold text-green-700"
                  : "font-bold text-red-700"
              }
            >
              {paymentOpen ? "Open" : "Closed"}
            </span>
          </p>

          <button
            onClick={toggleAutomaticPayment}
            className={`mb-6 rounded-xl px-5 py-2 font-bold text-white ${
              paymentOpen ? "bg-red-700" : "bg-green-700"
            }`}
          >
            {paymentOpen ? "Close Automatic Payment" : "Open Automatic Payment"}
          </button>

          <h3 className="mb-3 text-xl font-bold text-[#7a3b1d]">
            Payment Settings
          </h3>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <label className="mb-3 flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={paypalActive}
                  onChange={(e) => setPaypalActive(e.target.checked)}
                />
                Activate PayPal
              </label>

              <label className="mb-1 block text-sm font-bold">
                PayPal payment link
              </label>
              <input
                type="text"
                value={paypalLink}
                onChange={(e) => setPaypalLink(e.target.value)}
                placeholder="Enter PayPal payment link"
                className="w-full rounded border p-2"
              />
            </div>

            <div className="rounded-xl border p-4">
              <label className="mb-3 flex items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={skrillActive}
                  onChange={(e) => setSkrillActive(e.target.checked)}
                />
                Activate Skrill
              </label>

              <label className="mb-1 block text-sm font-bold">
                Skrill payment link
              </label>
              <input
                type="text"
                value={skrillLink}
                onChange={(e) => setSkrillLink(e.target.value)}
                placeholder="Enter Skrill payment link"
                className="w-full rounded border p-2"
              />
            </div>
          </div>

          <button
            onClick={savePaymentSettings}
            className="mt-4 rounded-xl bg-[#7a3b1d] px-5 py-2 font-bold text-white"
          >
            Save Payment Settings
          </button>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow">
          <h2 className="mb-4 text-2xl font-bold text-[#7a3b1d]">
            Admin Management
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            {admins.map((admin) => (
              <div key={admin.username} className="rounded-xl border p-4">
                <h3 className="font-bold">{admin.label}</h3>
                <p className="text-sm">Username: {admin.username}</p>
                <p className="text-sm">Room: {admin.room}</p>
                <p className="text-sm">
                  Status:{" "}
                  <span className={admin.blocked ? "font-bold text-red-700" : "font-bold text-green-700"}>
                    {admin.blocked ? "Blocked" : "Active"}
                  </span>
                </p>

                <button
                  onClick={() => resetAdminPassword(admin.username)}
                  className="mt-3 mr-2 rounded bg-blue-700 px-3 py-2 text-sm text-white"
                >
                  Reset Password
                </button>

                <button
                  onClick={() => toggleAdminBlock(admin.username)}
                  className={`mt-3 rounded px-3 py-2 text-sm text-white ${
                    admin.blocked ? "bg-green-700" : "bg-red-700"
                  }`}
                >
                  {admin.blocked ? "Unblock" : "Block"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[#7a3b1d]">
              Real Active Users
            </h2>

            <button
              onClick={() => setShowUsers(!showUsers)}
              className="rounded-xl bg-black px-4 py-2 text-white"
            >
              {showUsers ? "Hide Users" : "Show Users"}
            </button>
          </div>

          {showUsers && (
            <div className="space-y-3">
              {dailyUsers.length === 0 && (
                <p className="rounded-xl bg-[#f5e6d3] p-4">
                  No real Daily Support users yet.
                </p>
              )}

              {dailyUsers.map((user) => {
                const left = Math.max(Number(user.repliesLimit || 0) - Number(user.repliesUsed || 0), 0);

                return (
                  <div
                    key={user.code}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                  >
                    <button
                      onClick={() => setSelectedUserCode(user.code)}
                      className="font-bold text-[#7a3b1d] underline"
                    >
                      {user.code}
                    </button>

                    <span>{user.name}</span>
                    <span>{user.helpType || "Daily Support"}</span>
                    <span>Used: {user.repliesUsed}</span>
                    <span>Left: {left}</span>
                    <span>Status: {user.status}</span>
                  </div>
                );
              })}

              <div className="rounded-xl bg-[#f5e6d3] p-4">
                <p className="mb-2 font-bold">
                  Send message as Happy Office Director
                </p>

                <p className="mb-2 text-sm">
                  Selected user:{" "}
                  {selectedUserCode
                    ? `${dailyUsers.find((user) => user.code === selectedUserCode)?.name || "User"} (${selectedUserCode})`
                    : "None"}
                </p>

                <textarea
                  value={directorMessage}
                  onChange={(e) => setDirectorMessage(e.target.value)}
                  placeholder="Write a direct message to the selected user..."
                  className="mb-3 h-28 w-full rounded border p-3"
                />

                <button
                  onClick={sendDirectorMessage}
                  className="rounded-xl bg-[#7a3b1d] px-5 py-2 font-bold text-white"
                >
                  Send Message
                </button>
              </div>
            </div>
          )}
        </section>

        <button
          onClick={saveAll}
          className="w-full rounded-2xl bg-green-700 p-4 text-xl font-bold text-white"
        >
          Save Founder Settings
        </button>
      </div>
    </main>
  );
}
