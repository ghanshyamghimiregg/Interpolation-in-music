'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';

interface KatexBlockProps {
  tex: string;
  block?: boolean;
  className?: string;
}

export default function KatexBlock({ tex, block = true, className = '' }: KatexBlockProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(tex, ref.current, {
        throwOnError: false,
        displayMode: block,
        trust: false,
      });
    } catch {
      ref.current.textContent = tex;
    }
  }, [tex, block]);

  return <span ref={ref} className={className} />;
}
