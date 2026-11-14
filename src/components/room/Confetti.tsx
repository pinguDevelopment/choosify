"use client";
import { useState } from "react";

const COLORS = ["#f2b544", "#43c78a", "#ef5d6c", "#8b7cf6", "#f3eee6"];

export function Confetti({ count = 40 }: { count?: number }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.2 + Math.random() * 1.6,
      size: 6 + Math.random() * 6,
      color: COLORS[i % COLORS.length],
    })),
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            background: p.color,
            animation: `confetti ${p.duration}s ${p.delay}s ease-in forwards`,
            transform: "translateY(-10vh)",
          }}
        />
      ))}
    </div>
  );
}
