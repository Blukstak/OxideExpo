'use client';

import { useState, useEffect, useCallback } from 'react';

interface CountdownProps {
  targetDate: Date;
  onComplete: () => void;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function Countdown({ targetDate, onComplete }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const calculateTimeLeft = useCallback((): TimeLeft | null => {
    const difference = targetDate.getTime() - new Date().getTime();

    if (difference <= 0) {
      return null;
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }, [targetDate]);

  useEffect(() => {
    // Initial calculation
    const initial = calculateTimeLeft();
    if (!initial) {
      setIsComplete(true);
      onComplete();
      return;
    }
    setTimeLeft(initial);

    // Update every second
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      if (!remaining) {
        setIsComplete(true);
        onComplete();
        clearInterval(timer);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft, onComplete]);

  if (isComplete || !timeLeft) return null;

  return (
    <div className="min-h-screen bg-brand flex flex-col items-center justify-center text-white">
      <h1 className="text-4xl md:text-5xl font-bold mb-8">Próximamente</h1>
      <div className="flex gap-3 md:gap-4 text-center">
        {timeLeft.days > 0 && (
          <TimeUnit value={timeLeft.days} label="Días" />
        )}
        <TimeUnit value={timeLeft.hours} label="Horas" />
        <TimeUnit value={timeLeft.minutes} label="Minutos" />
        <TimeUnit value={timeLeft.seconds} label="Segundos" />
      </div>
      <p className="mt-8 text-lg md:text-xl opacity-90 text-center px-4">
        La feria de empleo está por comenzar
      </p>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 md:p-4 min-w-[70px] md:min-w-[90px]">
      <div className="text-3xl md:text-4xl font-bold tabular-nums">
        {String(value).padStart(2, '0')}
      </div>
      <div className="text-xs md:text-sm opacity-75 mt-1">{label}</div>
    </div>
  );
}
