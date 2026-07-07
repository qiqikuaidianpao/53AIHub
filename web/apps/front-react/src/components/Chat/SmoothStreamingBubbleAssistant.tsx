import { useCallback, useEffect, useRef, useState } from "react";
import { BubbleAssistant } from "@km/hub-ui-x-react";

const STREAM_DISPLAY_INTERVAL_MS = 24;

interface SmoothStreamingBubbleAssistantProps {
  messageId: string | number;
  content?: string;
  streaming?: boolean;
  smooth?: boolean;
  [key: string]: any;
}

function takeLeadingChars(value: string, count: number): [string, string] {
  const chars = Array.from(value);
  return [chars.slice(0, count).join(""), chars.slice(count).join("")];
}

function getDisplayBatchSize(queueLength: number): number {
  if (queueLength > 300) return 8;
  if (queueLength > 120) return 5;
  return 3;
}

function useSmoothStreamingContent(
  messageId: string,
  content: string,
  smooth: boolean,
) {
  const [displayContent, setDisplayContent] = useState(content);
  const [isTyping, setIsTyping] = useState(false);
  const displayRef = useRef(content);
  const queueRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageIdRef = useRef(messageId);

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const tick = useCallback(() => {
    timerRef.current = null;

    if (!queueRef.current) {
      setIsTyping(false);
      return;
    }

    const [visible, rest] = takeLeadingChars(
      queueRef.current,
      getDisplayBatchSize(queueRef.current.length),
    );
    queueRef.current = rest;

    setDisplayContent(prev => {
      const next = prev + visible;
      displayRef.current = next;
      return next;
    });

    if (rest) {
      timerRef.current = setTimeout(tick, STREAM_DISPLAY_INTERVAL_MS);
    } else {
      setIsTyping(false);
    }
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current || !queueRef.current) return;
    setIsTyping(true);
    timerRef.current = setTimeout(tick, STREAM_DISPLAY_INTERVAL_MS);
  }, [tick]);

  useEffect(() => {
    if (!smooth) {
      clearTimer();
      queueRef.current = "";
      displayRef.current = content;
      setDisplayContent(content);
      setIsTyping(false);
      messageIdRef.current = messageId;
      return;
    }

    if (messageIdRef.current !== messageId) {
      messageIdRef.current = messageId;
      if (!content.startsWith(displayRef.current)) {
        clearTimer();
        queueRef.current = "";
        displayRef.current = content;
        setDisplayContent(content);
        setIsTyping(false);
        return;
      }
    }

    const visibleAndQueued = displayRef.current + queueRef.current;
    if (content === visibleAndQueued) {
      schedule();
      return;
    }

    if (content.startsWith(visibleAndQueued)) {
      queueRef.current += content.slice(visibleAndQueued.length);
      schedule();
      return;
    }

    if (content.startsWith(displayRef.current)) {
      queueRef.current = content.slice(displayRef.current.length);
      schedule();
      return;
    }

    clearTimer();
    queueRef.current = "";
    displayRef.current = content;
    setDisplayContent(content);
    setIsTyping(false);
  }, [messageId, content, smooth, clearTimer, schedule]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    displayContent,
    isTyping,
  };
}

export function SmoothStreamingBubbleAssistant({
  messageId,
  content = "",
  streaming = false,
  smooth = false,
  ...props
}: SmoothStreamingBubbleAssistantProps) {
  const normalizedContent = String(content || "");
  const shouldSmooth = smooth && typeof content === "string";
  const { displayContent, isTyping } = useSmoothStreamingContent(
    String(messageId),
    normalizedContent,
    shouldSmooth,
  );

  return (
    <BubbleAssistant
      {...props}
      content={shouldSmooth ? displayContent : normalizedContent}
      streaming={streaming || isTyping}
    />
  );
}
