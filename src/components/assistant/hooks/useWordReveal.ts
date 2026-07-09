"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';

function tokenizeWords(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  const parts = text.split(/(\s+)/);
  for (let i = 0; i < parts.length; i += 2) {
    const word = parts[i];
    const space = parts[i + 1] || '';
    if (word) tokens.push(word + space);
  }
  return tokens;
}

const WORD_REVEAL_DELAY_MS = 22; // ~45 words/sec — fixed rate, independent of message length

export function getWordRevealDelay(_wordCount: number): number {
  return WORD_REVEAL_DELAY_MS;
}

interface UseWordRevealOptions {
  enabled?: boolean;
  initialProgress?: 'zero' | 'complete';
}

interface UseWordRevealResult {
  revealedText: string;
  isRevealing: boolean;
}

export function useWordReveal(
  fullText: string,
  options?: UseWordRevealOptions
): UseWordRevealResult {
  const { enabled = true, initialProgress = 'zero' } = options ?? {};

  const tokens = useMemo(() => tokenizeWords(fullText), [fullText]);

  const [revealIndex, setRevealIndex] = useState(() => {
    return initialProgress === 'complete' ? tokens.length : 0;
  });
  const [isRevealing, setIsRevealing] = useState(false);

  const posRef = useRef(initialProgress === 'complete' ? tokens.length : 0);
  const totalRef = useRef(tokens.length);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevFullTextRef = useRef(fullText);

  totalRef.current = tokens.length;

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const complete = useCallback(() => {
    stop();
    const total = totalRef.current;
    posRef.current = total;
    setRevealIndex(total);
    setIsRevealing(false);
  }, [stop]);

  const start = useCallback(() => {
    stop();

    const total = totalRef.current;
    let pos = posRef.current;

    if (pos >= total) {
      complete();
      return;
    }

    const delay = getWordRevealDelay(total);
    if (delay === 0) {
      posRef.current = total;
      setRevealIndex(total);
      setIsRevealing(false);
      return;
    }

    setIsRevealing(true);

    intervalRef.current = setInterval(() => {
      posRef.current += 1;
      setRevealIndex(posRef.current);

      if (posRef.current >= totalRef.current) {
        complete();
      }
    }, delay);
  }, [stop, complete]);

  useEffect(() => {
    if (!enabled || tokens.length === 0) {
      complete();
      return;
    }

    const prevFullText = prevFullTextRef.current;
    prevFullTextRef.current = fullText;

    if (fullText === prevFullText) return;

    if (initialProgress === 'complete' && prevFullText === '') {
      posRef.current = tokens.length;
      setRevealIndex(tokens.length);
      return;
    }

    const isGrowth = prevFullText !== '' && fullText.startsWith(prevFullText);

    if (!isGrowth && prevFullText !== '') {
      stop();
      posRef.current = 0;
      setRevealIndex(0);
      start();
      return;
    }

    if (!intervalRef.current && posRef.current < tokens.length) {
      start();
    }
  }, [tokens, enabled, fullText, start, stop, complete]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const revealedText = useMemo(
    () => tokens.slice(0, revealIndex).join(''),
    [tokens, revealIndex]
  );

  return { revealedText, isRevealing };
}
