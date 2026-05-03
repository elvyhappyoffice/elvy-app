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
  const [aiBudget, setAiBudget] = useState(50);
  const [inputTokens, setInputTokens] = useState(300);
  const [outputTokens, setOutputTokens] = useState(250);
  const [inputTokenPrice, setInputTokenPrice] = useState(0.000001);
  const [outputTokenPrice, setOutputTokenPrice] = useState(0.000004);
  const [freeTalkReplies, setFreeTalkReplies] = useState(100);

  const [ticketPrice, setTicketPrice] = useState(4);
  const [repliesPerTicket, setRepliesPerTicket] = useState(500);

  const [admins, setAdmins] = useState<AdminControl[]>(DEFAULT_ADMINS);
  const [dailyUsers, setDailyUsers] = useState<DailySupportUser[]>([]);
  const [showUsers, setShowUsers] = useState(false);
  const [directorMessage, setDirectorMessage] = useState("");
  const [selectedUserCode, setSelectedUserCode] = useState("");

  const [talkFreeUsed, setTalkFreeUsed] = useState(0);
  const [talkTotalFreeLimit, setTalkTotalFreeLimit] = useState(100);

  function loadRealData() {
    const realDailyUsers = safeParse<DailySupportUser[]>(
      localStorage.getItem(DAILY_USERS_KEY),
      []
    );

    const talkSettings = safeParse<TalkSettings>(
      localStorage.getItem(TALK_SETTINGS_KEY),
      {}
    );

    const talkUsed = Number(localStorage.getItem(TALK_TOTAL_FREE_USED_KEY) || "0");

    setDailyUsers(realDailyUsers);
    setTalkFreeUsed(talkUsed);
    setTalkTotalFreeLimit(talkSettings.totalFreeRepliesRoom || freeTalkReplies || 100);
  }

  useEffect(() => {
    const savedAI = safeParse<any>(localStorage.getItem(AI_SETTINGS_KEY), null);
    const savedAdmins = safeParse<AdminControl[]>(
      localStorage.getItem(ADMIN_CONTROLS_KEY),
      DEFAULT_ADMINS
    );

    const officeOpen = localStorage.getItem(HAPPY_OFFICE_KEY);

    if (savedAI) {
      setAiActive(savedAI.aiActive ?? false);
      setAiBudget(savedAI.aiBudget ?? 50);
      setInputTokens(savedAI.inputTokens ?? 300);
      setOutputTokens(savedAI.outputTokens ?? 250);
      setInputTokenPrice(savedAI.inputTokenPrice ?? 0.000001);
      setOutputTokenPrice(savedAI.outputTokenPrice ?? 0.000004);
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
      loadRealData();
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

  function sendDirectorMessage() {
    if (!selectedUserCode || !directorMessage.trim()) {
      alert("Select a user and write a message first.");
      return;
    }

    const updatedUsers = dailyUsers.map((user) => {
      if (user.code !== selectedUserCode) return user;
      return {
        ...user,
        adminMessages: [
          ...((user as any).adminMessages || []),
          `Director of Happy Office: ${directorMessage}`,
        ],
      } as any;
    });

    localStorage.setItem(DAILY_USERS_KEY, JSON.stringify(updatedUsers));
    setDailyUsers(updatedUsers);
    setDirectorMessage("");
    alert("Message saved for the selected user.");
  }

  function logout() {
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminRoom");
    localStorage.removeItem("adminUsername");
    window.location.href = "/admin";
  }

  const pricePerReply =
    inputTokens * inputTokenPrice + outputTokens * outputTokenPrice;

  const totalPossibleAIReplies =
    pricePerReply > 0 ? Math.floor(aiBudget / pricePerReply) : 0;

  const totalDailyUsers = dailyUsers.length;
  const activeDailyUsers = dailyUsers.filter((u) => u.status === "Active");
  const waitingDailyUsers = dailyUsers.filter(
    (u) => u.status === "Pending" || u.status === "Setup Sent" || u.status === "In Chat"
  );
  const blockedDailyUsers = dailyUsers.filter((u) => u.status === "Blocked");

  const dailyRepliesSold = dailyUsers.reduce(
    (sum, user) => sum + Number(user.repliesLimit || 0),
    0
  );

  const dailyRepliesUsed = dailyUsers.reduce(
    (sum, user) => sum + Number(user.repliesUsed || 0),
    0
  );

  const dailyRepliesLeft = Math.max(dailyRepliesSold - dailyRepliesUsed, 0);

  const ticketsSold = dailyUsers.filter((u) => Number(u.repliesLimit || 0) > 0).length;
  const grossIncome = ticketsSold * ticketPrice;
  const estimatedAICost = (dailyRepliesUsed + talkFreeUsed) * pricePerReply;
  const netProfit = grossIncome - estimatedAICost;
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
              <p>Total Daily Support Users</p>
              <p className="text-3xl font-bold">{totalDailyUsers}</p>
            </div>

            <div className="rounded-xl bg-green-50 p-4">
              <p>Active Daily Users</p>
              <p className="text-3xl font-bold">{activeDailyUsers.length}</p>
            </div>

            <div className="rounded-xl bg-yellow-50 p-4">
              <p>Waiting Users</p>
              <p className="text-3xl font-bold">{waitingDailyUsers.length}</p>
            </div>

            <div className="rounded-xl bg-red-50 p-4">
              <p>Blocked Users</p>
              <p className="text-3xl font-bold">{blockedDailyUsers.length}</p>
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-4">
              <p>Daily Replies Sold</p>
              <p className="text-3xl font-bold">{dailyRepliesSold}</p>
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-4">
              <p>Daily Replies Used</p>
              <p className="text-3xl font-bold">{dailyRepliesUsed}</p>
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-4">
              <p>Daily Replies Left</p>
              <p className="text-3xl font-bold">{dailyRepliesLeft}</p>
            </div>

            <div className="rounded-xl bg-[#f5e6d3] p-4">
              <p>Talk to Elvy Free Used</p>
              <p className="text-3xl font-bold">
                {talkFreeUsed}/{talkTotalFreeLimit}
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
                AI budget amount ($)
              </label>
              <input
                type="number"
                value={aiBudget}
                onChange={(e) => setAiBudget(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">Input tokens</label>
              <input
                type="number"
                value={inputTokens}
                onChange={(e) => setInputTokens(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">Output tokens</label>
              <input
                type="number"
                value={outputTokens}
                onChange={(e) => setOutputTokens(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">Input token price</label>
              <input
                type="number"
                step="0.000001"
                value={inputTokenPrice}
                onChange={(e) => setInputTokenPrice(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-bold">Output token price</label>
              <input
                type="number"
                step="0.000001"
                value={outputTokenPrice}
                onChange={(e) => setOutputTokenPrice(Number(e.target.value))}
                className="w-full rounded border p-2"
              />
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
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-[#f5e6d3] p-4">
            <p>
              AI Status:{" "}
              <span className={aiActive ? "font-bold text-green-700" : "font-bold text-red-700"}>
                {aiActive ? "Active" : "Inactive"}
              </span>
            </p>
            <p>Estimated price per reply: ${pricePerReply.toFixed(6)}</p>
            <p>Total possible replies from budget: {totalPossibleAIReplies}</p>
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
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="rounded-xl bg-[#f5e6d3] p-3">Tickets sold: {ticketsSold}</div>
            <div className="rounded-xl bg-[#f5e6d3] p-3">Replies sold: {dailyRepliesSold}</div>
            <div className="rounded-xl bg-[#f5e6d3] p-3">Replies left: {dailyRepliesLeft}</div>
            <div className="rounded-xl bg-[#f5e6d3] p-3">Gross: ${grossIncome.toFixed(2)}</div>
            <div className="rounded-xl bg-[#f5e6d3] p-3">Net profit: ${netProfit.toFixed(2)}</div>
          </div>
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
                  Selected user: {selectedUserCode || "None"}
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
