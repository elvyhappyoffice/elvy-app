"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  sender: "elvy" | "user";
  text: string;
};

const FREE_REPLIES_LIMIT = 3;
const FREE_REPLIES_USED_KEY = "elvy_mobile_free_replies_used";
const FREE_TRIAL_CODE_KEY = "elvy_mobile_free_trial_code";

function createFreeTrialCode() {
  return `FREE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MobileElvyPage() {
  const router = useRouter();

  const AI_CONNECTED = true;

  const [showTerms, setShowTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

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

  function openTalkToElvy() {
    setShowTerms(true);
    setChatOpen(false);
    setAcceptedTerms(false);
  }

  function continueToChat() {
    if (!acceptedTerms) return;
    setShowTerms(false);
    setChatOpen(true);
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
          freeTrialCode,
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

        {!chatOpen && !showTerms && (
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

        {chatOpen && (
          <div
            className="absolute left-0 right-0 bottom-0 z-50 flex flex-col rounded-t-[34px] bg-white/96 p-4 shadow-2xl backdrop-blur"
            style={{
              top: "47%",
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#3b2418]">Talk to Elvy</h2>
                {isActivated && (
                  <p className="text-[11px] font-bold text-green-700">
                    Active · {repliesLeft} credits left
                  </p>
                )}
              </div>

              <button
                onClick={() => setChatOpen(false)}
                className="rounded-full bg-[#f1e1cf] px-3 py-1 text-xs text-[#4a2d1f]"
              >
                Close
              </button>
            </div>

            <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-[#f7efe5] p-3">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-5 ${
                    msg.sender === "elvy"
                      ? "mr-auto bg-white/90 text-[#2b1a12] font-medium shadow-sm"
                      : "ml-auto bg-[#6b3f28] text-black text-[17px] font-extrabold tracking-[0.2px] shadow-md"
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

            <div className="flex items-center gap-2">
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
                className="min-w-0 flex-[1.4] rounded-2xl border border-[#e2d2bf] bg-white px-6 py-3 text-sm font-medium text-[#2b1a12] outline-none"
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={isSending}
                className="shrink-0 rounded-2xl px-4 py-3 text-sm font-bold shadow transition-all"
                style={{
                  backgroundColor: isSending ? "#bfae9d" : "#4a2d1f",
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
