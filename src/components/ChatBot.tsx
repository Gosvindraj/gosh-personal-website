import { useState, useEffect, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MAX_SESSION  = 20;
const COOLDOWN_MS  = 2000;
const MAX_CHARS    = 500;
const STORAGE_MSGS = "chatbot_msgs";
const STORAGE_CNT  = "chatbot_count";

const T = {
  bg:          "#0c0c0a",
  surface:     "#141412",
  border:      "rgba(234,231,222,0.11)",
  borderHover: "rgba(155, 109, 206,0.5)",
  text:        "#eae7de",
  muted:       "#8f8c80",
  accent:      "#9b6dce",
  accentDim:   "rgba(155, 109, 206,0.1)",
} as const;

const FONT_SANS = "'Archivo', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

export default function ChatBot() {
  const [open, setOpen]          = useState(false);
  const [messages, setMessages]  = useState<Message[]>([]);
  const [input, setInput]        = useState("");
  const [loading, setLoading]    = useState(false);
  const [error, setError]        = useState("");
  const [sessionCount, setCount] = useState(0);
  const [visible, setVisible]    = useState(false);
  const [isMobile, setIsMobile]  = useState(false);

  const lastSend  = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);
  const fabRef    = useRef<HTMLButtonElement>(null);

  // fade in shortly after mount so it doesn't fight the preloader
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  // mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 520);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ctrl+/ to toggle chatbot
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!visible) return;
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  // restore session from localStorage
  useEffect(() => {
    try {
      const msgs  = localStorage.getItem(STORAGE_MSGS);
      const count = localStorage.getItem(STORAGE_CNT);
      if (msgs)  setMessages(JSON.parse(msgs) as Message[]);
      if (count) setCount(parseInt(count, 10));
    } catch { /* ignore */ }
  }, []);

  // auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // focus input when panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // click/tap outside the panel (and its launcher) closes it
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (fabRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (trimmed.length > MAX_CHARS) {
      setError(`Message too long (max ${MAX_CHARS} characters).`);
      return;
    }
    if (sessionCount >= MAX_SESSION) {
      setError("Session limit reached. Reload the page to start a new chat.");
      return;
    }
    const now = Date.now();
    if (now - lastSend.current < COOLDOWN_MS) {
      setError("Please wait a moment before sending again.");
      return;
    }

    const userMsg: Message = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);
    lastSend.current = now;

    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      const res  = await fetch("https://gosvindraj-github-io.pages.dev/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: trimmed, history: messages.slice(-10) }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };

      if (!res.ok || !data.reply) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        const assistantMsg: Message = { role: "assistant", content: data.reply };
        const final    = [...next, assistantMsg];
        const newCount = sessionCount + 1;
        setMessages(final);
        setCount(newCount);
        localStorage.setItem(STORAGE_MSGS, JSON.stringify(final));
        localStorage.setItem(STORAGE_CNT, String(newCount));
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    setError("");
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 100) + "px";
  }

  const isExhausted = sessionCount >= MAX_SESSION;
  const canSend     = !loading && !isExhausted && input.trim().length > 0;
  const remaining   = MAX_SESSION - sessionCount;

  const panelRight  = isMobile ? "16px" : "24px";
  const panelWidth  = isMobile ? "calc(100vw - 32px)" : "340px";
  const panelHeight = isMobile ? "min(70vh, 520px)" : "480px";
  const fabRight    = isMobile ? "16px" : "24px";
  const fabBottom   = isMobile ? "20px" : "24px";

  return (
    <>
      {/* ── chat panel ─────────────────────────────────────────────────── */}
      <div
        ref={panelRef}
        aria-hidden={!open}
        style={{
          position:       "fixed",
          bottom:         isMobile ? `calc(${fabBottom} + 60px)` : "88px",
          right:          panelRight,
          width:          panelWidth,
          height:         panelHeight,
          background:     T.surface,
          border:         `1px solid ${open ? T.borderHover : T.border}`,
          borderTop:      `1px solid ${T.accent}`,
          display:        "flex",
          flexDirection:  "column",
          zIndex:         9000,
          boxShadow:      "0 16px 48px rgba(0,0,0,0.7)",
          fontFamily:     FONT_SANS,
          overflow:       "hidden",
          opacity:        open && visible ? 1 : 0,
          pointerEvents:  open && visible ? "auto" : "none",
          transform:      open && visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
          transition:     "opacity 0.22s ease, transform 0.22s ease, border-color 0.25s ease",
          transformOrigin:"bottom right",
        }}
      >
        {/* header */}
        <div style={{
          padding:        "13px 16px",
          borderBottom:   `1px solid ${T.border}`,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          flexShrink:     0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width:          "28px",
              height:         "28px",
              background:     T.accentDim,
              border:         "1px solid rgba(155, 109, 206,0.35)",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              flexShrink:     0,
            }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: T.accent }}>G</span>
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: T.text, lineHeight: 1.3, letterSpacing: "-0.01em" }}>
                ask gosh
              </div>
              <div style={{ fontSize: "9px", color: T.muted, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: FONT_MONO }}>
                the automated me
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "10px", color: T.muted, letterSpacing: "0.06em", fontFamily: FONT_MONO }}>
              [ {remaining} / {MAX_SESSION} ]
            </span>
          </div>
        </div>

        {/* messages */}
        <div
          className="chatbot-messages"
          style={{
            flex:          1,
            overflowY:     "auto",
            padding:       "16px",
            display:       "flex",
            flexDirection: "column",
            gap:           "12px",
            scrollbarWidth:"thin",
            scrollbarColor:`rgba(155, 109, 206,0.25) transparent`,
          }}>
          {messages.length === 0 && (
            <div style={{
              margin:     "auto",
              textAlign:  "center",
              color:      T.muted,
              fontSize:   "13px",
              lineHeight: 1.75,
              padding:    "0 12px",
            }}>
              <div style={{
                fontFamily:    FONT_MONO,
                fontSize:      "9px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color:         T.accent,
                marginBottom:  "10px",
              }}>
                [ transcript empty ]
              </div>
              the bot version of gosh. ask about the projects, the human behind them, or where to say hi.
            </div>
          )}

          {/* transcript entries, not chat bubbles: mono speaker label
              over the text, hairline between turns */}
          {messages.map((m, i) => (
            <div key={i} style={{
              display:       "flex",
              flexDirection: "column",
              gap:           "5px",
              paddingBottom: "12px",
              borderBottom:  `1px solid ${T.border}`,
            }}>
              <span style={{
                fontFamily:    FONT_MONO,
                fontSize:      "9px",
                fontWeight:    500,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color:         m.role === "user" ? T.muted : T.accent,
              }}>
                {m.role === "user" ? "you" : "gosh.bot"}
              </span>
              <div style={{
                color:      m.role === "user" ? T.muted : T.text,
                fontSize:   "13px",
                lineHeight: 1.65,
                wordBreak:  "break-word",
                whiteSpace: "pre-wrap",
              }}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              <span style={{
                fontFamily:    FONT_MONO,
                fontSize:      "9px",
                fontWeight:    500,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color:         T.accent,
              }}>
                gosh.bot
              </span>
              <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <span key={i} style={{
                    width:      "5px",
                    height:     "5px",
                    background: T.accent,
                    display:    "inline-block",
                    animation:  `chatbotDot 1.2s ${i * 0.16}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{
              fontSize:   "11px",
              color:      "#e57373",
              textAlign:  "center",
              padding:    "4px 8px",
              lineHeight: 1.5,
              fontFamily: FONT_MONO,
            }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* input area: underline field like the contact form, mono
            text send instead of a messenger icon */}
        <div style={{
          padding:    "12px 16px 14px",
          borderTop:  `1px solid ${T.border}`,
          display:    "flex",
          gap:        "12px",
          alignItems: "flex-end",
          flexShrink: 0,
          background: T.surface,
        }}>
          <textarea
            ref={inputRef}
            className="chatbot-input"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={isExhausted ? "session limit reached. reload to continue." : "ask about gosh..."}
            disabled={isExhausted || loading}
            rows={1}
            maxLength={MAX_CHARS}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            data-lpignore="true"
            data-1p-ignore="true"
            style={{
              flex:           1,
              background:     "transparent",
              border:         "none",
              borderBottom:   `1px solid ${T.border}`,
              color:          T.text,
              fontSize:       "13px",
              padding:        "4px 0 8px",
              resize:         "none",
              fontFamily:     FONT_SANS,
              lineHeight:     1.5,
              outline:        "none",
              opacity:        isExhausted ? 0.45 : 1,
              maxHeight:      "100px",
              overflowY:      "auto",
              scrollbarWidth: "none",
              transition:     "border-color 0.2s ease",
            }}
            onFocus={e => { e.currentTarget.style.borderBottomColor = T.accent; }}
            onBlur={e  => { e.currentTarget.style.borderBottomColor = T.border; }}
          />
          <button
            onClick={send}
            disabled={!canSend}
            aria-label="Send message"
            className="chatbot-send-btn"
            style={{
              background:     "none",
              border:         "none",
              padding:        "0 0 8px",
              fontFamily:     FONT_MONO,
              fontSize:       "10px",
              fontWeight:     600,
              letterSpacing:  "0.14em",
              textTransform:  "uppercase",
              color:          canSend ? T.accent : T.muted,
              opacity:        canSend ? 1 : 0.45,
              flexShrink:     0,
              transition:     "color 0.2s ease, opacity 0.2s ease",
            }}
          >
            send &rarr;
          </button>
        </div>
      </div>

      {/* pulse ring behind FAB, hidden when open */}
      {!open && visible && (
        <span
          aria-hidden
          className="chatbot-pulse-ring"
          style={{
            position:      "fixed",
            bottom:        fabBottom,
            right:         fabRight,
            width:         "52px",
            height:        "52px",
            zIndex:        9000,
            pointerEvents: "none",
          }}
        />
      )}

      {/* ── floating action button ──────────────────────────────────────── */}
      <button
        ref={fabRef}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open chat"}
        className="chatbot-fab"
        style={{
          position:       "fixed",
          bottom:         fabBottom,
          right:          fabRight,
          width:          "52px",
          height:         "52px",
          background:     open ? T.surface : T.accent,
          border:         `1px solid ${open ? T.borderHover : "transparent"}`,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          zIndex:         9001,
          boxShadow:      open
            ? `0 4px 20px rgba(0,0,0,0.5)`
            : "0 4px 20px rgba(155, 109, 206,0.3)",
          transition:     "background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, opacity 1s ease",
          color:          open ? T.accent : "#0c0c0a",
          opacity:        visible ? 1 : 0,
          pointerEvents:  visible ? "auto" : "none",
        }}
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <span style={{
            fontFamily:    FONT_MONO,
            fontSize:      "11px",
            fontWeight:    600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}>ask</span>
        )}
      </button>

      <style>{`
        /* acid text selection inside the chatbot */
        .chatbot-input::selection,
        .chatbot-messages *::selection {
          background: rgba(155, 109, 206, 0.85);
          color: #0c0c0a;
        }

        /* textarea: hide scrollbar (webkit + firefox) */
        .chatbot-input::-webkit-scrollbar { display: none; }

        /* force custom cursor on all chatbot controls */
        .chatbot-messages, .chatbot-input,
        .chatbot-send-btn, .chatbot-fab { cursor: none !important; }

        /* message list: slim styled scrollbar */
        .chatbot-messages::-webkit-scrollbar        { width: 4px; }
        .chatbot-messages::-webkit-scrollbar-track  { background: transparent; }
        .chatbot-messages::-webkit-scrollbar-thumb  {
          background: rgba(155, 109, 206, 0.3);
        }
        .chatbot-messages::-webkit-scrollbar-thumb:hover {
          background: rgba(155, 109, 206, 0.5);
        }

        @keyframes chatbotPulse {
          0%   { box-shadow: 0 0 0 0    rgba(155, 109, 206, 0.4); }
          70%  { box-shadow: 0 0 0 14px rgba(155, 109, 206, 0);   }
          100% { box-shadow: 0 0 0 0    rgba(155, 109, 206, 0);   }
        }
        .chatbot-pulse-ring { animation: chatbotPulse 2.8s ease-out infinite; }

        @keyframes chatbotDot {
          0%, 80%, 100% { transform: scale(0.55); opacity: 0.35; }
          40%           { transform: scale(1);    opacity: 1;    }
        }

        @media (prefers-reduced-motion: reduce) {
          .chatbot-pulse-ring { animation: none; }
        }
      `}</style>
    </>
  );
}
