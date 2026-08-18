"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, RotateCcw, MessageSquarePlus } from "lucide-react";
import { useAskSivlo } from "./useAskSivlo";
import { useMeetings } from "@/features/meetings";
import { useConfig } from "@/contexts/ConfigContext";
import { parseCitationMarkers, resolveCitation } from "./citations";
import { CitationPopover } from "./CitationPopover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { AskSivloMessage } from "./types";
import { shouldSubmitAskSivloKey } from "./composer";
import {
  ASK_SIVLO_EMPTY_STATE_COPY,
  ASK_SIVLO_CONFIGURE_AI_PATH,
} from "./uiConstants";

function isConfigError(error: string | null): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes("no ai model configured") ||
    lower.includes("not configured") ||
    lower.includes("missing model")
  );
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ProviderDisclosure({ provider }: { provider: string }) {
  let label: string;
  switch (provider) {
    case "builtin-ai":
      label = "Local AI";
      break;
    case "ollama":
      label = "Configured Ollama endpoint";
      break;
    default:
      label = "Configured provider";
      break;
  }
  return (
    <p className="text-[9px] font-semibold text-muted-foreground">
      Responses use your {label}.
    </p>
  );
}

function AssistantMessage({
  message,
}: {
  message: AskSivloMessage;
}) {
  const segments = parseCitationMarkers(message.content);
  const citations = message.citations ?? [];

  return (
    <div className="space-y-0.5 text-sm text-foreground leading-relaxed">
      {segments.map((segment, i) => {
        if (segment.type === "text") {
          return <span key={i}>{segment.text}</span>;
        }
        const resolved = resolveCitation(segment.citationId, citations);
        if (resolved) {
          return <CitationPopover key={i} citation={resolved} />;
        }
        return <span key={i}>[{segment.citationId}]</span>;
      })}
    </div>
  );
}

function UserMessage({ message }: { message: AskSivloMessage }) {
  return (
    <div className="text-sm text-foreground leading-relaxed">
      {message.content}
    </div>
  );
}

export function AskSivlo() {
  const {
    messages,
    isLoading,
    error,
    scope,
    retryRequest,
    sendMessage,
    retry,
    clearChat,
    setScope,
  } = useAskSivlo();

  const { meetings } = useMeetings();
  const { modelConfig } = useConfig();
  const router = useRouter();

  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    void sendMessage(trimmed);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (shouldSubmitAskSivloKey(e.key, e.shiftKey, e.nativeEvent.isComposing)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleScopeChange = useCallback(
    (value: string) => {
      if (value === "all") {
        setScope({ kind: "all" });
      } else {
        setScope({ kind: "meeting", meetingId: value });
      }
    },
    [setScope],
  );

  const handleClearChat = useCallback(() => {
    clearChat();
    setInput("");
  }, [clearChat]);

  const handleConfigureAI = useCallback(() => {
    router.push(ASK_SIVLO_CONFIGURE_AI_PATH);
  }, [router]);

  const scopeValue = scope.kind === "all" ? "all" : scope.meetingId ?? "all";
  const hasContent = messages.length > 0;
  const showConfigureAI = isConfigError(error);

  return (
    <div className="rounded-xl border border-border bg-surface-raised">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Ask Sivlo</span>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <button
              type="button"
              onClick={handleClearChat}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="New chat"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              New chat
            </button>
          )}
        </div>
      </div>

      {/* Scope selector */}
      <div className="border-b border-border px-4 py-2">
        <Select value={scopeValue} onValueChange={handleScopeChange}>
          <SelectTrigger className="h-8 w-full max-w-[240px] text-xs" aria-label="Select scope">
            <SelectValue placeholder="All meetings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All meetings</SelectItem>
            {meetings.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages area */}
      <div className="px-4 pt-3">
        {!hasContent ? (
          <div className="pb-4 text-center">
            <p className="text-sm text-muted-foreground">
              {ASK_SIVLO_EMPTY_STATE_COPY}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {[
                "What decisions did we make?",
                "What are my action items?",
                "How do I import audio?",
              ].map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setInput(example)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[320px]">
            <div ref={scrollRef} className="space-y-3 pb-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={
                    msg.role === "user"
                      ? "rounded-lg bg-surface-subtle px-3 py-2"
                      : "px-3 py-2"
                  }
                >
                  {msg.role === "user" ? (
                    <UserMessage message={msg} />
                  ) : (
                    <AssistantMessage message={msg} />
                  )}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
              ))}
              {isLoading && (
                <div className="px-3 py-2 text-sm text-muted-foreground italic">
                  Thinking…
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Error / retry */}
      {(error || retryRequest) && (
        <div className="border-t border-border px-4 py-2">
          {error && (
            <div className="flex items-start gap-2">
              <p className="flex-1 text-xs text-destructive">{error}</p>
              {showConfigureAI && (
                <button
                  type="button"
                  onClick={handleConfigureAI}
                  className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Configure AI
                </button>
              )}
            </div>
          )}
          {retryRequest && !isLoading && (
            <button
              type="button"
              onClick={() => void retry()}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            rows={1}
            disabled={isLoading}
            aria-label="Ask Sivlo question"
            className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            aria-label="Send"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <ProviderDisclosure provider={modelConfig.provider} />
      </div>
    </div>
  );
}
