import React, { useMemo, useState } from 'react';
import { HistoryItem } from '../types';
import { CalendarCheck, Flame, Sparkles, CheckCircle2, Info } from 'lucide-react';
import { getLocalDateKey } from '../utils/streak';

interface ActivityCalendarProps {
  history: HistoryItem[];
  t: any;
  dailyGoal?: number;
}

interface DayActivity {
  date: Date;
  dateKey: string;
  dayLabel: string;
  formattedDate: string;
  weekdayLabel: string;
  lessonCount: number;
  wordCount: number;
  isToday: boolean;
  intensity: 0 | 1 | 2 | 3; // 0 = 0, 1 = 1, 2 = 2, 3 = 3+
}

export const ActivityCalendar: React.FC<ActivityCalendarProps> = ({
  history,
  t,
  dailyGoal = 2
}) => {
  const [hoveredDay, setHoveredDay] = useState<DayActivity | null>(null);

  // Compute 30-day activity data
  const { days, totalLessons, activeDaysCount, maxLessonsInDay } = useMemo(() => {
    const dayCount = 30;
    const now = new Date();
    const todayKey = getLocalDateKey(now);

    // Group lessons and words by local date string
    const lessonsByDate: Record<string, { count: number; words: number }> = {};
    if (Array.isArray(history)) {
      history.forEach(item => {
        if (item && item.completed && item.timestamp) {
          const d = new Date(item.timestamp);
          const key = getLocalDateKey(d);
          if (!lessonsByDate[key]) {
            lessonsByDate[key] = { count: 0, words: 0 };
          }
          lessonsByDate[key].count += 1;
          const words = Array.isArray(item.new_words_to_add) ? item.new_words_to_add.length : 0;
          lessonsByDate[key].words += words;
        }
      });
    }

    const points: DayActivity[] = [];
    let total = 0;
    let active = 0;
    let maxLessons = 0;

    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateKey = getLocalDateKey(d);
      const lessonCount = lessonsByDate[dateKey]?.count || 0;
      const wordCount = lessonsByDate[dateKey]?.words || 0;

      if (lessonCount > 0) {
        total += lessonCount;
        active += 1;
        if (lessonCount > maxLessons) maxLessons = lessonCount;
      }

      let intensity: 0 | 1 | 2 | 3 = 0;
      if (lessonCount === 1) intensity = 1;
      else if (lessonCount === 2) intensity = 2;
      else if (lessonCount >= 3) intensity = 3;

      points.push({
        date: d,
        dateKey,
        dayLabel: String(d.getDate()),
        formattedDate: d.toLocaleDateString(t?.intlLocale || undefined, {
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        }),
        weekdayLabel: d.toLocaleDateString(t?.intlLocale || undefined, { weekday: 'narrow' }),
        lessonCount,
        wordCount,
        isToday: dateKey === todayKey,
        intensity
      });
    }

    return {
      days: points,
      totalLessons: total,
      activeDaysCount: active,
      maxLessonsInDay: maxLessons
    };
  }, [history, t?.intlLocale]);

  // Color mapping based on green intensity
  const getIntensityClasses = (intensity: number, isToday: boolean) => {
    switch (intensity) {
      case 3: // 3+ lessons (deep vibrant emerald)
        return 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs font-bold border-emerald-700 dark:border-emerald-400';
      case 2: // 2 lessons (medium vibrant green)
        return 'bg-emerald-400 dark:bg-emerald-600 text-white font-bold border-emerald-500 dark:border-emerald-600';
      case 1: // 1 lesson (light soft green)
        return 'bg-emerald-200 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/80';
      case 0:
      default:
        return 'bg-slate-100 dark:bg-slate-800/70 border-slate-200/60 dark:border-slate-700/60 text-slate-400';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CalendarCheck size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {t.activityCalendar || "Study Activity Calendar"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.activityCalendarDesc || "Daily study frequency over the last 30 days"}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Badges */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.thirtyDayLessons || "30d Lessons"}</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {totalLessons} <span className="text-xs font-normal text-slate-500">{totalLessons === 1 ? (t.lesson || 'lesson') : (t.lessons || 'lessons')}</span>
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.activeDays || "Active Days"}</span>
            <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              {activeDaysCount} <span className="text-xs font-normal text-slate-500">/ 30</span>
            </span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid (30 Days) */}
      <div className="space-y-3">
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2 sm:gap-2.5 pt-1">
          {days.map((day, idx) => {
            const intensityClass = getIntensityClasses(day.intensity, day.isToday);
            return (
              <div
                key={day.dateKey}
                onMouseEnter={() => setHoveredDay(day)}
                onMouseLeave={() => setHoveredDay(null)}
                className={`relative group h-14 rounded-2xl border transition-all duration-200 flex flex-col items-center justify-between p-1.5 cursor-pointer select-none ${intensityClass} ${
                  day.isToday ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900' : ''
                } hover:scale-105 hover:shadow-md hover:z-10`}
              >
                <div className="flex items-center justify-between w-full px-1">
                  <span className="text-[9px] font-medium opacity-80">{day.weekdayLabel}</span>
                  {day.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" title={t.today || "Today"} />
                  )}
                </div>

                <div className="flex flex-col items-center justify-center my-auto">
                  <span className="text-xs font-bold leading-none">{day.dayLabel}</span>
                </div>

                <div className="text-[9px] font-medium opacity-90 leading-none">
                  {day.lessonCount > 0 ? (
                    <span className="flex items-center gap-0.5">
                      {day.lessonCount} <span className="text-[7px]">★</span>
                    </span>
                  ) : (
                    <span className="opacity-40">-</span>
                  )}
                </div>

                {/* Floating Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white text-xs px-3 py-2 rounded-xl pointer-events-none whitespace-nowrap z-30 shadow-xl border border-slate-700/80 transition-all duration-150">
                  <div className="font-bold border-b border-slate-700/80 pb-1 mb-1 text-slate-200 flex items-center justify-between gap-3">
                    <span>{day.formattedDate}</span>
                    {day.isToday && <span className="text-[10px] text-indigo-400 font-semibold">({t.today || "Today"})</span>}
                  </div>
                  <div className="flex items-center justify-between gap-4 text-emerald-400 font-semibold">
                    <span>{t.lessons || "Lessons"}:</span>
                    <span className="font-mono">{day.lessonCount} {day.lessonCount === 1 ? (t.lesson || 'lesson') : (t.lessons || 'lessons')}</span>
                  </div>
                  {day.wordCount > 0 && (
                    <div className="flex items-center justify-between gap-4 text-indigo-300 text-[11px]">
                      <span>{t.wordsLearned || "Words learned"}:</span>
                      <span className="font-mono">+{day.wordCount}</span>
                    </div>
                  )}
                  {day.lessonCount === 0 && (
                    <div className="text-[10px] text-slate-400 italic">{t.noLessonsOnDay || "No study recorded"}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend and Helper Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info size={13} className="shrink-0" />
            <span>{t.calendarHint || "Click or hover on any day to inspect completed lessons."}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">{t.less || "Less"}</span>
            <div className="flex items-center gap-1">
              <span 
                className="w-4 h-4 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60" 
                title={`0 ${t.lessons || "lessons"}`}
              />
              <span 
                className="w-4 h-4 rounded-md bg-emerald-200 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800/80" 
                title={`1 ${t.lesson || "lesson"}`}
              />
              <span 
                className="w-4 h-4 rounded-md bg-emerald-400 dark:bg-emerald-600 border border-emerald-500 dark:border-emerald-600" 
                title={`2 ${t.lessons || "lessons"}`}
              />
              <span 
                className="w-4 h-4 rounded-md bg-emerald-600 dark:bg-emerald-500 border border-emerald-700 dark:border-emerald-400 shadow-2xs" 
                title={`3+ ${t.lessons || "lessons"}`}
              />
            </div>
            <span className="text-slate-400">{t.more || "More"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
