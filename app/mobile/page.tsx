"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  sender: "elvy" | "user";
  text: string;
};

type ElvyAccount = {
  username: string;
  displayName: string;
  userCode: string;
  creditsLeft: number;
  ticketStatus: string;
};

const ELVY_ACCOUNT_KEY = "elvy_mobile_account";
const FREE_REPLIES_LIMIT = 3;
const FREE_REPLIES_USED_KEY = "elvy_mobile_free_replies_used";
const FREE_TRIAL_CODE_KEY = "elvy_mobile_free_trial_code";
const SEEN_ADMIN_MESSAGES_KEY = "elvy_seen_admin_messages";

function createFreeTrialCode() {
  return `FREE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MobileElvyPage() {
  const router = useRouter();

  const AI_CONNECTED = true;

  const [showTerms, setShowTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [accountMode, setAccountMode] = useState<"login" | "register">("register");
  const [account, setAccount] = useState<ElvyAccount | null>(null);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountDisplayName, setAccountDisplayName] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  const [input, setInput] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [activationMessage, setActivationMessage] = useState("");

  const [freeRepliesUsed, setFreeRepliesUsed] = useState(0);
  const [freeTrialCode, setFreeTrialCode] = useState("");
  const [showTicketInfo, setShowTicketInfo] = useState(false);

  const [isActivated, setIsActivated] = useState(false);
  const [activeUserCode, setActiveUserCode] = useState("");
  const [repliesLeft, setRepliesLeft] = useState(0);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paypalActive, setPaypalActive] = useState(false);
  const [paypalLink, setPaypalLink] = useState("");
  const [skrillActive, setSkrillActive] = useState(false);
  const [skrillLink, setSkrillLink] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "elvy",
      text: "Hello. My name is Elvy. I am a communication companion. How can I help you?",
    },
  ]);

  useEffect(() => {
    try {
      const savedAccount = localStorage.getItem(ELVY_ACCOUNT_KEY);
      if (!savedAccount) return;

      const parsed = JSON.parse(savedAccount) as ElvyAccount;
      if (parsed?.username && parsed?.userCode) {
        setAccount(parsed);
        setIsActivated(
  parsed.ticketStatus === "Active" &&
  Number(parsed.creditsLeft || 0) > 0
);
        setActiveUserCode(parsed.userCode);
        setRepliesLeft(Number(parsed.creditsLeft || 0));
        setMessages([
          {
            sender: "elvy",
            text: `Welcome back, ${parsed.displayName || parsed.username}.`,
          },
        ]);
      }
    } catch {
      localStorage.removeItem(ELVY_ACCOUNT_KEY);
    }
  }, []);

  useEffect(() => {
    const savedUsed = Number(localStorage.getItem(FREE_REPLIES_USED_KEY) || "0");
    setFreeRepliesUsed(Number.isFinite(savedUsed) ? savedUsed : 0);

    let savedCode = localStorage.getItem(FREE_TRIAL_CODE_KEY) || "";

    if (!savedCode) {
      savedCode = createFreeTrialCode();
      localStorage.setItem(FREE_TRIAL_CODE_KEY, savedCode);
    }

    setFreeTrialCode(savedCode);
  }, []);

  useEffect(() => {
    async function loadPaymentSettings() {
      try {
        const founderRes = await fetch("/api/founder-settings", {
          cache: "no-store",
        });
        const founderData = await founderRes.json();

        if (founderData?.settings) {
          setPaymentOpen(Boolean(founderData.settings.automaticPaymentOpen));
        }

        const paymentRes = await fetch("/api/payment-settings", {
          cache: "no-store",
        });
        const paymentData = await paymentRes.json();

        if (paymentData?.settings) {
          setPaypalActive(Boolean(paymentData.settings.paypalActive));
          setPaypalLink(paymentData.settings.paypalLink || "");
          setSkrillActive(Boolean(paymentData.settings.skrillActive));
          setSkrillLink(paymentData.settings.skrillLink || "");
        }
      } catch (error) {
        console.error("Payment settings load failed:", error);
      }
    }

    loadPaymentSettings();
  }, []);


  useEffect(() => {
    if (chatOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [chatOpen, isSending]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isSending]);
useEffect(() => {
  if (!account?.userCode) return;

  const interval = setInterval(async () => {
    try {
      const response = await fetch(
        `/api/user-messages?code=${account.userCode}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!data?.success || !Array.isArray(data.messages)) {
        return;
      }

      const latestMessage =
        data.messages[data.messages.length - 1];

      if (!latestMessage) return;

      const seenMessages = JSON.parse(
        localStorage.getItem(SEEN_ADMIN_MESSAGES_KEY) || "[]"
      );

      if (seenMessages.includes(latestMessage)) {
        return;
      }

      localStorage.setItem(
        SEEN_ADMIN_MESSAGES_KEY,
        JSON.stringify([
          ...seenMessages,
          latestMessage,
        ])
      );

      setMessages((prev) => {
        const alreadyExists = prev.some(
          (msg) => msg.text === latestMessage
        );

        if (alreadyExists) return prev;

        return [
          ...prev,
          {
            sender: "elvy",
            text: latestMessage,
          },
        ];
      });
    } catch (error) {
      console.log(error);
    }
  }, 3000);

  return () => clearInterval(interval);
}, [account]);

  function openTalkToElvy() {
    setShowTerms(true);
    setChatOpen(false);
    setAcceptedTerms(false);
  }

  function continueToChat() {
    if (!acceptedTerms) return;
    setShowTerms(false);

    if (account) {
      setChatOpen(true);
      return;
    }

    setShowAccountForm(true);
  }

  async function submitAccount() {
    const cleanUsername = accountUsername.trim().toLowerCase();
    const cleanPassword = accountPassword.trim();
    const cleanDisplayName = accountDisplayName.trim();

    if (!cleanUsername || !cleanPassword) {
      setAccountMessage("Username and password are required.");
      return;
    }

    try {
      const endpoint =
        accountMode === "register"
          ? "/api/account/register"
          : "/api/account/login";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: cleanUsername,
          password: cleanPassword,
          displayName: cleanUsername,
        }),
      });

      const data = await response.json();

      if (!data?.ok || !data?.account) {
        setAccountMessage(data?.error || "Account request failed.");
        return;
      }

      const nextAccount: ElvyAccount = {
        username: data.account.username,
        displayName: data.account.displayName || data.account.display_name || cleanUsername,
        userCode: data.account.userCode || data.account.user_code,
        creditsLeft: Number(data.account.creditsLeft ?? data.account.credits_left ?? 0),
        ticketStatus: data.account.ticketStatus || data.account.ticket_status || "Free",
      };

      localStorage.setItem(ELVY_ACCOUNT_KEY, JSON.stringify(nextAccount));
if (accountMode === "register") {
  localStorage.removeItem(FREE_REPLIES_USED_KEY);
  localStorage.removeItem(FREE_TRIAL_CODE_KEY);

  setFreeRepliesUsed(0);

  const newFreeTrialCode = createFreeTrialCode();

  localStorage.setItem(
    FREE_TRIAL_CODE_KEY,
    newFreeTrialCode
  );

  setFreeTrialCode(newFreeTrialCode);
}

setAccount(nextAccount);

const activated =
  nextAccount.ticketStatus === "Active" &&
  Number(nextAccount.creditsLeft || 0) > 0;

setIsActivated(activated);

setActiveUserCode(
  activated ? nextAccount.userCode : ""
);

setRepliesLeft(
  Number(nextAccount.creditsLeft || 0)
);

if (accountMode === "register") {
  setFreeRepliesUsed(0);
  setShowTicketInfo(false);
}
      setShowAccountForm(false);
      setChatOpen(true);
      setAccountMessage("");
      setMessages([
        {
          sender: "elvy",
          text:
            accountMode === "register"
              ? `Welcome to Happy Office, ${nextAccount.displayName}.`
              : `Welcome back, ${nextAccount.displayName}.`,
        },
      ]);
    } catch {
      setAccountMessage("Account connection failed. Please try again.");
    }
  }

  function logoutAccount() {
    localStorage.removeItem(ELVY_ACCOUNT_KEY);
    setAccount(null);
    setIsActivated(false);
    setActiveUserCode("");
    setRepliesLeft(0);
    setChatOpen(false);
    setShowAccountForm(true);
  }

  async function activateCode() {
    const cleanCode = activationCode.trim();

    if (!cleanCode) {
      setActivationMessage("Please enter your activation code.");
      return;
    }

    try {
      const response = await fetch("/api/activate-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: cleanCode,
        }),
      });

      const data = await response.json();

      if (!data?.success) {
        setIsActivated(false);
        setActivationMessage(data?.message || "This code is not valid.");
        return;
      }

setIsActivated(true);

const updatedAccount = {
  ...(account as ElvyAccount),
  creditsLeft: Number(data.user?.repliesLeft || 0),
  ticketStatus: "Active",
};

setAccount(updatedAccount);

localStorage.setItem(
  ELVY_ACCOUNT_KEY,
  JSON.stringify(updatedAccount)
);

setActiveUserCode(data.user?.code || cleanCode);

setRepliesLeft(Number(data.user?.repliesLeft || 0));

setShowTicketInfo(false);

setActivationMessage("Elvy is activated.");

      setMessages((prev) => [
        ...prev,
        {
          sender: "elvy",
          text: `Elvy is activated. You have ${Number(data.user?.repliesLeft || 0)} credits left.`,
        },
      ]);
    } catch (error) {
      setActivationMessage("Activation failed. Please try again.");
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isSending) return;

    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInput("");

    const paidModeAllowed = isActivated && repliesLeft > 0;
    const freeModeAllowed = !paidModeAllowed && freeRepliesUsed < FREE_REPLIES_LIMIT;

    if (!freeModeAllowed && !paidModeAllowed) {
      setShowTicketInfo(true);
      setMessages((prev) => [
        ...prev,
        {
          sender: "elvy",
          text: "Please activate an Elvy ticket to continue.",
        },
      ]);
      return;
    }

    let codeToSend = "";

    if (freeModeAllowed) {
      const nextUsed = freeRepliesUsed + 1;
      setFreeRepliesUsed(nextUsed);
      localStorage.setItem(FREE_REPLIES_USED_KEY, String(nextUsed));

      if (nextUsed >= FREE_REPLIES_LIMIT && !isActivated) {
        setShowTicketInfo(true);
      }
    } else if (paidModeAllowed) {
      codeToSend = activeUserCode;
    }

    setIsSending(true);

    if (!AI_CONNECTED) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            sender: "elvy",
            text: "I am sorry. I cannot reply right now.",
          },
        ]);
        setIsSending(false);
      }, 400);
      return;
    }

    try {
      const response = await fetch("/api/elvy-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          code: codeToSend,
          freeTrialCode: account?.userCode || freeTrialCode,
          freeTrialMode: freeModeAllowed,
          recentMessages: messages.slice(-6),
        }),
      });

      const data = await response.json();

      const aiReply =
        data.reply || "I am sorry. I cannot reply right now.";

      setMessages((prev) => [
        ...prev,
        {
          sender: "elvy",
          text: aiReply,
        },
      ]);

      setIsSending(false);

      if (typeof data.repliesLeft === "number") {
        setRepliesLeft(data.repliesLeft);

        if (data.repliesLeft <= 0) {
          setShowTicketInfo(true);
        }
      }

      if (data.ticketBlocked) {
        setShowTicketInfo(true);
        setIsActivated(false);
        setRepliesLeft(0);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "elvy",
          text: "I am sorry. I cannot reply right now.",
        },
      ]);
      setIsSending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ececec] p-4">
      <div
        className="relative overflow-hidden rounded-[40px] bg-[#f8ead8] shadow-2xl"
        style={{ width: "390px", height: "844px" }}
      >
        <img
          src="/elvy-mobile.png"
          alt="Elvy Mobile"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {!chatOpen && !showTerms && !showAccountForm && (
          <>
            <button
              onClick={openTalkToElvy}
              className="absolute"
              style={{ left: "7%", top: "74.5%", width: "86%", height: "8%" }}
              aria-label="Talk to Elvy"
            />

            <button
              onClick={() => router.push("/mobile/meet")}
              className="absolute"
              style={{ left: "7%", top: "84%", width: "86%", height: "7%" }}
              aria-label="Meet Elvy"
            />

            <button
              onClick={() => router.push("/happy-office")}
              className="absolute"
              style={{ left: "7%", top: "88.7%", width: "86%", height: "6.5%" }}
              aria-label="Open Happy Office website"
            />
          </>
        )}

        {showTerms && (
          <div className="absolute left-4 right-4 bottom-4 z-50 max-h-[48%] overflow-y-auto rounded-[30px] bg-white/95 p-5 shadow-2xl backdrop-blur">
            <h2 className="text-xl font-bold text-[#3b2418]">Terms of Use</h2>

            <div className="mt-3 space-y-3 text-sm leading-6 text-[#6b5a4c]">
              <p>Elvy helps you express messages clearly, politely, and meaningfully.</p>
              <p>Elvy does not replace medical, legal, financial, psychological, or emergency services.</p>
              <p>Do not share passwords, bank details, private documents, or sensitive personal information.</p>
              <p>Please use Elvy respectfully. Harmful, abusive, or unsafe use is not allowed.</p>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-2xl bg-[#f4e6d6] p-3 text-sm text-[#3b2418]">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>I have read and agree to continue using Elvy.</span>
            </label>

            <button
              type="button"
              onClick={continueToChat}
              disabled={!acceptedTerms}
              className="mt-4 block w-full rounded-2xl px-5 py-3 text-center text-base font-bold shadow"
              style={{
                backgroundColor: acceptedTerms ? "#4a2d1f" : "#d8c8b6",
                color: acceptedTerms ? "#ffffff" : "#4a2d1f",
              }}
            >
              Continue
            </button>

            <button
              onClick={() => setShowTerms(false)}
              className="mt-3 block w-full rounded-2xl bg-[#f1e1cf] px-5 py-3 text-center text-[#4a2d1f]"
            >
              Cancel
            </button>
          </div>
        )}

        {showAccountForm && (
          <div
            className="absolute left-5 right-5 z-50 rounded-[32px] border border-[#ead8c0] bg-[#fff8ef]/95 px-5 py-4 shadow-[0_16px_38px_rgba(72,45,25,0.28)] backdrop-blur"
            style={{
              top: "47%",
            }}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d2ad62] text-lg text-white shadow-[0_6px_12px_rgba(72,45,25,0.22)]">
                👤
              </div>

              <div>
                <h2 className="text-[18px] font-extrabold leading-tight text-[#1f4f2b]">
                  <span className="text-[#d7ffd9] drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
  {accountMode === "register" ? "Create account" : "Log in"}
</span>
                </h2>

                <p className="mt-1 text-[12px] leading-5 text-[#5f4a38]">
                  Your account keeps your username, ticket, and credits so you can return to Elvy easily.
                </p>
              </div>
            </div>

            <div className="space-y-2">


              <div className="flex items-center gap-3 rounded-2xl border border-[#d8c5ad] bg-white/95 px-3 py-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04),0_4px_10px_rgba(72,45,25,0.08)]">
                <span className="text-base font-bold text-[#6d5a48]">@</span>
                <input
                  type="text"
                  value={accountUsername}
                  onChange={(e) => setAccountUsername(e.target.value)}
                  placeholder="Username"
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-[#2b1a12] outline-none placeholder:text-[#8d8074]"
                />
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-[#d8c5ad] bg-white/95 px-3 py-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04),0_4px_10px_rgba(72,45,25,0.08)]">
                <span className="text-base text-[#6d5a48]">🔒</span>
                <input
                  type="password"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  placeholder="Password"
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-[#2b1a12] outline-none placeholder:text-[#8d8074]"
                />
              </div>
            </div>

            {accountMessage && (
              <div className="mt-2 rounded-2xl border border-red-200 bg-white/95 px-3 py-2 shadow-sm">
                <p className="text-[12px] font-bold text-red-700">
                  {accountMessage}
                </p>
              </div>
            )}

<button
  type="button"
  onClick={submitAccount}
  className="mt-4 w-full rounded-[24px] border border-[#2f7d32] bg-gradient-to-b from-[#43a047] to-[#1f6b2b] px-5 py-3 text-center shadow-[0_10px_22px_rgba(31,107,43,0.35)] transition-all active:scale-[0.98]"
>
  <div className="flex items-center justify-center gap-3">
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-sm font-black text-[#eaffea] shadow-inner">
      ✓
    </div>

    <span className="text-[16px] font-extrabold tracking-[0.2px] text-[#f4fff4] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
      {accountMode === "register"
        ? "Create account"
        : "Log in"}
    </span>
  </div>
</button>

            <p className="mt-2 text-center text-[11px] font-semibold text-[#315b38]">
              Your information is secure and private.
            </p>

            <div className="my-2 flex items-center gap-3 text-[11px] font-bold text-[#9a8a78]">
              <div className="h-px flex-1 bg-[#e1d2bf]" />
              OR
              <div className="h-px flex-1 bg-[#e1d2bf]" />
            </div>

            <button
              type="button"
              onClick={() => {
                setAccountMode(accountMode === "register" ? "login" : "register");
                setAccountMessage("");
              }}
              className="block w-full rounded-2xl border border-[#4a2d1f] bg-white/85 px-4 py-2 text-center text-[13px] font-extrabold text-[#4a2d1f] shadow-sm"
            >
              {accountMode === "register"
                ? "I already have an account  ›"
                : "Create a new account  ›"}
            </button>

            <button
              onClick={() => setShowAccountForm(false)}
              className="mt-1 block w-full rounded-2xl px-5 py-1.5 text-center text-[13px] font-semibold text-[#6b5a4c]"
            >
              Cancel
            </button>
          </div>
        )}

        {chatOpen && (
          <div
            className="absolute left-0 right-0 bottom-0 z-50 flex flex-col overflow-hidden rounded-none border-t border-[#d8b98f] bg-[#fff4e5]/94 shadow-[0_-10px_28px_rgba(72,45,25,0.18)] backdrop-blur-md"
            style={{
              top: "45%",
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#3b2418]">
                  {account ? `Talk to Elvy · ${account.displayName}` : "Talk to Elvy"}
                </h2>
                {isActivated && (
                  <p className="text-[11px] font-bold text-green-700">
                    Active · {repliesLeft} credits left
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {account && (
                  <button
                    onClick={logoutAccount}
                    className="rounded-full bg-[#f1e1cf] px-3 py-1 text-xs text-[#4a2d1f]"
                  >
                    Logout
                  </button>
                )}

                <button
                  onClick={() => setChatOpen(false)}
                  className="rounded-full bg-[#f1e1cf] px-3 py-1 text-xs text-[#4a2d1f]"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-none border border-[#e2c49c] bg-[#fff8ef]/70 p-3">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`max-w-[78%] px-4 py-3 text-sm leading-6 ${
                    msg.sender === "elvy"
                      ? "mr-auto rounded-[22px] bg-white text-[#2b1a12] font-medium shadow-[0_3px_10px_rgba(0,0,0,0.08)]"
                      : "ml-auto rounded-[22px] border border-[#7fc2ff] bg-[#cfe9ff] text-[16px] font-bold text-[#11314d] shadow-[0_4px_12px_rgba(80,160,255,0.18)]"
                  }`}
                >
                  {msg.text}
                </div>
              ))}

              {isSending && (
                <div className="mr-auto max-w-[78%] rounded-2xl bg-white/90 px-3 py-2 text-sm font-medium leading-5 text-[#2b1a12] shadow-sm">
                  Elvy is replying...
                </div>
              )}

              <div ref={messagesEndRef} />

              {showTicketInfo && (
                <div className="rounded-2xl bg-[#f7eadb] p-3 text-sm text-[#3b2418]">
                  <p className="font-semibold">
  To continue, please activate an Elvy Ticket.
</p>
                  {paymentOpen && ((paypalActive && paypalLink) || (skrillActive && skrillLink)) ? (
                    <>
                      <p className="mt-1">Ticket price: $4</p>
                      <p className="mt-1">Balance: 2000 text credits</p>
                      <p className="mt-1">Validity: no time limit</p>
                      <p className="mt-1">Voice access will be available later as a separate ticket.</p>
                      <p className="mt-1">After payment, enter your activation code to unlock Elvy.</p>

                      {paypalActive && paypalLink && (
                        <button
                          onClick={() => window.open(paypalLink, "_blank")}
                          className="mt-3 w-full rounded-xl py-2 text-white font-bold shadow-md"
                          style={{ background: "#0070E0" }}
                        >
                          Pay with PayPal
                        </button>
                      )}

                      {skrillActive && skrillLink && (
                        <button
                          onClick={() => window.open(skrillLink, "_blank")}
                          className="mt-2 w-full rounded-xl py-2 text-white font-bold shadow-md"
                          style={{ background: "#862165" }}
                        >
                          Pay with Skrill
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="mt-3 rounded-xl bg-[#f3e5d7] p-3 text-xs font-medium text-[#5b4332]">
                      Ticket activation is not available at the moment.
                      <br />
                      <br />
                      If you need help, you can contact Happy Office using your personal code.
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={activationCode}
                      placeholder="Activation code"
                      onChange={(e) => setActivationCode(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-[#e2d2bf] bg-white px-3 py-2 text-sm outline-none"
                    />

                    <button
                      onClick={activateCode}
                      className="shrink-0 rounded-xl px-4 py-2 text-sm font-bold text-white transition-all"
                      style={{
                        backgroundColor:
                          activationCode.trim().length > 0 ? "#16a34a" : "#bfae9d",
                        opacity: activationCode.trim().length > 0 ? 1 : 0.6,
                      }}
                    >
                      Activate
                    </button>
                  </div>

                  {activationMessage && (
                    <p
                      className={`mt-2 text-xs font-bold ${
                        isActivated ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {activationMessage}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3">
              <input
                ref={inputRef}
                value={input}
                disabled={isSending}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                type="text"
                placeholder={isSending ? "Elvy is replying..." : "Write..."}
                className="min-w-0 flex-[1.4] rounded-none border border-[#d8b98f] bg-white px-5 py-4 text-[15px] font-medium text-[#2b1a12] shadow-sm outline-none placeholder:text-[#9a8d80]"
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={isSending}
                className="shrink-0 rounded-none border border-[#1d7fe2] bg-[#1d7fe2] px-5 py-4 text-[15px] font-extrabold text-white shadow-md transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: isSending ? "#9fc8ef" : "#1d7fe2",
                  color: "#ffffff",
                  minWidth: "70px",
                  opacity: isSending ? 0.7 : 1,
                }}
              >
                {isSending ? "Wait" : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
