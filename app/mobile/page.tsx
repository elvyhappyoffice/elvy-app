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
  const recognitionRef = useRef<any>(null);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const speechSupported =
  typeof window !== "undefined" &&
  (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
  const [speechWarningShown, setSpeechWarningShown] = useState(false);

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
        setChatOpen(true);
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

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // Ignore cleanup errors.
      }

      try {
        window.speechSynthesis?.cancel?.();
        setIsSpeaking(false);
        setSpeakingMessageIndex(null);
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, []);

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

  function startVoiceInput() {
    if (isSending || isListening) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

if (!SpeechRecognition) {
  if (!speechWarningShown) {
    setMessages((prev) => [
      ...prev,
      {
        sender: "elvy",
        text: "Speech recognition is not supported on this browser. You can still type your message.",
      },
    ]);

    setSpeechWarningShown(true);
  }

  return;
}

    try {
      const recognition = new SpeechRecognition();

      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
        setMessages((prev) => [
          ...prev,
          {
            sender: "elvy",
            text: "I could not hear clearly. Please try again or type your message.",
          },
        ]);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        const cleanTranscript = transcript.trim();

        if (cleanTranscript) {
          setInput(cleanTranscript);
          inputRef.current?.focus();

          if (voiceMode) {
            window.setTimeout(() => {
              sendMessage(cleanTranscript);
            }, 1200);
          }
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setMessages((prev) => [
        ...prev,
        {
          sender: "elvy",
          text: "Microphone access could not start. Please check your browser permission or type your message.",
        },
      ]);
    }
  }

  function detectSpeechLanguage(text: string) {
    const cleanText = text.toLowerCase();

    if (/[\u0600-\u06FF]/.test(text)) return "ar";
    if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
    if (/[\u3040-\u30FF]/.test(text)) return "ja";
    if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
    if (/[\u0400-\u04FF]/.test(text)) return "ru";
    if (/[\u0370-\u03FF]/.test(text)) return "el";
    if (/[\u0590-\u05FF]/.test(text)) return "he";
    if (/[\u0E00-\u0E7F]/.test(text)) return "th";

    if (
      /[àâäéèêëîïôöùûüÿçœ]/i.test(text) ||
      /\b(bonjour|merci|salut|comment|vous|être|avec|pourquoi|parce que|aujourd'hui|français|francaise)\b/i.test(cleanText)
    ) {
      return "fr";
    }

    if (
      /[ñ¿¡áéíóúü]/i.test(text) ||
      /\b(hola|gracias|buenos|buenas|como|cómo|usted|español|porque|mañana)\b/i.test(cleanText)
    ) {
      return "es";
    }

    if (
      /[äöüß]/i.test(text) ||
      /\b(hallo|danke|guten|guten tag|ich|nicht|deutsch|bitte|warum)\b/i.test(cleanText)
    ) {
      return "de";
    }

    if (
      /\b(ciao|grazie|buongiorno|buonasera|italiano|perché|come stai|arrivederci)\b/i.test(cleanText)
    ) {
      return "it";
    }

    if (
      /[ãõ]/i.test(text) ||
      /\b(olá|ola|obrigado|obrigada|português|portugues|bom dia|boa tarde|porque)\b/i.test(cleanText)
    ) {
      return "pt";
    }

    return "en";
  }

  function chooseVoiceForLanguage(
    voices: SpeechSynthesisVoice[],
    languageCode: string
  ) {
    const lowerLanguage = languageCode.toLowerCase();

    const exactLanguageVoice = voices.find((voice) =>
      voice.lang.toLowerCase().startsWith(lowerLanguage)
    );

    if (exactLanguageVoice) return exactLanguageVoice;

    if (lowerLanguage === "en") {
      return (
        voices.find((voice) =>
          voice.name.toLowerCase().includes("david")
        ) ||
        voices.find((voice) =>
          voice.name.toLowerCase().includes("mark")
        ) ||
        voices.find((voice) =>
          voice.name.toLowerCase().includes("male")
        ) ||
        voices.find((voice) =>
          voice.lang.toLowerCase().startsWith("en")
        )
      );
    }

    return (
      voices.find((voice) =>
        voice.lang.toLowerCase().startsWith("en")
      ) || null
    );
  }

  function speakText(text: string, messageIndex: number) {
    if (typeof window === "undefined") return;

    const synth = window.speechSynthesis;
    if (!synth) return;

    if (synth.speaking) {
      synth.cancel();
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
      return;
    }

    const detectedLanguage = detectSpeechLanguage(text);
    const voices = synth.getVoices();
    const preferredVoice = chooseVoiceForLanguage(voices, detectedLanguage);

    const utterance = new SpeechSynthesisUtterance(text);

    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
    } else {
      const fallbackLanguageMap: Record<string, string> = {
        ar: "ar-SA",
        fr: "fr-FR",
        es: "es-ES",
        de: "de-DE",
        it: "it-IT",
        pt: "pt-PT",
        zh: "zh-CN",
        ja: "ja-JP",
        ko: "ko-KR",
        ru: "ru-RU",
        el: "el-GR",
        he: "he-IL",
        th: "th-TH",
        en: "en-US",
      };

      utterance.lang = fallbackLanguageMap[detectedLanguage] || "en-US";
    }

    utterance.rate = 0.9;
    utterance.pitch = detectedLanguage === "en" ? 0.85 : 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingMessageIndex(messageIndex);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
    };

    synth.cancel();
    synth.speak(utterance);
  }

  async function sendMessage(messageOverride?: string) {
    const text = (messageOverride ?? input).trim();
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
          recentMessages: [
            ...messages,
            {
              sender: "user",
              text,
            },
          ].slice(-14),
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

      if (voiceMode) {
        const nextElvyMessageIndex = messages.length + 1;

        window.setTimeout(() => {
          speakText(aiReply, nextElvyMessageIndex);
        }, 250);
      }

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

        {!account && !chatOpen && !showTerms && !showAccountForm && (
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
            className="absolute z-50 flex flex-col overflow-hidden"
            style={{
              left: "14px",
              right: "14px",
              top: "47%",
              bottom: "18px",
              borderRadius: "26px",
              background: "rgba(255, 244, 229, 0.96)",
              border: "1px solid rgba(216, 185, 143, 0.75)",
              boxShadow: "0 18px 38px rgba(72, 45, 25, 0.24)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              padding: "14px 14px 12px 14px",
            }}
          >
            <div
              className="flex shrink-0 items-start justify-between"
              style={{
                paddingBottom: "10px",
                borderBottom: "1px solid rgba(216, 185, 143, 0.85)",
                gap: "8px",
              }}
            >
              <div style={{ minWidth: 0, paddingLeft: "2px" }}>
                <h2
                  className="font-bold text-[#3b2418]"
                  style={{
                    fontSize: "15px",
                    lineHeight: "20px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "190px",
                  }}
                >
                  {account ? `Talk to Elvy · ${account.displayName}` : "Talk to Elvy"}
                </h2>
                {isActivated && (
                  <p
                    className="font-bold text-green-700"
                    style={{ fontSize: "12px", lineHeight: "18px" }}
                  >
                    Active · {repliesLeft} credits left
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center" style={{ gap: "6px" }}>
                {account && (
                  <button
                    onClick={logoutAccount}
                    className="rounded-full bg-[#f1e1cf] text-[#4a2d1f]"
                    style={{ padding: "6px 10px", fontSize: "11px" }}
                  >
                    Logout
                  </button>
                )}

                <button
                  onClick={() => setChatOpen(false)}
                  className="rounded-full bg-[#f1e1cf] text-[#4a2d1f]"
                  style={{ padding: "6px 10px", fontSize: "11px" }}
                >
                  Close
                </button>
              </div>
            </div>

            <div
              className="min-h-0 flex-1 space-y-3 overflow-y-auto"
              style={{
                padding: "16px 4px 10px 4px",
                background: "transparent",
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(166, 124, 82, 0.35) transparent",
              }}
            >
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`max-w-[82%] px-4 py-3 text-sm leading-6 ${
                    msg.sender === "elvy"
                      ? "mr-auto rounded-[22px] bg-white text-[#2b1a12] font-medium shadow-[0_3px_10px_rgba(0,0,0,0.08)]"
                      : "ml-auto rounded-[22px] border border-[#7fc2ff] bg-[#cfe9ff] text-[16px] font-bold text-[#11314d] shadow-[0_4px_12px_rgba(80,160,255,0.18)]"
                  }`}
                >
                  <div>{msg.text}</div>

                  {msg.sender === "elvy" && (
                    <button
                      type="button"
                      onClick={() => speakText(msg.text, index)}
                      className="mt-2 inline-flex items-center rounded-full bg-[#eef7ff] px-3 py-1 text-[12px] font-bold text-[#1d7fe2] shadow-sm transition-all active:scale-[0.98]"
                      style={{ border: "1px solid rgba(29, 127, 226, 0.22)" }}
                    >
                      {isSpeaking && speakingMessageIndex === index ? (
                        <>
                          <span>🔊</span>
                          <span
                            style={{
                              marginLeft: "6px",
                              color: "#118a3b",
                              fontSize: "10px",
                              fontWeight: 600,
                              opacity: 0.85,
                            }}
                          >
                            Elvy is speaking...
                          </span>
                        </>
                      ) : (
                        "🔊 Listen"
                      )}
                    </button>
                  )}
                </div>
              ))}

              {isSending && (
                <div className="mr-auto max-w-[82%] rounded-2xl bg-white/90 px-3 py-2 text-sm font-medium leading-5 text-[#2b1a12] shadow-sm">
                  Elvy is replying...
                </div>
              )}

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

              {isListening && (
                <div
                  className="mx-auto rounded-full bg-[#fff8ef] px-4 py-2 text-center text-xs font-bold text-[#118a3b] shadow-sm"
                  style={{ border: "1px solid rgba(31, 107, 43, 0.25)" }}
                >
                  Listening... speak now
                </div>
              )}


              <div ref={messagesEndRef} />
            </div>

            <div
              className="flex shrink-0 items-center"
              style={{
                gap: "10px",
                paddingTop: "10px",
                borderTop: "1px solid rgba(226, 196, 156, 0.75)",
              }}
            >
              <input
                ref={inputRef}
                value={input}
                disabled={isSending}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                type="text"
                placeholder={
                  isSending
                    ? "Elvy is replying..."
                    : isListening
                      ? "Listening... speak now"
                      : "Write..."
                }
                className="min-w-0 flex-1 bg-white text-[#2b1a12] outline-none placeholder:text-[#9a8d80]"
                style={{
                  height: "54px",
                  borderRadius: "24px",
                  border: "1px solid rgba(216, 185, 143, 0.75)",
                  padding: "0 18px",
                  fontSize: "15px",
                  fontWeight: 500,
                  boxShadow: "0 4px 12px rgba(72,45,25,0.08)",
                }}
              />

              <button
                type="button"
                onClick={startVoiceInput}
                disabled={isSending || isListening}
                className="flex shrink-0 items-center justify-center rounded-full text-white shadow-md transition-all active:scale-[0.98]"
                style={{
                  width: "54px",
                  height: "54px",
                  backgroundColor: isListening ? "#dc2626" : "#118a3b",
                  border: "1px solid rgba(31,107,43,0.75)",
                  fontSize: "22px",
                  opacity: isSending ? 0.7 : 1,
                  animation: isListening ? "pulse 1.2s infinite" : "none",
                }}
                title="Speak to Elvy"
              >
                {isListening ? "🔴" : "🎤"}
              </button>

              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={isSending}
                className="shrink-0 rounded-full text-white shadow-md transition-all active:scale-[0.98]"
                style={{
                  height: "54px",
                  minWidth: "72px",
                  padding: "0 18px",
                  border: "1px solid #1d7fe2",
                  backgroundColor: isSending ? "#9fc8ef" : "#1d7fe2",
                  fontSize: "15px",
                  fontWeight: 800,
                  opacity: isSending ? 0.7 : 1,
                }}
              >
                {isSending ? "Wait" : "Send"}
              </button>
            </div>
<div className="pt-1 text-center">
  {!isListening && !input.trim() && !isSending && (
    <div
      className="text-center font-medium"
      style={{
        color: "#1d7fe2",
        fontSize: "9px",
        opacity: 0.65,
        lineHeight: "12px",
      }}
    >
      Tap 🎤 to speak or type your message
    </div>
  )}

  <button
    type="button"
    onClick={() => setVoiceMode((prev) => !prev)}
    className="mt-1 inline-flex items-center justify-center rounded-full transition-all active:scale-[0.98]"
    style={{
      background: "transparent",
      border: "none",
      cursor: "pointer",
      fontSize: "10px",
      fontWeight: 800,
      lineHeight: "14px",
      padding: "0",
    }}
    aria-label={voiceMode ? "Turn voice mode off" : "Turn voice mode on"}
    title={voiceMode ? "Voice Mode ON" : "Voice Mode OFF"}
  >
    <span
      style={{
        color: voiceMode ? "#8a7563" : "#dc2626",
        opacity: voiceMode ? 0.7 : 1,
      }}
    >
      OFF
    </span>
    <span style={{ margin: "0 5px", fontSize: "11px" }}>🔘</span>
    <span
      style={{
        color: "#3b2418",
        margin: "0 2px",
        letterSpacing: "0.2px",
      }}
    >
      VOICE MODE
    </span>
    <span style={{ margin: "0 5px", fontSize: "11px" }}>🔘</span>
    <span
      style={{
        color: voiceMode ? "#118a3b" : "#8a7563",
        opacity: voiceMode ? 1 : 0.7,
      }}
    >
      ON
    </span>
  </button>
</div>
          </div>
        )}
      </div>
    </main>
  );
}
