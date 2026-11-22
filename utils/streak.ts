import { HistoryItem } from '../types';

export interface StreakInfo {
  streak: number;
  completedToday: boolean;
  lastCompletedDate: string | null;
  dailyStatus: { dateStr: string; label: string; completed: boolean; isToday: boolean }[];
}

export const getLocalDateKey = (date: Date | number): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculateStreak = (history: HistoryItem[], locale?: string): StreakInfo => {
  const completedDateSet = new Set<string>();
  
  if (Array.isArray(history)) {
    history.forEach(item => {
      if (item && item.completed) {
        completedDateSet.add(getLocalDateKey(item.timestamp));
      }
    });
  }

  const now = new Date();
  const todayKey = getLocalDateKey(now);
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterday);

  const completedToday = completedDateSet.has(todayKey);
  const completedYesterday = completedDateSet.has(yesterdayKey);

  let streak = 0;
  let lastCompletedDate: string | null = null;

  if (completedToday) {
    lastCompletedDate = todayKey;
  } else if (completedYesterday) {
    lastCompletedDate = yesterdayKey;
  }

  // If at least one day in {today, yesterday} is completed, compute the consecutive backward chain
  if (completedToday || completedYesterday) {
    let checkDate = new Date(now);
    if (!completedToday) {
      checkDate = yesterday;
    }

    while (true) {
      const key = getLocalDateKey(checkDate);
      if (completedDateSet.has(key)) {
        streak += 1;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Generate 7-day past status for visual tracker
  const dailyStatus = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = getLocalDateKey(d);
    dailyStatus.push({
      dateStr,
      label: d.toLocaleDateString(locale, { weekday: 'narrow' }),
      completed: completedDateSet.has(dateStr),
      isToday: i === 0
    });
  }

  return {
    streak,
    completedToday,
    lastCompletedDate,
    dailyStatus
  };
};
