"use client";

import { useState, useEffect } from "react";
import { parseISO, differenceInSeconds } from "date-fns";

interface CountdownTimerProps {
  datetime: string;
}

export default function CountdownTimer({ datetime }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = differenceInSeconds(parseISO(datetime), new Date());

      if (diff <= 0) {
        setTimeLeft("Şimdi");
        return;
      }

      const days = Math.floor(diff / 86400);
      const hours = Math.floor((diff % 86400) / 3600);
      const minutes = Math.floor((diff % 3600) / 60);

      if (days > 0) {
        setTimeLeft(`${days}g ${hours}s`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}s ${minutes}d`);
      } else {
        setTimeLeft(`${minutes}d`);
      }
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [datetime]);

  return (
    <span className="text-xs font-medium text-[#166534] bg-[#F0FDF4] px-1.5 py-0.5 rounded">
      {timeLeft}
    </span>
  );
}
