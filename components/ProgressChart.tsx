import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart
} from 'recharts';
import { HistoryItem } from '../types';
import { TrendingUp, Sparkles, Calendar, BookOpen } from 'lucide-react';

interface ProgressChartProps {
  history: HistoryItem[];
  currentTotal: number;
  t: any;
  darkMode?: boolean;
}

interface ProgressDataPoint {
  date: string;
  fullDate: string;
  words: number;
  newWords: number;
  isToday: boolean;
}

const getLocalDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const ProgressChart: React.FC<ProgressChartProps> = ({
  history,
  currentTotal,
  t,
  darkMode
}) => {
  const chartData = useMemo(() => {
    const dayCount = 30;
    const today = new Date();
    
    // Group history gains by local date string
    const gainsByDate: Record<string, number> = {};
    if (Array.isArray(history)) {
      history.forEach(item => {
        if (item && item.completed && item.timestamp) {
          const d = new Date(item.timestamp);
          const key = getLocalDateKey(d);
          const count = Array.isArray(item.new_words_to_add) ? item.new_words_to_add.length : 0;
          gainsByDate[key] = (gainsByDate[key] || 0) + count;
        }
      });
    }

    let runningTotal = currentTotal;
    const points: ProgressDataPoint[] = [];

    for (let i = 0; i < dayCount; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      const dateStr = getLocalDateKey(targetDate);
      const dailyGain = gainsByDate[dateStr] || 0;

      points.push({
        date: targetDate.toLocaleDateString(t?.intlLocale || undefined, { month: 'short', day: 'numeric' }),
        fullDate: dateStr,
        words: Math.max(0, runningTotal),
        newWords: dailyGain,
        isToday: i === 0,
      });

      runningTotal -= dailyGain;
    }

    return points.reverse();
  }, [history, currentTotal, t?.intlLocale]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return { growth: 0, activeDays: 0, min: 0, max: currentTotal };
    const initial = chartData[0].words;
    const current = chartData[chartData.length - 1].words;
    const growth = Math.max(0, current - initial);
    const activeDays = chartData.filter(d => d.newWords > 0).length;
    const wordCounts = chartData.map(d => d.words);
    const min = Math.max(0, Math.min(...wordCounts) - 5);
    const max = Math.max(...wordCounts) + 5;
    return { growth, activeDays, min, max };
  }, [chartData, currentTotal]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as ProgressDataPoint;
      return (
        <div className="bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700/80 text-xs space-y-1.5 min-w-[170px] z-50">
          <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5">
            <span className="font-bold text-slate-200">{item.fullDate}</span>
            {item.isToday && (
              <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded-full font-semibold">
                {t.today || "Today"}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-400">{t.vocab || "Vocabulary"}:</span>
            <span className="font-bold font-mono text-indigo-400 text-sm">{item.words}</span>
          </div>
          {item.newWords > 0 ? (
            <div className="flex items-center justify-between text-emerald-400 font-semibold">
              <span>{t.learned || "Learned:"}</span>
              <span className="font-mono">+{item.newWords} {t.words || "words"}</span>
            </div>
          ) : (
            <div className="text-[10px] text-slate-500 italic">{t.noNewWords || "No new words"}</div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <TrendingUp size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {t.progressChart || "Progress Chart"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.progressChartDesc || "Vocabulary growth (known words) over the last 30 days"}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.thirtyDayGrowth || "30d Growth"}</span>
            <span className="text-base font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              +{stats.growth} <span className="text-xs font-normal text-slate-500">{t.words || "words"}</span>
            </span>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2 rounded-2xl border border-slate-100 dark:border-slate-800 text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.activeDays || "Active Days"}</span>
            <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.activeDays} <span className="text-xs font-normal text-slate-500">/ 30</span>
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Line Graph Container */}
      <div className="w-full h-72 sm:h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="vocabGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke={darkMode ? '#334155' : '#f1f5f9'} 
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: darkMode ? '#334155' : '#e2e8f0' }}
              tick={{ fill: darkMode ? '#94a3b8' : '#64748b', fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              domain={[stats.min, stats.max]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: darkMode ? '#94a3b8' : '#64748b', fontSize: 11 }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="words"
              stroke="#6366f1"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#vocabGrowthGradient)"
              activeDot={{
                r: 6,
                fill: '#6366f1',
                stroke: '#ffffff',
                strokeWidth: 2,
                className: 'drop-shadow-md'
              }}
            />
            <Line
              type="monotone"
              dataKey="words"
              stroke="#6366f1"
              strokeWidth={3}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
          {t.cumulativeVocab || "Cumulative Known Vocabulary"}
        </span>
        <span>
          {t.current || "Current:"} <strong className="text-slate-700 dark:text-slate-300 font-bold">{currentTotal} {t.words || "words"}</strong>
        </span>
      </div>
    </div>
  );
};
