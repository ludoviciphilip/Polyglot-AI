import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { SRSCard, SRSReviewLogEntry } from '../types';
import { generate30DayRetentionData, estimateRetentionRate, RetentionProgressPoint } from '../utils/srs';
import { TrendingUp, Award, Layers, Sparkles, CheckCircle2, ArrowUpRight, BarChart3, HelpCircle } from 'lucide-react';
import { interpolate, renderRichText } from '../utils/richText';

interface SRSRetentionChartProps {
  cards: SRSCard[];
  targetLanguage?: string;
  reviewLogs?: SRSReviewLogEntry[];
  t?: any;
}

export const SRSRetentionChart: React.FC<SRSRetentionChartProps> = ({
  cards,
  targetLanguage,
  reviewLogs,
  t = {}
}) => {
  const [viewMode, setViewMode] = useState<'cumulative' | 'transitions'>('cumulative');
  const [showExplanation, setShowExplanation] = useState(false);

  // Compute 30-day time series data
  const data = useMemo(() => {
    return generate30DayRetentionData(cards, targetLanguage, reviewLogs, t?.intlLocale || undefined);
  }, [cards, targetLanguage, reviewLogs, t?.intlLocale]);

  const fallback = useMemo(() => estimateRetentionRate(cards, reviewLogs), [cards, reviewLogs]);

  // Summary statistics
  const currentStats = useMemo(() => {
    const latest = data[data.length - 1] || { learning: 0, mastered: 0, totalActive: 0, retentionRate: null };
    const first = data[0] || { learning: 0, mastered: 0, totalActive: 0, retentionRate: null };
    
    // Total cards that transitioned to mastered over the 30-day window
    const totalTransitions = data.reduce((acc, point) => acc + (point.graduatedToday || 0), 0);
    const netMasteredGrowth = Math.max(0, latest.mastered - first.mastered);

    // Latest non-null retention rate from rolling days, or fallback estimate
    const latestRatePoint = [...data].reverse().find(p => p.retentionRate !== null);
    const effectiveRetentionRate = latestRatePoint ? latestRatePoint.retentionRate : fallback.rate;
    const isEstimated = latestRatePoint ? false : fallback.isEstimated;

    return {
      currentLearning: latest.learning,
      currentMastered: latest.mastered,
      totalActive: latest.totalActive,
      retentionRate: effectiveRetentionRate,
      isEstimated,
      totalTransitions: totalTransitions > 0 ? totalTransitions : netMasteredGrowth,
    };
  }, [data, fallback]);

  const hasAnyCards = cards.length > 0;

  // Custom Recharts Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pointData: RetentionProgressPoint = payload[0]?.payload;

    return (
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2 min-w-[210px] animate-in fade-in zoom-in-95 duration-150">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
          <p className="font-bold text-slate-800 dark:text-slate-100">
            {pointData?.fullDate || label}
          </p>
          <span className="text-[10px] text-slate-600 dark:text-slate-400">
            {t?.srsChartDayNumber || 'Dia'} {pointData?.dayNumber} {t?.srsChartOf30 || 'de 30'}
          </span>
        </div>

        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              {t?.srsMasteredCards || 'Dominados (Mastered)'}:
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300">
              {pointData?.mastered ?? 0}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
              {t?.srsLearningCards || 'Em Aprendizado'}:
            </span>
            <span className="font-bold text-indigo-700 dark:text-indigo-300">
              {pointData?.learning ?? 0}
            </span>
          </div>

          {pointData?.graduatedToday > 0 && (
            <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800/80">
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <Sparkles size={11} /> {t?.srsGraduatedThisDay || 'Graduados no dia'}:
              </span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                +{pointData.graduatedToday}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400">
            <span>{t?.srsRetentionRate || 'Taxa de Retenção'}:</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">
              {pointData?.retentionRate !== null && pointData?.retentionRate !== undefined
                ? `${pointData.retentionRate}%`
                : (t?.srsInsufficientData || 'Dados insuficientes')}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <TrendingUp size={20} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                {t?.srsRetentionProgressTitle || 'Progresso de Retenção (Últimos 30 Dias)'}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t?.srsRetentionProgressSubtitle || 'Acompanhe a transição dos cards de "Aprendendo" para "Dominados" no longo prazo.'}
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle & Help */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('cumulative')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'cumulative'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t?.srsCumulativeView || 'Visão Acumulada'}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('transitions')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'transitions'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 size={13} />
              <span>{t?.srsDailyTransitions || 'Transições/Dia'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            title={t?.srsRetentionHowItWorksTip || 'Como funciona a retenção?'}
            className="p-2 text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <HelpCircle size={18} />
          </button>
        </div>
      </div>

      {/* Stats Counter Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-1">
        {/* Mastered */}
        <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
            <span>{t?.srsMasteredCards || 'Dominados'}</span>
            <Award size={15} />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
            {currentStats.currentMastered}
          </div>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            {t?.srsIntervalMasteredBadge || 'Intervalo ≥ 21 dias'}
          </p>
        </div>

        {/* Learning */}
        <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/40 rounded-2xl">
          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
            <span>{t?.srsLearningCards || 'Em Aprendizado'}</span>
            <Layers size={15} />
          </div>
          <div className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-300 mt-1">
            {currentStats.currentLearning}
          </div>
          <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">
            {t?.srsActiveRepetition || 'Em repetição ativa'}
          </p>
        </div>

        {/* 30-Day Migrations */}
        <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
            <span>{t?.srsMovedToMastered || 'Transições (30d)'}</span>
            <ArrowUpRight size={15} />
          </div>
          <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
            +{currentStats.totalTransitions}
          </div>
          <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
            {t?.srsLearningToMastered || 'Learning ➔ Mastered'}
          </p>
        </div>

        {/* Memory Stability Rate */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            <span>{t?.srsRetentionRate || 'Retenção Global'}</span>
            <Sparkles size={15} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">
            {currentStats.retentionRate !== null ? `${currentStats.retentionRate}%` : (t?.srsInsufficientData || 'Dados insuficientes')}
          </div>
          <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
            {currentStats.retentionRate !== null
              ? (currentStats.isEstimated ? `(${t?.srsEstimated || 'Estimado'})` : `(${t?.srsRealRetention || 'Real'})`)
              : (t?.srsNeedMoreReviews || 'Necessário mais revisões')}
          </p>
        </div>
      </div>

      {/* Explanation Banner (Collapsible) */}
      {showExplanation && (
        <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl text-xs text-slate-700 dark:text-slate-300 space-y-1.5 animate-in fade-in duration-200">
          <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-indigo-600" />
            <span>{t?.srsTransitionExplainTitle || 'Como funciona a transição de “Em Aprendizado” para “Dominado”?'}</span>
          </div>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">
            {renderRichText(interpolate(
              t?.srsTransitionExplainBody || 'Quando você estuda uma nova frase <strong>i+1</strong>, ela entra no estado <em>Em Aprendizado</em>. Cada revisão bem-sucedida (avaliada como <strong>{good}</strong> ou <strong>{easy}</strong>) aumenta a estabilidade da memória pelo algoritmo <strong>FSRS</strong>, que calcula o intervalo ideal para sua retenção-alvo. Quando o intervalo atinge ou ultrapassa <strong>21 dias</strong>, o card passa oficialmente para <em>Dominado</em>, indicando que a memória de longo prazo foi estabilizada contra o esquecimento.',
              { good: t?.srsGood || 'Bom', easy: t?.srsEasy || 'Fácil' }
            ))}
          </p>
        </div>
      )}

      {/* Chart Canvas */}
      <div className="w-full pt-2">
        {!hasAnyCards ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
              <TrendingUp size={24} />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t?.srsNoChartDataTitle || 'Ainda sem cards no deck SRS'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mt-1">
              {t?.srsNoChartDataDesc || 'Complete sua primeira história para gerar cards de revisão e começar a ver seu progresso de retenção aqui!'}
            </p>
          </div>
        ) : viewMode === 'cumulative' ? (
          /* Cumulative Area Chart */
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  {/* Mastered Gradient (Emerald) */}
                  <linearGradient id="masteredGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>

                  {/* Learning Gradient (Indigo) */}
                  <linearGradient id="learningGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#94a3b8"
                  opacity={0.15}
                />

                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.2 }}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />

                <YAxis
                  yAxisId="left"
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.2 }}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />

                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  unit="%"
                  tickLine={false}
                  axisLine={{ stroke: '#f59e0b', opacity: 0.2 }}
                  tick={{ fill: '#f59e0b', fontSize: 11 }}
                />

                <Tooltip content={<CustomTooltip />} />

                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
                  formatter={(value: string) => {
                    if (value === 'mastered') return t?.srsLegendMastered || 'Dominados (Mastered)';
                    if (value === 'learning') return t?.srsLegendLearning || 'Em Aprendizado (Learning)';
                    if (value === 'retentionRate') return t?.srsRetentionRate || 'Taxa de Retenção (%)';
                    return value;
                  }}
                />

                {/* Mastered Area (Front / Solid) */}
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="mastered"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#masteredGradient)"
                  activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
                />

                {/* Learning Area */}
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="learning"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#learningGradient)"
                  activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }}
                />

                {/* Retention Rate Line (not drawn on null days) */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="retentionRate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  connectNulls={false}
                  dot={{ r: 3, fill: '#f59e0b' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Daily Transitions Bar Chart */
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#94a3b8"
                  opacity={0.15}
                />

                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.2 }}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />

                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={{ stroke: '#94a3b8', opacity: 0.2 }}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />

                <Tooltip content={<CustomTooltip />} />

                <Bar
                  dataKey="graduatedToday"
                  name={t?.srsLegendGraduatedToday || 'Cards que viraram Mastered'}
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Footer educational insight */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>{renderRichText(t?.srsLongTermGoal || 'Meta de longo prazo: <strong>Converter 80%+ do vocabulário em “Dominados”</strong>')}</span>
        </span>
        <span className="text-[11px] text-slate-600 dark:text-slate-400">
          {t?.srsBasedOnFsrsCurve || 'Baseado na curva de esquecimento do FSRS-5'}
        </span>
      </div>
    </div>
  );
};
