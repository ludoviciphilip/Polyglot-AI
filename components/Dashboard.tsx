
import React, { useMemo } from 'react';
import { UserProfile, HistoryItem } from '../types';
import { Award, Zap, BookOpen, ChevronRight, Loader2, Info, TrendingUp, Activity, Calendar, RefreshCw, Flame, Search, CheckCircle2, Target, Sparkles, Check, Layers } from 'lucide-react';
import { calculateStreak, getLocalDateKey } from '../utils/streak';
import { ProgressChart } from './ProgressChart';
import { ActivityCalendar } from './ActivityCalendar';

interface DashboardProps {
  profile: UserProfile;
  onGenerate: () => void;
  onReview: () => void;
  loading: boolean;
  historyCount: number;
  t: any;
  history: HistoryItem[];
  onOpenVocabModal?: () => void;
  srsDueCount?: number;
  onNavigateToSRS?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ profile, onGenerate, onReview, loading, historyCount, t, history, onOpenVocabModal, srsDueCount = 0, onNavigateToSRS }) => {
  const thresholds = [
    { level: 'Pre-A1', min: 0, max: 600 },
    { level: 'A1', min: 600, max: 1500 },
    { level: 'A2', min: 1500, max: 3000 },
    { level: 'B1', min: 3000, max: 6000 },
    { level: 'B2', min: 6000, max: 12000 },
    { level: 'C1', min: 12000, max: 20000 },
    { level: 'C2', min: 20000, max: 30000 },
  ];

  const calculateLevelProgress = (wordCount: number) => {
    const currentRange = thresholds.find(range => range.level === profile.level) || thresholds[0];
    const wordsInCurrentLevel = wordCount - currentRange.min;
    const levelSize = currentRange.max - currentRange.min;
    const levelPercentage = Math.min(Math.max((wordsInCurrentLevel / levelSize) * 100, 0), 100);
    
    return {
      percentage: levelPercentage,
      nextLevelWords: currentRange.max - wordCount,
      isMax: profile.level === 'C2' && wordCount >= currentRange.max,
      nextLevel: thresholds[thresholds.indexOf(currentRange) + 1]?.level || t.mastery || 'Mastery'
    };
  };

  const progress = calculateLevelProgress(profile.knownWords.length);

  // Today's Daily Goal Progress
  const todayKey = getLocalDateKey(new Date());
  const completedTodayCount = useMemo(() => {
    if (!Array.isArray(history)) return 0;
    return history.filter(item => item && item.completed && getLocalDateKey(item.timestamp) === todayKey).length;
  }, [history, todayKey]);

  const targetGoal = profile.dailyGoal || 1;
  const goalPercent = Math.min(100, Math.round((completedTodayCount / targetGoal) * 100));
  const isGoalAchieved = completedTodayCount >= targetGoal;

  // Generate growth chart data organized by days (Last 10 Days)
  const growthData = useMemo(() => {
    const dayCount = 10;
    const points = [];
    const today = new Date();
    
    // Group history by local date string
    const gainsByDate: Record<string, number> = {};
    history.forEach(item => {
      const d = new Date(item.timestamp);
      const dateStr = getLocalDateKey(d);
      gainsByDate[dateStr] = (gainsByDate[dateStr] || 0) + (item.new_words_to_add?.length || 0);
    });

    let cumulativeTotal = profile.knownWords.length;
    
    // Build timeline backward from today
    for (let i = 0; i < dayCount; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() - i);
      const dateStr = getLocalDateKey(targetDate);
      
      const dailyDelta = gainsByDate[dateStr] || 0;
      
      points.push({
        total: Math.max(0, cumulativeTotal),
        delta: dailyDelta,
        label: targetDate.toLocaleDateString(t?.intlLocale || undefined, { weekday: 'short', day: 'numeric' }),
        isToday: i === 0,
        fullDate: dateStr
      });
      
      // For the day before, subtract the current day's delta from the total
      cumulativeTotal -= dailyDelta;
    }
    
    return points.reverse();
  }, [history, profile.knownWords.length, t?.intlLocale]);

  // Calculate learning velocity (avg words per day over the last 7 active days)
  const velocity = useMemo(() => {
    if (history.length === 0) return 0;
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentGains = history
      .filter(item => item.timestamp >= sevenDaysAgo)
      .reduce((acc, curr) => acc + (curr.new_words_to_add?.length || 0), 0);
    
    return Math.round((recentGains / 7) * 10) / 10;
  }, [history]);

  // Calculate streak info from history
  const streakInfo = useMemo(() => calculateStreak(history, t?.intlLocale || undefined), [history, t?.intlLocale]);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{t.welcome}, {profile.name}!</h2>
            <div 
              className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-sm font-extrabold shadow-sm transition-all border ${
                streakInfo.streak > 0
                  ? streakInfo.completedToday
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-orange-400 shadow-orange-500/25 ring-2 ring-orange-400/20'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
              title={streakInfo.completedToday ? (t.streakActive || 'Streak Active Today!') : (streakInfo.streak > 0 ? (t.keepStreak || 'Complete a lesson today to maintain your streak!') : (t.streakBroken || 'Complete a lesson today to start a new streak!'))}
            >
              <Flame 
                size={18} 
                className={`${
                  streakInfo.streak > 0 
                    ? streakInfo.completedToday 
                      ? 'text-yellow-200 fill-amber-200 animate-pulse' 
                      : 'text-amber-600 dark:text-amber-400 fill-amber-500/50' 
                    : 'text-slate-400'
                }`} 
              />
              <span>
                {streakInfo.streak} {streakInfo.streak === 1 ? (t.day || 'day') : (t.days || 'days')} {t.streak ? t.streak.toLowerCase() : 'streak'}
              </span>
              {streakInfo.completedToday && (
                <span className="flex h-2 w-2 relative" title={t.completedTodayTitle || "Completed today"}>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
              )}
            </div>
          </div>
          <p className="text-slate-500 dark:text-slate-400">{t.ready}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {onNavigateToSRS && (
            <button
              type="button"
              onClick={onNavigateToSRS}
              className="bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold py-3 px-5 rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              title={t.srsTitle || "Revisão Espaçada (Anki)"}
            >
              <Layers size={18} className="text-indigo-600 dark:text-indigo-400" />
              <span>{t.srsReview || "Revisão Anki"}</span>
              {srsDueCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">
                  {srsDueCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={onReview}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            {t.review}
          </button>
          <button
            onClick={onGenerate}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
            {t.generate}
          </button>
        </div>
      </header>

      {/* 2-Column Grid for CEFR Level, Daily Goal, Progress Timeline, and Daily Streak */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CEFR Level Progress */}
        <div className="bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between gap-4 h-full">
          <div className="flex justify-between items-start">
            <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 p-2.5 rounded-xl w-fit">
              <Award size={24} />
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                {t.cefr || "CEFR Level"}
              </span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                {profile.level === 'C2' ? (t.mastery || 'Mastery') : `${Math.round(progress.percentage)}% ${t.of || 'to'} ${progress.nextLevel}`}
              </span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.cefr}</p>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5">{profile.level}</p>
          </div>

          <div className="space-y-2 mt-auto pt-2">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full transition-all duration-1000 ease-out rounded-full" style={{ width: `${progress.percentage}%` }} />
            </div>
            {profile.level !== 'C2' ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Info size={12} className="shrink-0 text-slate-400" />
                <span><strong>{progress.nextLevelWords}</strong> {t.wordsRemainingFor || 'words remaining for'} {progress.nextLevel}</span>
              </p>
            ) : (
              <p className="text-xs text-emerald-500 font-bold flex items-center gap-1.5"><Zap size={12} /> {t.maxLevelReached || 'Maximum level reached!'}</p>
            )}
          </div>
        </div>

        {/* Daily Study Goal with Progress Ring */}
        <div className="bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between gap-4 h-full">
          <div className="flex justify-between items-start">
            <div className={`p-2.5 rounded-xl w-fit ${
              isGoalAchieved 
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
            }`}>
              <Target size={24} />
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                {t.goalProgress || "Daily Goal"}
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                {targetGoal} {targetGoal === 1 ? (t.lesson || "lesson") : (t.lessons || "lessons")}
              </span>
            </div>
          </div>

          {/* Circular SVG Progress Ring */}
          <div className="flex items-center justify-between gap-4 py-1">
            <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className="stroke-slate-100 dark:stroke-slate-800"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Dynamic Progress Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  className={`transition-all duration-1000 ease-out ${
                    isGoalAchieved 
                      ? 'stroke-emerald-500' 
                      : 'stroke-indigo-600'
                  }`}
                  strokeWidth="8"
                  strokeDasharray="238.76"
                  strokeDashoffset={238.76 - (goalPercent / 100) * 238.76}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              {/* Center Ring Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                {isGoalAchieved ? (
                  <Check size={22} className="text-emerald-500 stroke-[3]" />
                ) : (
                  <>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white leading-none font-mono">
                      {completedTodayCount}
                    </span>
                    <span className="text-[9px] text-slate-400 leading-none mt-0.5">
                      {t.of || "of"} {targetGoal}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center text-right space-y-0.5">
              <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                {goalPercent}%
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {completedTodayCount} / {targetGoal} {completedTodayCount === 1 ? (t.lesson || "lesson") : (t.lessons || "lessons")}
              </p>
            </div>
          </div>

          <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
            {isGoalAchieved ? (
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles size={14} className="shrink-0" /> {t.goalAchieved || "Goal Achieved! 🎉"}
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                <span>
                  <strong>{Math.max(0, targetGoal - completedTodayCount)}</strong> {t.goalLeft || "left today"}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Vocabulary Growth Card - DAILY TIMELINE */}
        <div className="bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between gap-4 h-full">
          <div className="flex justify-between items-start">
            <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 p-2.5 rounded-xl w-fit">
              <Calendar size={24} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase flex items-center gap-1 justify-end">
                <Activity size={10} /> {t.dailyVelocity || "Daily Velocity"}
              </p>
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300">+{velocity} <span className="text-[10px] font-normal text-slate-400">{t.wordsPerDay || "w/d"}</span></p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.progressTimeline || "Progress Timeline"}</p>
              {onOpenVocabModal && (
                <button
                  type="button"
                  onClick={onOpenVocabModal}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/50 transition-all flex items-center gap-1 cursor-pointer"
                  title={t.searchVocab || "Search and filter learned words"}
                >
                  <Search size={12} /> {t.browseVocab || "Search"}
                </button>
              )}
            </div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5">{profile.knownWords.length} <span className="text-base font-normal text-slate-500">{t.words || "words"}</span></p>
          </div>
          
          {/* DAILY SVG Growth Chart */}
          <div className="h-16 w-full mt-auto flex items-end gap-1 px-1 pt-1">
            {growthData.map((p, i) => {
              const maxTotal = Math.max(...growthData.map(d => d.total));
              const totalHeight = maxTotal > 0 ? (p.total / maxTotal) * 100 : 0;
              const deltaRatio = p.total > 0 ? (p.delta / p.total) : 0;
              
              return (
                <div key={i} className="flex-grow flex flex-col justify-end group relative cursor-pointer" style={{ height: `100%` }}>
                  {/* The Bar */}
                  <div className={`w-full ${p.isToday ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-blue-100 dark:bg-blue-900/20'} rounded-t-sm overflow-hidden flex flex-col justify-end`} style={{ height: `${totalHeight}%` }}>
                    {/* Daily Gain highlight */}
                    <div 
                      className={`${p.isToday ? 'bg-indigo-600' : 'bg-blue-500 dark:bg-blue-600'} transition-all duration-500`} 
                      style={{ height: `${deltaRatio * 100}%` }} 
                    />
                  </div>
                  
                  {/* Tooltip */}
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-2 rounded-lg pointer-events-none whitespace-nowrap z-20 shadow-xl transition-opacity">
                    <div className="font-bold border-b border-slate-600 mb-1 pb-0.5">{p.label} {p.isToday && `(${t.today || 'Today'})`}</div>
                    <div className="flex justify-between gap-4"><span>{t.vocab || "Vocabulary"}:</span> <span className="font-mono">{p.total}</span></div>
                    <div className="flex justify-between gap-4 text-blue-300"><span>{t.dailyGain || "Daily Gain"}:</span> <span className="font-mono">+{p.delta}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Streak Tracker & Lessons Completed */}
        <div className="bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between gap-4 h-full">
          <div className="flex justify-between items-start">
            <div className={`${streakInfo.streak > 0 ? 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'} p-2.5 rounded-xl w-fit`}>
              <Flame size={24} className={streakInfo.streak > 0 ? 'fill-orange-400/50' : ''} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{t.completed}</p>
              <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{historyCount}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t.dayStreak || "Daily Streak"}</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {streakInfo.streak} <span className="text-base font-normal text-slate-500">{streakInfo.streak === 1 ? (t.day || 'day') : (t.days || 'days')}</span>
              </p>
              {streakInfo.completedToday ? (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} /> {t.todayActive || "Active"}
                </span>
              ) : streakInfo.streak > 0 ? (
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  {t.todayPending || "⚡ Today pending"}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-auto space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
             <p className="text-xs text-slate-500 dark:text-slate-400">
               {streakInfo.completedToday 
                 ? (t.streakActive || "Streak secured for today!") 
                 : streakInfo.streak > 0 
                 ? (t.keepStreak || "Complete a lesson today to keep your streak!") 
                 : (t.streakBroken || "Complete a lesson today to start a streak!")}
             </p>
             <div className="grid grid-cols-7 gap-1 pt-1">
               {streakInfo.dailyStatus.map((day, idx) => (
                 <div key={idx} className="flex flex-col items-center gap-1">
                   <div 
                     className={`h-7 w-full rounded-md flex items-center justify-center text-[10px] font-bold transition-all ${
                       day.completed
                         ? 'bg-gradient-to-t from-orange-500 to-amber-500 text-white shadow-xs'
                         : day.isToday
                         ? 'bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-orange-400 text-orange-500'
                         : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                     }`}
                     title={`${day.dateStr}: ${day.completed ? (t.lessonCompleted || 'Lesson completed') : (t.noLessonsOnDay || 'No lesson')}`}
                   >
                     {day.completed ? <Flame size={12} className="fill-white" /> : day.label}
                   </div>
                   <span className="text-[9px] text-slate-400 font-medium">{day.label}</span>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>

      {/* 30-Day Vocabulary Growth Line Graph using Recharts */}
      <ProgressChart 
        history={history} 
        currentTotal={profile.knownWords.length} 
        t={t}
        darkMode={profile.darkMode}
      />

      {/* 30-Day Study Activity Calendar Heatmap */}
      <ActivityCalendar 
        history={history} 
        t={t}
        dailyGoal={targetGoal}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main Philosophy Section */}
        <div className="bg-indigo-900 dark:bg-indigo-800 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 space-y-4">
            <h3 className="text-2xl font-bold">{t.philosophy}</h3>
            <p className="text-indigo-100 leading-relaxed text-sm">{t.philosophyDesc}</p>
          </div>
          <div className="relative z-10 pt-6">
            <button onClick={onGenerate} className="group flex items-center gap-2 text-indigo-200 hover:text-white transition-colors font-bold cursor-pointer">
              {t.startNow} <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        </div>

        {/* Review Promo Section */}
        <div className="bg-emerald-900 dark:bg-emerald-800 rounded-3xl p-8 text-white relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 space-y-4">
            <h3 className="text-2xl font-bold">{t.review}</h3>
            <p className="text-emerald-100 leading-relaxed text-sm">{t.reviewDesc}</p>
          </div>
          <div className="relative z-10 pt-6">
            <button onClick={onReview} className="group flex items-center gap-2 text-emerald-200 hover:text-white transition-colors font-bold cursor-pointer">
              {t.consolidateNow || "Consolidate now"} <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
