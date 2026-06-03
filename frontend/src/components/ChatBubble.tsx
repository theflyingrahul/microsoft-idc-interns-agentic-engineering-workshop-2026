import { useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/** Strip markdown formatting characters from assistant replies. */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")       // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1")     // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, "")) // code
    .replace(/^[\s-*•]+(?=\S)/gm, "") // leading bullets/dashes
    .replace(/\n{3,}/g, "\n\n")       // collapse excess blank lines
    .trim();
}

const SUGGESTED_QUESTIONS = [
  "Which tag impacts my mood the most?",
  "Is my mood trending up or down?",
  "What's my best energy combination?",
  "What predicts my energy levels?",
];

async function streamChat(
  messages: Message[],
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      onError(json.detail ?? "Request failed");
    } catch {
      onError(`Request failed (${res.status})`);
    }
    return;
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") {
        onDone();
        return;
      }
      try {
        const json = JSON.parse(payload);
        if (json.error) {
          onError(json.error);
          return;
        }
        if (json.token) {
          onToken(json.token);
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
  onDone();
}

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    // Append placeholder for streaming
    const assistantPlaceholder: Message = { role: "assistant", content: "" };
    setMessages([...nextMessages, assistantPlaceholder]);

    await streamChat(
      nextMessages,
      (token) => {
        // Accumulate raw tokens — do NOT strip during streaming to avoid eating spaces
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: updated[updated.length - 1].content + token,
          };
          return updated;
        });
      },
      () => {
        // Apply cleanup once, after stream is fully done
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: stripMarkdown(updated[updated.length - 1].content),
          };
          return updated;
        });
        setLoading(false);
      },
      (err) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `⚠️ ${err}`,
          };
          return updated;
        });
        setLoading(false);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const showSuggestions = messages.length === 0 && !loading;

  return (
    <>
      {/* Floating bubble button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-5 right-5 z-50 w-13 h-13 rounded-full shadow-lg
                    flex items-center justify-center text-white text-xl
                    transition-all duration-200 cursor-pointer
                    ${open ? "bg-gray-600 scale-95" : "bg-pulse-600 hover:bg-pulse-700 hover:scale-105"}`}
        style={{ width: 52, height: 52 }}
        title="Ask Pulse Assistant"
        aria-label="Open chat"
      >
        {open ? "✕" : "💬"}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-5 z-50 w-[360px] max-h-[520px] flex flex-col
                     bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-pulse-600 px-4 py-3 flex items-center gap-2 flex-shrink-0">
            <span className="text-white text-lg">🤖</span>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">Pulse Assistant</p>
              <p className="text-pulse-200 text-[10px]">Ask me about your insights</p>
            </div>
            <div className="ml-auto">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  className="text-pulse-200 hover:text-white text-xs transition-colors cursor-pointer"
                  title="Clear conversation"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {showSuggestions && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 text-center pt-1">
                  Hi! I know your Pulse data. Ask me anything.
                </p>
                <div className="space-y-1.5">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full text-left text-xs bg-gray-50 hover:bg-pulse-50
                                 hover:border-pulse-200 border border-gray-200 rounded-lg
                                 px-3 py-2 text-gray-600 transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-pulse-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {msg.content || (
                    <span className="flex gap-1 items-center text-gray-400">
                      <span className="animate-bounce" style={{ animationDelay: "0ms" }}>•</span>
                      <span className="animate-bounce" style={{ animationDelay: "150ms" }}>•</span>
                      <span className="animate-bounce" style={{ animationDelay: "300ms" }}>•</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your patterns..."
                rows={1}
                disabled={loading}
                className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2
                           text-xs focus:outline-none focus:ring-2 focus:ring-pulse-400
                           focus:border-pulse-400 disabled:opacity-50 max-h-24 overflow-y-auto"
                style={{ minHeight: 36 }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-pulse-600 text-white
                           flex items-center justify-center text-sm
                           hover:bg-pulse-700 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Send"
              >
                ↑
              </button>
            </div>
            <p className="text-[10px] text-gray-300 mt-1 text-center">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
