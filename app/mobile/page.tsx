"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ElvyAvatar from "@/components/elvy/ElvyAvatar";
import Whiteboard, {
  type WhiteboardContentType,
} from "@/components/whiteboard/Whiteboard";
import { resolveElvyState } from "@/components/elvy/elvy-state";
import type { MouthState } from "@/components/elvy/studio/ElvyTorso";

type Message = {
  sender: "elvy" | "user";
  text: string;
};

type LessonDirectorState = Record<string, unknown>;

function mouthForSpokenCharacter(character: string): MouthState {
  const sound = character.toLowerCase();

  if (/[mbp]/.test(sound)) return "m-b-p";
  if (/[aeiy]/.test(sound)) return "a-e";
  if (sound === "o") return "o";
  if (/[uw]/.test(sound)) return "u";
  if (/\s|[.,!?;:'"-]/.test(sound)) return "closed-smile";

  return "open";
}

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
  nativeLanguage?: string;
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
const ELVY_LESSON_DIRECTOR_STATE_KEY = "elvy_lesson_director_state";
const FREE_REPLIES_LIMIT = 3;
const WHITEBOARD_SPEECH_INDEX = -1;

type MobileWhiteboardContent = {
  title?: string;
  type: WhiteboardContentType;
  text: string;
};

const EMPTY_WHITEBOARD_CONTENT: MobileWhiteboardContent = {
  title: "",
  type: "paragraph",
  text: "",
};

function createWelcomeWhiteboardContent(
  studentName: string,
): MobileWhiteboardContent {
  const cleanName = String(studentName || "Student").trim() || "Student";

  return {
    title: `Welcome, ${cleanName}!`,
    type: "paragraph",
    text: "Welcome to your class.",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textFromWhiteboardBlock(block: unknown): string {
  if (!isRecord(block)) return "";

  const lines: string[] = [];
  const title = typeof block.title === "string" ? block.title.trim() : "";
  const text = typeof block.text === "string" ? block.text.trim() : "";

  if (title) lines.push(title);
  if (text && text !== title) lines.push(text);

  if (Array.isArray(block.segments)) {
    const segmentText = block.segments
      .map((segment) =>
        isRecord(segment) && typeof segment.text === "string"
          ? segment.text.trim()
          : "",
      )
      .filter(Boolean)
      .join(" ");

    if (segmentText) lines.push(segmentText);
  }

  if (Array.isArray(block.items)) {
    const itemText = block.items
      .map((item) => {
        if (!isRecord(item)) return "";

        const primary =
          typeof item.text === "string" ? item.text.trim() : "";
        const secondary =
          typeof item.secondaryText === "string"
            ? item.secondaryText.trim()
            : "";
        const example =
          typeof item.example === "string" ? item.example.trim() : "";

        return [primary, secondary, example].filter(Boolean).join(" — ");
      })
      .filter(Boolean)
      .map((item) => `• ${item}`)
      .join("\n");

    if (itemText) lines.push(itemText);
  }

  if (Array.isArray(block.dialogue)) {
    const dialogueText = block.dialogue
      .map((line) => {
        if (!isRecord(line)) return "";

        const speaker =
          typeof line.speaker === "string" ? line.speaker.trim() : "";
        const spokenText =
          typeof line.text === "string" ? line.text.trim() : "";

        if (!spokenText) return "";
        return speaker ? `${speaker}: ${spokenText}` : spokenText;
      })
      .filter(Boolean)
      .join("\n");

    if (dialogueText) lines.push(dialogueText);
  }

  return lines.filter(Boolean).join("\n");
}

function inferWhiteboardContentType(
  mode: unknown,
  blocks: readonly unknown[],
): WhiteboardContentType {
  if (blocks.some((block) => isRecord(block) && Array.isArray(block.dialogue))) {
    return "dialogue";
  }

  if (
    mode === "question" ||
    blocks.some(
      (block) => isRecord(block) && String(block.kind || "") === "exercise",
    )
  ) {
    return "exercise";
  }

  if (
    blocks.some((block) => {
      if (!isRecord(block)) return false;
      const kind = String(block.kind || "");
      return kind === "vocabulary" || kind === "word-list";
    })
  ) {
    return "vocabulary";
  }

  return "paragraph";
}

function mapWhiteboardEngineOutput(
  value: unknown,
): MobileWhiteboardContent | null {
  if (!isRecord(value)) return null;

  const presentation = isRecord(value.presentation)
    ? value.presentation
    : value;

  const allBlocks = Array.isArray(presentation.blocks)
    ? presentation.blocks
    : [];

  const pages = Array.isArray(presentation.pages) ? presentation.pages : [];
  const activePageIndex =
    typeof presentation.activePageIndex === "number"
      ? presentation.activePageIndex
      : 0;
  const activePage = isRecord(pages[activePageIndex])
    ? pages[activePageIndex]
    : null;
  const activeBlockIds =
    activePage && Array.isArray(activePage.blockIds)
      ? new Set(activePage.blockIds.filter((id): id is string => typeof id === "string"))
      : null;

  const visibleBlocks = activeBlockIds
    ? allBlocks.filter(
        (block) =>
          isRecord(block) &&
          typeof block.id === "string" &&
          activeBlockIds.has(block.id),
      )
    : allBlocks;

  const text = visibleBlocks
    .map(textFromWhiteboardBlock)
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const clearBeforeDisplay = presentation.clearBeforeDisplay === true;
  const mode = presentation.mode;

  const title =
    typeof presentation.title === "string"
      ? presentation.title.trim()
      : "";

  if (!text && (clearBeforeDisplay || mode === "clear")) {
    return {
      title,
      text: "",
      type: "paragraph",
    };
  }

  if (!text && !title) return null;

  return {
    title,
    text,
    type: inferWhiteboardContentType(mode, visibleBlocks),
  };
}
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

function formatLiveCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function MobileElvyPage() {
  const router = useRouter();

  const AI_CONNECTED = true;

  const [showWelcome, setShowWelcome] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const celebrationTimerRef = useRef<number | null>(null);

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
  const [lessonDirectorState, setLessonDirectorState] =
    useState<LessonDirectorState | null>(null);
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
  const [speechMouth, setSpeechMouth] = useState<MouthState>("closed-smile");
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

  const [whiteboardContent, setWhiteboardContent] =
    useState<MobileWhiteboardContent>(EMPTY_WHITEBOARD_CONTENT);

  const isStudentMode = Boolean(studentProfile?.code?.startsWith("STUDENT-"));

  const ticketRequired =
    !isStudentMode &&
    (showTicketInfo || (!isActivated && freeRepliesUsed >= FREE_REPLIES_LIMIT));

  const interactionLocked =
    isSending || isVoiceLoading || isSpeaking || ticketRequired;

  const elvyAnimationState = resolveElvyState({
    isSpeaking,
    isListening,
    isThinking: isSending || isVoiceLoading,
    isCelebrating,
  });

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
          setWhiteboardContent(
            createWelcomeWhiteboardContent(
              parsedStudent.name || parsedStudent.username,
            ),
          );

          const savedDirectorState = localStorage.getItem(
            ELVY_LESSON_DIRECTOR_STATE_KEY,
          );

          if (savedDirectorState) {
            try {
              const parsedDirectorState = JSON.parse(savedDirectorState);

              if (
                parsedDirectorState?.studentCode === parsedStudent.code &&
                parsedDirectorState?.state &&
                typeof parsedDirectorState.state === "object"
              ) {
                setLessonDirectorState(parsedDirectorState.state);
              }
            } catch {
              localStorage.removeItem(ELVY_LESSON_DIRECTOR_STATE_KEY);
            }
          }

          setMessages([
            {
              sender: "elvy",
              text: `Welcome back, ${parsedStudent.name || parsedStudent.username}. Your lesson is ${parsedStudent.level} / ${parsedStudent.sublevel} / ${parsedStudent.unit} / Lesson ${parsedStudent.lesson}${parsedStudent.lessonTitle ? `: ${parsedStudent.lessonTitle}` : ""}.`,
            },
          ]);
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
      }
    } catch {
      localStorage.removeItem(ELVY_ACCOUNT_KEY);
      localStorage.removeItem(ELVY_STUDENT_PROFILE_KEY);
      localStorage.removeItem(ELVY_LESSON_DIRECTOR_STATE_KEY);
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
    if (typeof window === "undefined") return;

    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateKeyboardState = () => {
      const keyboardHeight = Math.max(0, window.innerHeight - viewport.height);
      setKeyboardOpen(keyboardHeight > 140);
    };

    updateKeyboardState();
    viewport.addEventListener("resize", updateKeyboardState);
    viewport.addEventListener("scroll", updateKeyboardState);

    return () => {
      viewport.removeEventListener("resize", updateKeyboardState);
      viewport.removeEventListener("scroll", updateKeyboardState);
    };
  }, []);

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

        if (celebrationTimerRef.current !== null) {
          window.clearTimeout(celebrationTimerRef.current);
          celebrationTimerRef.current = null;
        }
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, []);

  function openTalkToElvy() {
    // Preserve the original welcome-page flow:
    // Talk to Elvy -> Terms -> Login/Register -> New classroom.
    setAccountMode("login");
    setAccountMessage("");
    setStudentLoginCode("");
    setAcceptedTerms(false);
    setChatOpen(false);
    setShowAccountForm(false);
    setShowTerms(true);
  }

  function continueToChat() {
    if (!acceptedTerms) return;
    setShowTerms(false);

    if (account) {
      setShowWelcome(false);
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
    localStorage.removeItem(ELVY_LESSON_DIRECTOR_STATE_KEY);
    localStorage.setItem(ELVY_STUDENT_PROFILE_KEY, JSON.stringify(student));
    setLessonDirectorState(null);

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
    setWhiteboardContent(
      createWelcomeWhiteboardContent(student.name || student.username),
    );
    setShowTicketInfo(false);
    setShowAccountForm(false);
    setShowWelcome(false);
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
      localStorage.removeItem(ELVY_LESSON_DIRECTOR_STATE_KEY);
      setStudentProfile(null);
      setLessonDirectorState(null);
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
      setShowWelcome(false);
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
    localStorage.removeItem(ELVY_LESSON_DIRECTOR_STATE_KEY);
    setStudentProfile(null);
    setLessonDirectorState(null);
    setAccount(null);
    setIsActivated(false);
    setActiveUserCode("");
    setRepliesLeft(0);
    setSecondsRemaining(0);
    setWhiteboardContent(EMPTY_WHITEBOARD_CONTENT);
    setChatOpen(false);
    setShowAccountForm(false);
    setShowWelcome(true);
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
        Number(
          data.user?.secondsRemaining || data.user?.seconds_remaining || 0,
        ),
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
      setSpeechMouth("closed-smile");
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

        const wordPosition = progress * wordMatches.length;
        const wordIndex = Math.min(
          wordMatches.length - 1,
          Math.floor(wordPosition),
        );

        const currentWord = wordMatches[wordIndex];
        const wordProgress = Math.min(0.999, wordPosition - wordIndex);

        if (currentWord) {
          const spokenWord = currentWord[0];
          const characterIndex = Math.min(
            spokenWord.length - 1,
            Math.floor(wordProgress * spokenWord.length),
          );
          setSpeechMouth(
            mouthForSpokenCharacter(spokenWord[characterIndex] || " "),
          );
        }

        if (wordIndex !== lastWordIndex) {
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
        setSpeechMouth("closed-smile");

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
        setSpeechMouth("closed-smile");
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
        setSpeechMouth("closed-smile");

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
    const studentModeAllowed =
      Boolean(studentProfile?.status === "Active") && studentTicketActive;
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
          lessonDirectorState:
            studentModeAllowed ? lessonDirectorState : null,
          classroom:
            studentModeAllowed
              ? {
                  whiteboard: {
                    viewport: {
                      width: 264,
                      height: 271,
                    },
                    activePageIndex: 0,
                  },
                }
              : null,
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

      const nextWhiteboardContent = mapWhiteboardEngineOutput(
        data?.whiteboard ?? data?.teachingResult?.whiteboard,
      );

      if (studentModeAllowed && nextWhiteboardContent) {
        setWhiteboardContent(nextWhiteboardContent);
      }

      if (
        studentModeAllowed &&
        data?.lessonDirectorState &&
        typeof data.lessonDirectorState === "object"
      ) {
        const nextLessonDirectorState =
          data.lessonDirectorState as LessonDirectorState;

        setLessonDirectorState(nextLessonDirectorState);

        if (studentProfile?.code) {
          localStorage.setItem(
            ELVY_LESSON_DIRECTOR_STATE_KEY,
            JSON.stringify({
              studentCode: studentProfile.code,
              state: nextLessonDirectorState,
            }),
          );
        }
      }

      const aiReply = data.reply || "I am sorry. I cannot reply right now.";

      if (/\b(excellent|great|well done|correct|perfect|bravo|good job)\b/i.test(aiReply)) {
        setIsCelebrating(true);

        if (celebrationTimerRef.current !== null) {
          window.clearTimeout(celebrationTimerRef.current);
        }

        celebrationTimerRef.current = window.setTimeout(() => {
          setIsCelebrating(false);
          celebrationTimerRef.current = null;
        }, 1500);
      }

      if (typeof data.secondsUsed === "number") {
        setLastSecondsUsed(data.secondsUsed);
        console.log("Elvy interaction seconds used:", data.secondsUsed);
      }

      if (typeof data.secondsRemaining === "number") {
        const nextSecondsRemaining = Math.max(
          Number(data.secondsRemaining || 0),
          0,
        );
        setSecondsRemaining(nextSecondsRemaining);

        if (studentProfile?.code?.startsWith("STUDENT-")) {
          setStudentProfile((prev) => {
            if (!prev) return prev;

            const updatedStudent = {
              ...prev,
              secondsRemaining: nextSecondsRemaining,
              secondsUsed:
                typeof data.secondsUsed === "number"
                  ? Number(prev.secondsUsed || 0) +
                    Number(data.secondsUsed || 0)
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
    <main
      className="min-h-screen sm:flex sm:items-center sm:justify-center sm:p-4"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, #fffaf0 0%, #f8edd7 48%, #ead8ba 100%)",
      }}
    >
      <div
        className={`relative mx-auto overflow-hidden ${
          showWelcome ? "bg-[#f6e5ca]" : "bg-[#f7f2ec] shadow-2xl"
        }`}
        style={{
          width: showWelcome
            ? "min(100vw, calc(100dvh * 864 / 1856), 430px)"
            : "min(100vw, 430px)",
          aspectRatio: showWelcome ? "864 / 1856" : undefined,
          height: showWelcome
            ? "auto"
            : keyboardOpen
              ? "100dvh"
              : "min(100dvh, calc(110vw + 190px), 665px)",
          maxHeight: showWelcome
            ? "100dvh"
            : keyboardOpen
              ? "932px"
              : "665px",
          minHeight: showWelcome ? "0" : keyboardOpen ? "0" : "590px",
        }}
      >
        {showWelcome && (
          <section className="absolute inset-0 z-30 overflow-hidden bg-[#f6e5ca]">
            <img
              src="/elvy-mobile-welcome.png"
              alt="Elvy welcome screen"
              className="absolute inset-0 h-full w-full object-contain"
              draggable={false}
            />

            <button
              type="button"
              onClick={openTalkToElvy}
              className="absolute left-[3%] top-[62.8%] h-[10.1%] w-[94%] rounded-[26px] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
              aria-label="Talk to Elvy"
            />

            <button
              type="button"
              onClick={() => router.push("/mobile/meet")}
              className="absolute left-[3%] top-[74.0%] h-[9.7%] w-[94%] rounded-[26px] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
              aria-label="Meet Elvy"
            />

            <button
              type="button"
              onClick={() => router.push("/happy-office")}
              className="absolute left-[3%] top-[84.5%] h-[9.4%] w-[94%] rounded-[26px] focus:outline-none focus-visible:ring-4 focus-visible:ring-white/80"
              aria-label="Open Happy Office website"
            />
          </section>
        )}

        {!showWelcome && (
          <>
        {/* Compact lesson header: two lines normally, one line with keyboard open */}
        <header
          className="absolute left-3 right-3 z-40 rounded-[20px] bg-white/95 shadow-[0_8px_24px_rgba(66,43,24,0.18)] backdrop-blur"
          style={{
            top: "0px",
            padding: keyboardOpen ? "8px 12px" : "10px 14px",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap leading-none">
                <h1 className="truncate text-[17px] font-black text-[#191919]">
                  Spotlight 1
                </h1>
                <span className="text-[#f27c0a]">•</span>
                <span className="shrink-0 text-[11px] font-bold text-[#555]">
                  {studentProfile
                    ? `${studentProfile.sublevel || studentProfile.level} · ${studentProfile.unit} · L${studentProfile.lesson}`
                    : "A1 · Unit 1 · Lesson 2"}
                </span>
              </div>

              {!keyboardOpen && (
                <div className="mt-[2px] flex min-w-0 items-center gap-1.5 leading-tight">
                  <span className="shrink-0 text-[11px] font-extrabold text-[#f27c0a]">
                    {studentProfile?.lessonTitle || "Meeting New People"}
                  </span>
                  <span className="text-[#f27c0a]">•</span>
                  <span className="truncate text-[10px] font-medium text-[#222]">
                    🎯 Introduce yourself and ask someone&apos;s name.
                  </span>
                </div>
              )}
            </div>

            {(studentProfile?.status === "Active" || isActivated) &&
              secondsRemaining > 0 && (
                <div className="shrink-0 rounded-full bg-[#fff3df] px-2.5 py-1 text-[11px] font-black tabular-nums text-[#9a4d00] shadow-inner">
                  ⏱ {formatTimeLeft(secondsRemaining)}
                </div>
              )}

            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
              style={{
                background:
                  "conic-gradient(#f27c0a 0deg 216deg, #ddd 216deg 360deg)",
              }}
            >
              <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-[12px] font-black text-[#111]">
                60%
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMainMenu((prev) => !prev)}
              className="grid h-8 w-7 shrink-0 place-items-center rounded-full text-lg font-black text-[#222] transition hover:bg-black/5 active:scale-95"
              aria-label="Open navigation menu"
              aria-expanded={showMainMenu}
            >
              ⋮
            </button>
          </div>
        </header>

        {showMainMenu && (
          <>
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setShowMainMenu(false)}
              className="absolute inset-0 z-40 bg-transparent"
            />

            <div
              className="absolute right-4 z-[70] w-48 overflow-hidden rounded-2xl border border-black/10 bg-white/98 p-2 shadow-[0_14px_36px_rgba(30,20,10,0.28)] backdrop-blur"
              style={{
                top: keyboardOpen ? "58px" : "66px",
              }}
            >
              {[
                ["⌂", "Home", "/mobile"],
                ["▤", "Lessons", "/mobile/lessons"],
                ["A", "Vocabulary", "/mobile/vocabulary"],
                ["▥", "Progress", "/mobile/progress"],
                ["☰", "More", "/mobile/more"],
              ].map(([icon, label, path]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setShowMainMenu(false);
                    router.push(path);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-[#2d2925] transition hover:bg-[#f5eee6] active:scale-[0.99]"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f4ede5] text-[17px]">
                    {icon}
                  </span>
                  <span>{label}</span>
                </button>
              ))}

              {account && (
                <>
                  <div className="my-2 h-px bg-black/10" />
                  <button
                    type="button"
                    onClick={() => {
                      const confirmed = window.confirm(
                        "Log out? You will return to the login screen.",
                      );

                      if (!confirmed) return;

                      setShowMainMenu(false);
                      logoutAccount();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-extrabold text-red-600 transition hover:bg-red-50 active:scale-[0.99]"
                  >
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-red-50 text-[17px]">
                      ↪
                    </span>
                    <span>Log out</span>
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* Classroom layer */}
        <section
          className="absolute inset-x-0 overflow-hidden"
          style={{
            top: keyboardOpen
              ? "clamp(-78px, calc(52px - 30.3vw), -45px)"
              : "clamp(-70px, calc(60px - 30.3vw), -36px)",
            bottom: keyboardOpen ? "66px" : "86px",
          }}
        >
          <img
            src="/classroom.png"
            alt="Elvy classroom"
            className="absolute inset-x-0 top-0 h-auto w-full object-contain"
            style={{ objectPosition: "center top" }}
          />

          {/* Dynamic lesson whiteboard: uses the full writable board area. */}
          <div
            className="absolute z-10 overflow-hidden"
            style={{
              left: "4.2%",
              top: "min(34vw, 146px)",
              width: "61.5%",
              height: "min(63vw, 271px)",
            }}
          >
            <Whiteboard
              title={whiteboardContent.title}
              text={whiteboardContent.text}
              type={whiteboardContent.type}
              activeCharIndex={
                isSpeaking && speakingMessageIndex === WHITEBOARD_SPEECH_INDEX
                  ? speakingCharIndex
                  : null
              }
              activeWordLength={
                isSpeaking && speakingMessageIndex === WHITEBOARD_SPEECH_INDEX
                  ? speakingWordLength
                  : 0
              }
              footer={null}
            />
          </div>

          {/* Independent avatar animation layer. */}
          <ElvyAvatar
            state={elvyAnimationState}
            keyboardOpen={keyboardOpen}
            speechMouth={speechMouth}
          />

          {/* Small whiteboard speaker below Elvy, outside the board.
              It appears only after the Teaching Brain sends board content. */}
          {whiteboardContent.text.trim() && (
            <button
              type="button"
              onClick={() =>
                speakText(
                  whiteboardContent.text,
                  WHITEBOARD_SPEECH_INDEX,
                )
              }
              disabled={isVoiceLoading || isSpeaking}
              className="absolute z-30 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[15px] shadow-md transition active:scale-95 disabled:opacity-40"
              style={{
                right: "93%",
                top: "min(89vw, 390px)",
              }}
              aria-label="Listen to the whiteboard lesson"
              title="Listen to the whiteboard lesson"
            >
              {isVoiceLoading &&
              voiceLoadingMessageIndex === WHITEBOARD_SPEECH_INDEX
                ? "⏳"
                : "🔊"}
            </button>
          )}

          {/* Start state */}
          {!chatOpen && !showTerms && !showAccountForm && (
            <button
              type="button"
              onClick={openTalkToElvy}
              className="absolute bottom-[92px] left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#0878df] px-8 py-3 text-[15px] font-extrabold text-white shadow-[0_8px_20px_rgba(0,96,190,0.35)] active:scale-[0.98]"
            >
              Start learning with Elvy
            </button>
          )}

          {/* Compact conversation layer */}
          {chatOpen && (
            <div
              className="absolute left-4 right-4 z-30"
              style={{
                top: "min(97.2vw, 418px)",
                bottom: "8px",
              }}
            >
              <div className="h-full overflow-y-auto pr-1 [scrollbar-width:none]">
                <div className="flex min-h-full flex-col justify-end gap-2 pb-1">
                  {messages
                    .map((msg, index) => ({ msg, index }))
                    .filter(({ msg, index }) => {
                      if (index !== 0) return true;
                      return !/^Welcome( back)?[, ]/i.test(msg.text);
                    })
                    .map(({ msg, index }) => (
                      <div
                        key={`${msg.sender}-${index}`}
                        className={
                          msg.sender === "elvy"
                            ? "flex max-w-[82%] items-end gap-2 self-start"
                            : "max-w-[72%] self-end"
                        }
                      >
                        {msg.sender === "elvy" && (
                          <img
                            src="/elvy-alone.png"
                            alt="Elvy"
                            className="h-9 w-9 shrink-0 rounded-full bg-white/90 object-contain p-0.5 shadow"
                          />
                        )}

                        <div
                          className={
                            msg.sender === "elvy"
                              ? "rounded-[18px] rounded-bl-[5px] bg-white/95 px-3 py-2 text-[12px] font-medium leading-[17px] text-[#171717] shadow-md"
                              : "rounded-[18px] rounded-br-[5px] bg-[#d8f6c8]/95 px-3 py-2 text-[12px] font-medium leading-[17px] text-[#171717] shadow-md"
                          }
                        >
                          {renderMessageText(msg.text, index)}
                          {msg.sender === "elvy" && (
                            <button
                              type="button"
                              onClick={() => speakText(msg.text, index)}
                              disabled={isVoiceLoading || isSpeaking}
                              className="ml-2 inline-flex align-middle text-[13px] disabled:opacity-40"
                              aria-label="Listen to Elvy"
                            >
                              {isVoiceLoading &&
                              voiceLoadingMessageIndex === index
                                ? "⏳"
                                : "🔊"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                  {isSending && (
                    <div className="self-start rounded-[18px] bg-white/95 px-3 py-2 text-[12px] font-semibold text-[#444] shadow-md">
                      Elvy is replying...
                    </div>
                  )}

                  {isListening && (
                    <div className="self-center rounded-full bg-white/95 px-4 py-1.5 text-[11px] font-extrabold text-green-700 shadow">
                      Listening... speak now
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Input and voice controls */}
        {chatOpen && (
          <div
            className="absolute left-3 right-3 z-50"
            style={{ bottom: "8px" }}
          >
            <div className="flex items-center gap-2 rounded-full bg-white/95 p-2 shadow-[0_8px_22px_rgba(45,28,12,0.25)]">
              <button
                type="button"
                onClick={startVoiceInput}
                disabled={isListening || interactionLocked}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0878df] text-[20px] text-white disabled:bg-[#9ebfe0]"
                aria-label="Speak to Elvy"
              >
                {isListening ? "●" : "🎤"}
              </button>

              <input
                ref={inputRef}
                value={input}
                disabled={interactionLocked}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder={
                  ticketRequired
                    ? "Activate an Elvy ticket to continue..."
                    : isSpeaking
                      ? "Elvy is speaking..."
                      : isListening
                        ? "Elvy is listening..."
                        : "Tap the mic or write your answer..."
                }
                className="min-w-0 flex-1 bg-transparent px-1 text-[13px] font-medium text-[#222] outline-none placeholder:text-[#888]"
              />

              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={interactionLocked || !input.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0878df] text-[20px] text-white disabled:bg-[#a8c7e4]"
                aria-label="Send message"
              >
                ➤
              </button>
            </div>

            {!keyboardOpen && (
              <div className="mt-2 flex h-9 items-center justify-between rounded-full bg-[#241c13]/95 px-4 text-[10px] text-white shadow-lg">
                <button
                  type="button"
                  onClick={() => setVoiceMode((prev) => !prev)}
                  className={
                    voiceMode
                      ? "font-bold text-green-400"
                      : "font-bold text-red-300"
                  }
                >
                  ◖ Voice mode {voiceMode ? "ON" : "OFF"}
                </button>

                <span className="truncate px-2 text-center text-white/90">
                  {isSpeaking
                    ? "Elvy is speaking..."
                    : isVoiceLoading
                      ? "Preparing Elvy's voice..."
                      : isListening
                        ? "Elvy is listening..."
                        : "Ready"}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    const lastIndex = [...messages]
                      .map((message, index) => ({ message, index }))
                      .reverse()
                      .find(({ message }) => message.sender === "elvy");
                    if (lastIndex)
                      speakText(lastIndex.message.text, lastIndex.index);
                  }}
                  disabled={isSpeaking || isVoiceLoading}
                  className="shrink-0 font-semibold disabled:opacity-40"
                >
                  🔊 Replay
                </button>
              </div>
            )}
          </div>
        )}

          </>
        )}

        {/* Terms overlay */}
        {showTerms && (
          <div className="absolute inset-0 z-[80] grid place-items-center bg-black/35 p-5 backdrop-blur-sm">
            <div className="max-h-[78%] w-full overflow-y-auto rounded-[28px] bg-white p-5 shadow-2xl">
              <h2 className="text-xl font-black text-[#2e2118]">
                Terms of Use
              </h2>
              <div className="mt-3 space-y-2 text-[13px] leading-5 text-[#5f5147]">
                <p>Elvy helps you learn and communicate more clearly.</p>
                <p>
                  Do not share passwords, bank details, or sensitive private
                  information.
                </p>
                <p>Please use Elvy respectfully and safely.</p>
              </div>
              <label className="mt-4 flex gap-3 rounded-2xl bg-[#f5eadc] p-3 text-[12px] font-semibold text-[#3b2a1f]">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5"
                />
                <span>I have read and agree to continue using Elvy.</span>
              </label>
              <button
                type="button"
                onClick={continueToChat}
                disabled={!acceptedTerms}
                className="mt-4 w-full rounded-2xl bg-[#0878df] py-3 font-extrabold text-white disabled:bg-[#aeb8c1]"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="mt-2 w-full rounded-2xl bg-[#eee5db] py-3 font-bold text-[#4a382b]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Account overlay */}
        {showAccountForm && (
          <div className="absolute inset-0 z-[80] grid place-items-center bg-black/35 p-5 backdrop-blur-sm">
            <div className="w-full rounded-[28px] bg-white p-5 shadow-2xl">
              <h2 className="text-xl font-black text-[#1f4f2b]">
                {accountMode === "register" ? "Create account" : "Log in"}
              </h2>
              <div className="mt-4 space-y-3">
                <input
                  value={accountUsername}
                  onChange={(e) => setAccountUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full rounded-2xl border border-[#ddd0c1] px-4 py-3 text-sm outline-none"
                />
                <input
                  type="password"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-2xl border border-[#ddd0c1] px-4 py-3 text-sm outline-none"
                />
                {accountMode === "login" && (
                  <input
                    value={studentLoginCode}
                    onChange={(e) =>
                      setStudentLoginCode(e.target.value.toUpperCase())
                    }
                    placeholder="Student code (optional)"
                    className="w-full rounded-2xl border border-[#ddd0c1] px-4 py-3 text-sm outline-none"
                  />
                )}
              </div>
              {accountMessage && (
                <p className="mt-3 rounded-xl bg-red-50 p-2 text-[12px] font-bold text-red-700">
                  {accountMessage}
                </p>
              )}
              <button
                type="button"
                onClick={submitAccount}
                className="mt-4 w-full rounded-2xl bg-[#16843a] py-3 font-extrabold text-white"
              >
                {accountMode === "register" ? "Create account" : "Log in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountMode(
                    accountMode === "register" ? "login" : "register",
                  );
                  setAccountMessage("");
                  setStudentLoginCode("");
                }}
                className="mt-2 w-full rounded-2xl border border-[#4a382b] py-2 text-[13px] font-bold text-[#4a382b]"
              >
                {accountMode === "register"
                  ? "I already have an account"
                  : "Create a new account"}
              </button>
              {showWelcome && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountForm(false);
                    setAccountMessage("");
                    setAccountPassword("");
                    setStudentLoginCode("");
                  }}
                  className="mt-2 w-full rounded-2xl bg-[#eee5db] py-2 text-[13px] font-bold text-[#4a382b]"
                >
                  Back
                </button>
              )}
            </div>
          </div>
        )}

        {/* Ticket overlay */}
        {chatOpen && showTicketInfo && (
          <div className="absolute inset-0 z-[90] grid place-items-center bg-black/35 p-5 backdrop-blur-sm">
            <div className="w-full rounded-[28px] bg-white p-5 shadow-2xl">
              <h2 className="text-lg font-black text-[#3b2418]">
                Activate Elvy Ticket
              </h2>
              <p className="mt-2 text-[13px] leading-5 text-[#5b4332]">
                To continue learning, enter your activation code.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value)}
                  placeholder="Activation code"
                  className="min-w-0 flex-1 rounded-2xl border border-[#ddd0c1] px-4 py-3 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={activateCode}
                  className="rounded-2xl bg-[#16843a] px-4 text-sm font-extrabold text-white"
                >
                  Activate
                </button>
              </div>
              {activationMessage && (
                <p
                  className={`mt-3 text-[12px] font-bold ${isActivated ? "text-green-700" : "text-red-700"}`}
                >
                  {activationMessage}
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowTicketInfo(false)}
                className="mt-3 w-full rounded-2xl bg-[#eee5db] py-2 font-bold text-[#4a382b]"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

    </main>
  );
}
