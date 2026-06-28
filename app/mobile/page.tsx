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
  secondsRemaining: number;
  ticketStatus: string;
};

type StudentProfile = {
  id: string;
  name: string;
  username: string;
  password: string;
  code: string;
  level: string;
  sublevel: string;
  unit: string;
  lesson: number;
  lessonTitle?: string;
  status: "Active" | "Waiting Approval" | "Suspended";
  passHours?: number;
  secondsRemaining?: number;
  secondsUsed?: number;
};

const ELVY_ACCOUNT_KEY = "elvy_mobile_account";
const ELVY_STUDENT_PROFILE_KEY = "elvy_student_profile";
const FREE_REPLIES_LIMIT = 3;
const FREE_REPLIES_USED_KEY = "elvy_mobile_free_replies_used";
const FREE_TRIAL_CODE_KEY = "elvy_mobile_free_trial_code";
const SEEN_ADMIN_MESSAGES_KEY = "elvy_seen_admin_messages";

function createFreeTrialCode() {
  return `FREE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTimeLeft(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours <= 0) {
    return `${minutes}m left`;
  }

  return `${hours}h ${String(minutes).padStart(2, "0")}m left`;
}

function formatCompactTimeLeft(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));

  if (safeSeconds <= 0) {
    return "Expired";
  }

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export default function MobileElvyPage() {
  const router = useRouter();

  const AI_CONNECTED = true;

  const [showTerms, setShowTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [accountMode, setAccountMode] = useState<"login" | "register">(
    "register",
  );
  const [account, setAccount] = useState<ElvyAccount | null>(null);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [studentLoginCode, setStudentLoginCode] = useState("");
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(
    null,
  );
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
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [lastSecondsUsed, setLastSecondsUsed] = useState(0);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paypalActive, setPaypalActive] = useState(false);
  const [paypalLink, setPaypalLink] = useState("");
  const [skrillActive, setSkrillActive] = useState(false);
  const [skrillLink, setSkrillLink] = useState("");

  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const voiceRequestLockRef = useRef(false);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [voiceLoadingMessageIndex, setVoiceLoadingMessageIndex] = useState<
    number | null
  >(null);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<
    number | null
  >(null);
  const [speakingCharIndex, setSpeakingCharIndex] = useState<number | null>(
    null,
  );
  const [speakingWordLength, setSpeakingWordLength] = useState(0);
  const [voiceMode, setVoiceMode] = useState(false);
  const speechSupported =
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition);
  const [speechWarningShown, setSpeechWarningShown] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "elvy",
      text: "Hello. My name is Elvy. I am a communication companion. How can I help you?",
    },
  ]);

  const isStudentMode = Boolean(studentProfile?.code?.startsWith("STUDENT-"));

  const ticketRequired =
    !isStudentMode &&
    (showTicketInfo || (!isActivated && freeRepliesUsed >= FREE_REPLIES_LIMIT));

  const interactionLocked =
    isSending || isVoiceLoading || isSpeaking || ticketRequired;

  useEffect(() => {
    try {
      const savedStudent = localStorage.getItem(ELVY_STUDENT_PROFILE_KEY);

      if (savedStudent) {
        const parsedStudent = JSON.parse(savedStudent) as StudentProfile;

        if (
          parsedStudent?.username &&
          parsedStudent?.code?.startsWith("STUDENT-")
        ) {
          setStudentProfile(parsedStudent);
          setAccount({
            username: parsedStudent.username,
            displayName: parsedStudent.name || parsedStudent.username,
            userCode: parsedStudent.code,
            creditsLeft: 0,
            secondsRemaining: Number(parsedStudent.secondsRemaining || 0),
            ticketStatus: "StudentActive",
          });
          setIsActivated(true);
          setActiveUserCode(parsedStudent.code);
          setRepliesLeft(0);
          setSecondsRemaining(Number(parsedStudent.secondsRemaining || 0));
          setMessages([
            {
              sender: "elvy",
              text: `Welcome back, ${parsedStudent.name || parsedStudent.username}. Your lesson is ${parsedStudent.level} / ${parsedStudent.sublevel} / ${parsedStudent.unit} / Lesson ${parsedStudent.lesson}${parsedStudent.lessonTitle ? `: ${parsedStudent.lessonTitle}` : ""}.`,
            },
          ]);
          setChatOpen(true);
          return;
        }
      }

      const savedAccount = localStorage.getItem(ELVY_ACCOUNT_KEY);
      if (!savedAccount) return;

      const parsed = JSON.parse(savedAccount) as ElvyAccount;
      if (parsed?.username && parsed?.userCode) {
        setAccount(parsed);
        setIsActivated(
          parsed.ticketStatus === "Active" &&
            (Number(parsed.creditsLeft || 0) > 0 ||
              Number(parsed.secondsRemaining || 0) > 0),
        );
        setActiveUserCode(parsed.userCode);
        setRepliesLeft(Number(parsed.creditsLeft || 0));
        setSecondsRemaining(Number(parsed.secondsRemaining || 0));
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
      localStorage.removeItem(ELVY_STUDENT_PROFILE_KEY);
    }
  }, []);

  useEffect(() => {
    const savedUsed = Number(
      localStorage.getItem(FREE_REPLIES_USED_KEY) || "0",
    );
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
          },
        );

        const data = await response.json();

        if (!data?.success || !Array.isArray(data.messages)) {
          return;
        }

        const latestMessage = data.messages[data.messages.length - 1];

        if (!latestMessage) return;

        const seenMessages = JSON.parse(
          localStorage.getItem(SEEN_ADMIN_MESSAGES_KEY) || "[]",
        );

        if (seenMessages.includes(latestMessage)) {
          return;
        }

        localStorage.setItem(
          SEEN_ADMIN_MESSAGES_KEY,
          JSON.stringify([...seenMessages, latestMessage]),
        );

        setMessages((prev) => {
          const alreadyExists = prev.some((msg) => msg.text === latestMessage);

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
    if (!studentProfile?.code?.startsWith("STUDENT-")) return;

    async function refreshStudentTicket() {
      try {
        const response = await fetch("/api/students", { cache: "no-store" });
        const data = await response.json();

        const latestStudent = data?.students?.find(
          (item: StudentProfile) => item.code === studentProfile?.code,
        ) as StudentProfile | undefined;

        if (!latestStudent) return;

        setStudentProfile(latestStudent);
        setSecondsRemaining(Number(latestStudent.secondsRemaining || 0));
        localStorage.setItem(
          ELVY_STUDENT_PROFILE_KEY,
          JSON.stringify(latestStudent),
        );
      } catch (error) {
        console.error("Student ticket refresh failed:", error);
      }
    }

    refreshStudentTicket();

    const interval = window.setInterval(refreshStudentTicket, 15000);

    return () => window.clearInterval(interval);
  }, [studentProfile?.code]);

  useEffect(() => {
    if (!studentProfile?.code?.startsWith("STUDENT-")) return;
    if (studentProfile.status !== "Active") return;

    const interval = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        const nextSeconds = Math.max(Number(prev || 0) - 1, 0);

        setStudentProfile((currentStudent) => {
          if (!currentStudent) return currentStudent;

          const updatedStudent = {
            ...currentStudent,
            secondsRemaining: nextSeconds,
          };

          localStorage.setItem(
            ELVY_STUDENT_PROFILE_KEY,
            JSON.stringify(updatedStudent),
          );

          return updatedStudent;
        });

        return nextSeconds;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [studentProfile?.code, studentProfile?.status]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
      }
    };

    loadVoices();

    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis.onvoiceschanged === loadVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // Ignore cleanup errors.
      }

      try {
        audioRef.current?.pause();
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
        audioRef.current = null;
        voiceRequestLockRef.current = false;
        setIsVoiceLoading(false);
        setVoiceLoadingMessageIndex(null);
      } catch {
        // Ignore cleanup errors.
      }

      try {
        window.speechSynthesis?.cancel?.();
        setIsSpeaking(false);
        setIsVoiceLoading(false);
        setVoiceLoadingMessageIndex(null);
        setSpeakingMessageIndex(null);
        setSpeakingCharIndex(null);
        setSpeakingWordLength(0);
        voiceRequestLockRef.current = false;
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

  async function tryStudentLogin(
    cleanUsername: string,
    cleanPassword: string,
    cleanStudentCode: string,
  ) {
    if (!cleanStudentCode.startsWith("STUDENT-")) {
      return false;
    }

    const response = await fetch("/api/students", { cache: "no-store" });
    const data = await response.json();

    const student = data?.students?.find(
      (item: StudentProfile) =>
        item.username === cleanUsername &&
        item.password === cleanPassword &&
        item.code === cleanStudentCode,
    ) as StudentProfile | undefined;

    if (!student) {
      setAccountMessage(
        "Student account not found. Check username, password, and student code.",
      );
      return true;
    }

    if (student.status === "Suspended") {
      setAccountMessage(
        "This student account is suspended. Please contact the center.",
      );
      return true;
    }

    localStorage.removeItem(ELVY_ACCOUNT_KEY);
    localStorage.setItem(ELVY_STUDENT_PROFILE_KEY, JSON.stringify(student));

    const studentAccount: ElvyAccount = {
      username: student.username,
      displayName: student.name || student.username,
      userCode: student.code,
      creditsLeft: 0,
      secondsRemaining: Number(student.secondsRemaining || 0),
      ticketStatus: "StudentActive",
    };

    setStudentProfile(student);
    setAccount(studentAccount);
    setIsActivated(true);
    setActiveUserCode(student.code);
    setRepliesLeft(0);
    setSecondsRemaining(Number(student.secondsRemaining || 0));
    setShowTicketInfo(false);
    setShowAccountForm(false);
    setChatOpen(true);
    setAccountMessage("");
    setMessages([
      {
        sender: "elvy",
        text: `Welcome ${student.name || student.username}. You are now in Language Center mode. Your current lesson is ${student.level} / ${student.sublevel} / ${student.unit} / Lesson ${student.lesson}${student.lessonTitle ? `: ${student.lessonTitle}` : ""}.`,
      },
    ]);

    return true;
  }

  async function submitAccount() {
    const cleanUsername = accountUsername.trim().toLowerCase();
    const cleanPassword = accountPassword.trim();
    const cleanStudentCode = studentLoginCode.trim().toUpperCase();
    const cleanDisplayName = accountDisplayName.trim();

    if (!cleanUsername || !cleanPassword) {
      setAccountMessage("Username and password are required.");
      return;
    }

    try {
      if (accountMode === "login" && cleanStudentCode.startsWith("STUDENT-")) {
        const studentLoginHandled = await tryStudentLogin(
          cleanUsername,
          cleanPassword,
          cleanStudentCode,
        );

        if (studentLoginHandled) return;
      }

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
        displayName:
          data.account.displayName ||
          data.account.display_name ||
          cleanUsername,
        userCode: data.account.userCode || data.account.user_code,
        creditsLeft: Number(
          data.account.creditsLeft ?? data.account.credits_left ?? 0,
        ),
        secondsRemaining: Number(
          data.account.secondsRemaining ?? data.account.seconds_remaining ?? 0,
        ),
        ticketStatus:
          data.account.ticketStatus || data.account.ticket_status || "Free",
      };

      localStorage.setItem(ELVY_ACCOUNT_KEY, JSON.stringify(nextAccount));
      localStorage.removeItem(ELVY_STUDENT_PROFILE_KEY);
      setStudentProfile(null);
      if (accountMode === "register") {
        localStorage.removeItem(FREE_REPLIES_USED_KEY);
        localStorage.removeItem(FREE_TRIAL_CODE_KEY);

        setFreeRepliesUsed(0);

        const newFreeTrialCode = createFreeTrialCode();

        localStorage.setItem(FREE_TRIAL_CODE_KEY, newFreeTrialCode);

        setFreeTrialCode(newFreeTrialCode);
      }

      setAccount(nextAccount);

      const activated =
        nextAccount.ticketStatus === "Active" &&
        (Number(nextAccount.creditsLeft || 0) > 0 ||
          Number(nextAccount.secondsRemaining || 0) > 0);

      setIsActivated(activated);

      setActiveUserCode(activated ? nextAccount.userCode : "");

      setRepliesLeft(Number(nextAccount.creditsLeft || 0));
      setSecondsRemaining(Number(nextAccount.secondsRemaining || 0));

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
    localStorage.removeItem(ELVY_STUDENT_PROFILE_KEY);
    setStudentProfile(null);
    setAccount(null);
    setIsActivated(false);
    setActiveUserCode("");
    setRepliesLeft(0);
    setSecondsRemaining(0);
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
        secondsRemaining: Number(
          data.user?.secondsRemaining || data.user?.seconds_remaining || 0,
        ),
        ticketStatus: "Active",
      };

      setAccount(updatedAccount);

      localStorage.setItem(ELVY_ACCOUNT_KEY, JSON.stringify(updatedAccount));

      setActiveUserCode(data.user?.code || cleanCode);

      setRepliesLeft(Number(data.user?.repliesLeft || 0));
      setSecondsRemaining(
        Number(data.user?.secondsRemaining || data.user?.seconds_remaining || 0),
      );

      setShowTicketInfo(false);

      setActivationMessage("Elvy is activated.");

      setMessages((prev) => [
        ...prev,
        {
          sender: "elvy",
          text: `Elvy is activated. Your ticket is active.`,
        },
      ]);
    } catch (error) {
      setActivationMessage("Activation failed. Please try again.");
    }
  }

  function startVoiceInput() {
    if (
      isSending ||
      isListening ||
      isVoiceLoading ||
      isSpeaking ||
      ticketRequired
    )
      return;

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
    if (/[\u0900-\u097F]/.test(text)) return "hi";
    if (/[\u0980-\u09FF]/.test(text)) return "bn";
    if (/[\u0E80-\u0EFF]/.test(text)) return "lo";

    if (
      /[àâäéèêëîïôöùûüÿçœ]/i.test(text) ||
      /\b(bonjour|merci|salut|comment|vous|être|avec|pourquoi|parce que|aujourd'hui|français|francaise)\b/i.test(
        cleanText,
      )
    ) {
      return "fr";
    }

    if (
      /[ñ¿¡áéíóúü]/i.test(text) ||
      /\b(hola|gracias|buenos|buenas|como|cómo|usted|español|porque|mañana)\b/i.test(
        cleanText,
      )
    ) {
      return "es";
    }

    if (
      /[äöüß]/i.test(text) ||
      /\b(hallo|danke|guten|guten tag|ich|nicht|deutsch|bitte|warum)\b/i.test(
        cleanText,
      )
    ) {
      return "de";
    }

    if (
      /\b(ciao|grazie|buongiorno|buonasera|italiano|perché|come stai|arrivederci)\b/i.test(
        cleanText,
      )
    ) {
      return "it";
    }

    if (
      /[ãõ]/i.test(text) ||
      /\b(olá|ola|obrigado|obrigada|português|portugues|bom dia|boa tarde|porque)\b/i.test(
        cleanText,
      )
    ) {
      return "pt";
    }

    return "en";
  }

  function getFallbackSpeechLang(languageCode: string) {
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
      hi: "hi-IN",
      bn: "bn-BD",
      lo: "lo-LA",
      en: "en-US",
    };

    return fallbackLanguageMap[languageCode] || "en-US";
  }

  function chooseVoiceForLanguage(
    voices: SpeechSynthesisVoice[],
    languageCode: string,
  ) {
    const lowerLanguage = languageCode.toLowerCase();
    const preferredLang = getFallbackSpeechLang(lowerLanguage).toLowerCase();

    const voiceNameIncludes = (voice: SpeechSynthesisVoice, pattern: string) =>
      voice.name.toLowerCase().includes(pattern);

    if (lowerLanguage === "en") {
      return (
        voices.find(
          (voice) =>
            voice.lang.toLowerCase() === "en-us" &&
            (voiceNameIncludes(voice, "david") ||
              voiceNameIncludes(voice, "mark") ||
              voiceNameIncludes(voice, "george") ||
              voiceNameIncludes(voice, "male")),
        ) ||
        voices.find(
          (voice) =>
            voiceNameIncludes(voice, "david") ||
            voiceNameIncludes(voice, "mark") ||
            voiceNameIncludes(voice, "george") ||
            voiceNameIncludes(voice, "male"),
        ) ||
        voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ||
        null
      );
    }

    if (lowerLanguage === "ar") {
      return (
        voices.find((voice) => voice.lang.toLowerCase() === "ar-ma") ||
        voices.find((voice) => voice.lang.toLowerCase() === "ar-sa") ||
        voices.find((voice) => voice.lang.toLowerCase() === "ar-eg") ||
        voices.find((voice) => voice.lang.toLowerCase().startsWith("ar")) ||
        voices.find((voice) => voiceNameIncludes(voice, "arabic")) ||
        voices.find((voice) => voiceNameIncludes(voice, "arab")) ||
        null
      );
    }

    return (
      voices.find((voice) => voice.lang.toLowerCase() === preferredLang) ||
      voices.find((voice) =>
        voice.lang.toLowerCase().startsWith(lowerLanguage),
      ) ||
      null
    );
  }

  function renderMessageText(text: string, messageIndex: number) {
    if (
      !isSpeaking ||
      speakingMessageIndex !== messageIndex ||
      speakingCharIndex === null
    ) {
      return text;
    }

    const parts = text.match(/\S+|\s+/g) || [text];
    let currentIndex = 0;

    return parts.map((part, partIndex) => {
      const start = currentIndex;
      const end = start + part.length;
      currentIndex = end;

      const isWord = /\S/.test(part);
      const activeEnd =
        speakingWordLength > 0
          ? speakingCharIndex + speakingWordLength
          : speakingCharIndex + 1;

      const isActiveWord =
        isWord && speakingCharIndex < end && activeEnd > start;

      return (
        <span
          key={`${messageIndex}-${partIndex}-${start}`}
          style={
            isActiveWord
              ? {
                  backgroundColor: "#d9fdd3",
                  color: "#12351c",
                  borderRadius: "6px",
                  padding: "0 3px",
                  transition: "background-color 0.12s ease",
                }
              : undefined
          }
        >
          {part}
        </span>
      );
    });
  }

  async function speakText(text: string, messageIndex: number) {
    if (typeof window === "undefined") return;

    // Prevent double clicks from starting more than one OpenAI TTS request.
    // Once clicked, the speaker remains locked until the audio fully ends or fails.
    if (
      voiceRequestLockRef.current ||
      isVoiceLoading ||
      isSpeaking ||
      audioRef.current
    ) {
      return;
    }

    voiceRequestLockRef.current = true;
    setIsVoiceLoading(true);
    setVoiceLoadingMessageIndex(messageIndex);
    setSpeakingMessageIndex(messageIndex);
    setSpeakingCharIndex(null);
    setSpeakingWordLength(0);

    const stopCurrentSpeech = () => {
      try {
        audioRef.current?.pause();
      } catch {
        // Ignore pause errors.
      }

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      audioRef.current = null;
      voiceRequestLockRef.current = false;

      try {
        window.speechSynthesis?.cancel?.();
      } catch {
        // Ignore browser speech cancel errors.
      }

      setIsVoiceLoading(false);
      setVoiceLoadingMessageIndex(null);
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
      setSpeakingCharIndex(null);
      setSpeakingWordLength(0);
    };

    const restartMicAfterSpeech = () => {
      if (voiceMode && chatOpen && !isSending) {
        window.setTimeout(() => {
          startVoiceInput();
        }, 700);
      }
    };

    const startTimedHighlighting = (audio: HTMLAudioElement) => {
      const wordMatches = Array.from(text.matchAll(/\S+/g));
      if (wordMatches.length === 0) return null;

      let animationFrame: number | null = null;
      let lastWordIndex = -1;

      const updateHighlight = () => {
        const fallbackDuration = Math.max(2.5, text.length / 10);
        const duration =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : fallbackDuration;

        const progress = Math.min(
          0.999,
          Math.max(0, audio.currentTime / duration),
        );

        const wordIndex = Math.min(
          wordMatches.length - 1,
          Math.floor(progress * wordMatches.length),
        );

        if (wordIndex !== lastWordIndex) {
          const currentWord = wordMatches[wordIndex];

          if (currentWord && typeof currentWord.index === "number") {
            setSpeakingCharIndex(currentWord.index);
            setSpeakingWordLength(currentWord[0].length);
            lastWordIndex = wordIndex;
          }
        }

        if (!audio.paused && !audio.ended) {
          animationFrame = window.requestAnimationFrame(updateHighlight);
        }
      };

      animationFrame = window.requestAnimationFrame(updateHighlight);

      return () => {
        if (animationFrame !== null) {
          window.cancelAnimationFrame(animationFrame);
        }
      };
    };

    if (audioRef.current) {
      return;
    }

    try {
      // OpenAI TTS must be the only voice. Always cancel browser speech first.
      window.speechSynthesis?.cancel?.();

      const response = await fetch("/api/elvy-tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice: "ash",
        }),
      });

      if (!response.ok) {
        throw new Error("OpenAI TTS request failed.");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audioRef.current = audio;
      audioUrlRef.current = audioUrl;

      let stopHighlighting: (() => void) | null = null;

      audio.onplay = () => {
        // Cancel again in case the browser started any queued speech.
        try {
          window.speechSynthesis?.cancel?.();
        } catch {
          // Ignore browser speech cancel errors.
        }

        setIsVoiceLoading(false);
        setVoiceLoadingMessageIndex(null);
        setIsSpeaking(true);
        setSpeakingMessageIndex(messageIndex);
        setSpeakingCharIndex(null);
        setSpeakingWordLength(0);

        stopHighlighting = startTimedHighlighting(audio);
      };

      audio.onended = () => {
        stopHighlighting?.();

        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }

        audioRef.current = null;
        voiceRequestLockRef.current = false;
        setIsVoiceLoading(false);
        setVoiceLoadingMessageIndex(null);
        setIsSpeaking(false);
        setSpeakingMessageIndex(null);
        setSpeakingCharIndex(null);
        setSpeakingWordLength(0);
        restartMicAfterSpeech();
      };

      audio.onerror = () => {
        stopHighlighting?.();

        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }

        audioRef.current = null;
        voiceRequestLockRef.current = false;
        setIsVoiceLoading(false);
        setVoiceLoadingMessageIndex(null);
        setIsSpeaking(false);
        setSpeakingMessageIndex(null);
        setSpeakingCharIndex(null);
        setSpeakingWordLength(0);

        console.error("OpenAI TTS audio playback failed.");
      };

      await audio.play();
    } catch (error) {
      console.error(
        "OpenAI TTS failed. No browser voice fallback will be used:",
        error,
      );
      stopCurrentSpeech();
    }
  }

  async function sendMessage(messageOverride?: string) {
    const text = (messageOverride ?? input).trim();
    if (!text || isSending || isVoiceLoading || isSpeaking || ticketRequired)
      return;

    if (studentProfile?.status === "Waiting Approval") {
      setMessages((prev) => [
        ...prev,
        { sender: "user", text },
        {
          sender: "elvy",
          text: "You have completed this lesson. Please contact the center to unlock the next lesson.",
        },
      ]);
      setInput("");
      return;
    }

    if (studentProfile?.status === "Suspended") {
      setMessages((prev) => [
        ...prev,
        { sender: "user", text },
        {
          sender: "elvy",
          text: "Your student account is suspended. Please contact the center.",
        },
      ]);
      setInput("");
      return;
    }

    const studentTicketActive =
      Boolean(studentProfile?.status === "Active") && secondsRemaining > 0;
    const studentModeAllowed = Boolean(studentProfile?.status === "Active") && studentTicketActive;
    const paidModeAllowed =
      !studentProfile &&
      isActivated &&
      (repliesLeft > 0 || secondsRemaining > 0);
    const freeModeAllowed =
      !studentProfile &&
      !paidModeAllowed &&
      freeRepliesUsed < FREE_REPLIES_LIMIT;

    if (studentProfile?.status === "Active" && !studentTicketActive) {
      setMessages((prev) => [
        ...prev,
        { sender: "user", text },
        {
          sender: "elvy",
          text: "Your student ticket time is finished. Please contact the center to renew your ticket.",
        },
      ]);
      setInput("");
      return;
    }

    if (!studentModeAllowed && !freeModeAllowed && !paidModeAllowed) {
      setShowTicketInfo(true);
      return;
    }

    setMessages((prev) => [...prev, { sender: "user", text }]);
    setInput("");

    let codeToSend = "";

    if (studentModeAllowed) {
      codeToSend = studentProfile?.code || "";
    } else if (freeModeAllowed) {
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
          studentMode: studentModeAllowed,
          studentProfile: studentProfile || null,
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

      const aiReply = data.reply || "I am sorry. I cannot reply right now.";

      if (typeof data.secondsUsed === "number") {
        setLastSecondsUsed(data.secondsUsed);
        console.log("Elvy interaction seconds used:", data.secondsUsed);

        if (paidModeAllowed && !studentModeAllowed) {
          setSecondsRemaining((prev) => Math.max(prev - data.secondsUsed, 0));
        }
      }

      if (typeof data.secondsRemaining === "number") {
        const nextSecondsRemaining = Math.max(Number(data.secondsRemaining || 0), 0);
        setSecondsRemaining(nextSecondsRemaining);

        if (studentProfile?.code?.startsWith("STUDENT-")) {
          setStudentProfile((prev) => {
            if (!prev) return prev;

            const updatedStudent = {
              ...prev,
              secondsRemaining: nextSecondsRemaining,
              secondsUsed:
                typeof data.secondsUsed === "number"
                  ? Number(prev.secondsUsed || 0) + Number(data.secondsUsed || 0)
                  : prev.secondsUsed,
            };

            localStorage.setItem(
              ELVY_STUDENT_PROFILE_KEY,
              JSON.stringify(updatedStudent),
            );

            return updatedStudent;
          });
        }
      }

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

      if (!studentModeAllowed && data.ticketBlocked) {
        setShowTicketInfo(true);
        setIsActivated(false);
        setRepliesLeft(0);
        setSecondsRemaining(0);
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
              <p>
                Elvy helps you express messages clearly, politely, and
                meaningfully.
              </p>
              <p>
                Elvy does not replace medical, legal, financial, psychological,
                or emergency services.
              </p>
              <p>
                Do not share passwords, bank details, private documents, or
                sensitive personal information.
              </p>
              <p>
                Please use Elvy respectfully. Harmful, abusive, or unsafe use is
                not allowed.
              </p>
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
                  Your account keeps your username and ticket so you
                  can return to Elvy easily.
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

              {accountMode === "login" && (
                <div className="flex items-center gap-3 rounded-2xl border border-[#d8c5ad] bg-white/95 px-3 py-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04),0_4px_10px_rgba(72,45,25,0.08)]">
                  <span className="text-base text-[#6d5a48]">🎓</span>
                  <input
                    type="text"
                    value={studentLoginCode}
                    onChange={(e) =>
                      setStudentLoginCode(e.target.value.toUpperCase())
                    }
                    placeholder="Student code (only for center students)"
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-[#2b1a12] outline-none placeholder:text-[#8d8074]"
                  />
                </div>
              )}
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
                  {accountMode === "register" ? "Create account" : "Log in"}
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
                setAccountMode(
                  accountMode === "register" ? "login" : "register",
                );
                setAccountMessage("");
                setStudentLoginCode("");
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
              className="shrink-0"
              style={{
                paddingBottom: "10px",
                borderBottom: "1px solid rgba(216, 185, 143, 0.85)",
              }}
            >
              <div
                className="relative flex items-center justify-center"
                style={{ minHeight: "38px", paddingLeft: "82px", paddingRight: "72px" }}
              >
                {account && (
                  <button
                    onClick={logoutAccount}
                    className="absolute left-0 top-0 inline-flex items-center gap-1 rounded-full bg-[#f1e1cf] text-[#4a2d1f] shadow-sm active:scale-[0.98]"
                    style={{ padding: "6px 9px", fontSize: "10px", fontWeight: 800 }}
                  >
                    <span style={{ fontSize: "13px", lineHeight: "13px" }}>↪</span>
                    Logout
                  </button>
                )}

                <h2
                  className="font-extrabold text-[#3b2418]"
                  style={{
                    fontSize: "15px",
                    lineHeight: "22px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                    textAlign: "center",
                  }}
                >
                  {account
                    ? `Talk to Elvy · ${account.displayName}`
                    : "Talk to Elvy"}
                </h2>

                <button
                  onClick={() => setChatOpen(false)}
                  className="absolute right-4 top-0 inline-flex items-center gap-1 rounded-full bg-[#f1e1cf] text-[#4a2d1f] shadow-sm active:scale-[0.98]"
                  style={{ padding: "6px 9px", fontSize: "10px", fontWeight: 800 }}
                >
                  <span style={{ fontSize: "13px", lineHeight: "13px" }}>×</span>
                  Close
                </button>
              </div>

              {studentProfile ? (
                <p
                  className="text-center font-bold text-green-700"
                  style={{
                    fontSize: "11px",
                    lineHeight: "16px",
                    fontWeight: 900,
                    marginTop: "2px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                  }}
                  title={`Student · ${studentProfile.level} · ${studentProfile.sublevel} · Lesson ${studentProfile.lesson} · Time: ${formatCompactTimeLeft(secondsRemaining)}`}
                >
                  Student · {studentProfile.level} · {studentProfile.sublevel}{" "}
                  · Lesson {studentProfile.lesson} · Time: {formatCompactTimeLeft(secondsRemaining)}
                </p>
              ) : (
                isActivated && (
                  <p
                    className="text-center font-bold text-green-700"
                    style={{ fontSize: "11px", lineHeight: "15px" }}
                  >
                    Ticket active · {formatTimeLeft(secondsRemaining)}
                  </p>
                )
              )}
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
                  className={
                    msg.sender === "elvy"
                      ? "mr-auto flex max-w-[96%] items-start gap-2"
                      : "ml-auto max-w-[82%]"
                  }
                >
                  {msg.sender === "elvy" && (
                    <div
                      style={{
                        position: "relative",
                        width: "72px",
                        height: "76px",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                    >
                      {isSpeaking && speakingMessageIndex === index && (
                        <>
                          <span
                            style={{
                              position: "absolute",
                              right: "-8px",
                              top: "18px",
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: "#22c55e",
                              animation: "elvyWave 1s infinite",
                            }}
                          />

                          <span
                            style={{
                              position: "absolute",
                              right: "-18px",
                              top: "14px",
                              width: "18px",
                              height: "18px",
                              borderRadius: "50%",
                              border: "2px solid #22c55e",
                              animation: "elvyWave 1s infinite",
                            }}
                          />

                          <span
                            style={{
                              position: "absolute",
                              right: "-30px",
                              top: "10px",
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              border: "2px solid #22c55e",
                              animation: "elvyWave 1s infinite",
                            }}
                          />
                        </>
                      )}

                      <img
                        src="/elvy-public.png"
                        alt="Elvy"
                        className="shrink-0"
                        style={{
                          width: "56px",
                          height: "76px",
                          objectFit: "contain",
                          background: "transparent",
                          border: "none",
                          boxShadow: "none",
                          filter:
                            isSpeaking && speakingMessageIndex === index
                              ? "drop-shadow(0 0 10px rgba(17,138,59,0.6))"
                              : "drop-shadow(0 3px 5px rgba(72,45,25,0.12))",
                          animation:
                            isSpeaking && speakingMessageIndex === index
                              ? "elvySpeakPulse 1.1s ease-in-out infinite"
                              : "none",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => speakText(msg.text, index)}
                        disabled={isVoiceLoading || isSpeaking}
                        aria-label="Listen to Elvy"
                        title={
                          isVoiceLoading && voiceLoadingMessageIndex === index
                            ? "Loading voice..."
                            : isSpeaking && speakingMessageIndex === index
                              ? "Elvy is speaking..."
                              : "Listen"
                        }
                        className="absolute flex items-center justify-center rounded-full transition-all active:scale-[0.95]"
                        style={{
                          left: "50px",
                          top: "21px",
                          width: "20px",
                          height: "20px",
                          border: "none",
                          background: "transparent",
                          color:
                            isSpeaking && speakingMessageIndex === index
                              ? "#118a3b"
                              : "#2b1a12",
                          fontSize: "17px",
                          lineHeight: "17px",
                          opacity:
                            isVoiceLoading || isSpeaking
                              ? speakingMessageIndex === index || voiceLoadingMessageIndex === index
                                ? 1
                                : 0.35
                              : 0.9,
                          cursor:
                            isVoiceLoading || isSpeaking
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {isVoiceLoading && voiceLoadingMessageIndex === index
                          ? "⏳"
                          : "🔊"}
                      </button>
                    </div>
                  )}

                  <div
                    className={`px-4 py-3 text-sm leading-6 ${
                      msg.sender === "elvy"
                        ? "min-w-0 flex-1 rounded-[22px] bg-white text-[#2b1a12] font-medium shadow-[0_3px_10px_rgba(0,0,0,0.08)]"
                        : "rounded-[22px] border border-[#7fc2ff] bg-[#cfe9ff] text-[16px] font-bold text-[#11314d] shadow-[0_4px_12px_rgba(80,160,255,0.18)]"
                    }`}
                  >
                    <div>{renderMessageText(msg.text, index)}</div>
                  </div>
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
                  {paymentOpen &&
                  ((paypalActive && paypalLink) ||
                    (skrillActive && skrillLink)) ? (
                    <>
                      <p className="mt-1">Ticket price: $4</p>
                      <p className="mt-1">Balance: time-based ticket</p>
                      <p className="mt-1">Validity: until the ticket time is finished</p>
                      <p className="mt-1">
                        Voice access will be available later as a separate
                        ticket.
                      </p>
                      <p className="mt-1">
                        After payment, enter your activation code to unlock
                        Elvy.
                      </p>

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
                      If you need help, you can contact Happy Office using your
                      personal code.
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
                          activationCode.trim().length > 0
                            ? "#16a34a"
                            : "#bfae9d",
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
                disabled={interactionLocked}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                type="text"
                placeholder={
                  ticketRequired
                    ? "Activate an Elvy ticket to continue..."
                    : isSending
                      ? "Elvy is replying..."
                      : isVoiceLoading
                        ? "Loading voice..."
                        : isSpeaking
                          ? "Elvy is speaking..."
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
                disabled={isListening || interactionLocked}
                className="flex shrink-0 items-center justify-center rounded-full text-white shadow-md transition-all active:scale-[0.98]"
                style={{
                  width: "54px",
                  height: "54px",

                  backgroundColor: isListening
                    ? "#dc2626"
                    : interactionLocked
                      ? "#9ca3af"
                      : "#118a3b",

                  border: "1px solid rgba(31,107,43,0.75)",
                  fontSize: "22px",

                  opacity: interactionLocked ? 0.5 : 1,

                  animation: isListening ? "pulse 1.2s infinite" : "none",
                }}
                title="Speak to Elvy"
              >
                {isListening ? "🔴" : "🎤"}
              </button>

              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={interactionLocked}
                className="shrink-0 rounded-full text-white shadow-md transition-all active:scale-[0.98]"
                style={{
                  height: "54px",
                  minWidth: "72px",
                  padding: "0 18px",
                  border: "1px solid #1d7fe2",
                  backgroundColor: interactionLocked ? "#9fc8ef" : "#1d7fe2",
                  fontSize: "15px",
                  fontWeight: 800,
                  opacity: interactionLocked ? 0.7 : 1,
                }}
              >
                {interactionLocked ? "Wait" : "Send"}
              </button>
            </div>
            <div className="pt-1 text-center">
              {!ticketRequired &&
                !isListening &&
                !input.trim() &&
                !isSending && (
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

              {lastSecondsUsed > 0 && (
                <div
                  className="text-center font-bold"
                  style={{
                    color: "#6b5a4c",
                    fontSize: "8px",
                    opacity: 0.65,
                    lineHeight: "11px",
                  }}
                >
                  Last interaction: {lastSecondsUsed}s
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
                aria-label={
                  voiceMode ? "Turn voice mode off" : "Turn voice mode on"
                }
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

      <style jsx>{`
        @keyframes elvySpeakPulse {
          0% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-2px) scale(1.03);
          }
          100% {
            transform: translateY(0) scale(1);
          }
        }

        @keyframes elvyWave {
          0% {
            opacity: 0.35;
            transform: scale(0.9);
          }

          50% {
            opacity: 1;
            transform: scale(1.15);
          }

          100% {
            opacity: 0.35;
            transform: scale(0.9);
          }
        }
      `}</style>
    </main>
  );
}
