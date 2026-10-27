import { useState, useEffect } from 'react';

export function useLiveClock() {
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const mins = String(now.getUTCMinutes()).padStart(2, '0');
      const secs = String(now.getUTCSeconds()).padStart(2, '0');
      setTimeStr(`${hours}:${mins}:${secs} UTC`);

      const day = String(now.getUTCDate()).padStart(2, '0');
      const month = String(now.getUTCMonth() + 1).padStart(2, '0');
      const year = now.getUTCFullYear();
      setDateStr(`${day}/${month}/${year}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return { timeStr, dateStr };
}
