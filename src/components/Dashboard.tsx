import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { Users, CheckCircle2, Calendar, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { detectLang, getTranslations, getDateLocale } from '../lib/i18n';
import { cn } from '../lib/utils';

const lang = detectLang();
const t = getTranslations(lang).dashboard;
const tTime = getTranslations(lang).timeOfDay;
const dateLocale = getDateLocale(lang);

function formatTimeOfDay(value: string | undefined): string {
  if (!value) return tTime.entire_day;
  return tTime[value as keyof typeof tTime] ?? value.replace('_', ' ');
}

function occupancyStyle(pct: number): React.CSSProperties {
  // Continuous white → blue-500 scale
  const alpha = pct / 100;
  return {
    backgroundColor: `rgba(59, 130, 246, ${alpha})`,
    color: pct >= 55 ? 'white' : pct > 0 ? 'rgb(29, 78, 216)' : 'rgb(212, 212, 216)',
  };
}

export function Dashboard({ user, onBookToday }: { user: any; onBookToday?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalDesks: 0, bookedDesks: 0 });
  const [bookings, setBookings] = useState<any[]>([]);
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));
  const [monthOccupancy, setMonthOccupancy] = useState<Record<string, number>>({});
  const [myMonthDates, setMyMonthDates] = useState<Set<string>>(new Set());
  const [monthLoading, setMonthLoading] = useState(false);

  useEffect(() => { fetchDashboardData(); }, []);
  useEffect(() => { fetchMonthOccupancy(); }, [viewMonth]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data: desks, error: desksError } = await supabase
        .from('desks').select('id, name');
      if (desksError) throw desksError;

      const { data: todayBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, user_id, desk_id, status, user_name, time_of_day')
        .eq('date', today);
      if (bookingsError) throw bookingsError;

      const uniqueBookedDesks = new Set(todayBookings?.map(b => b.desk_id)).size;
      setStats({ totalDesks: desks?.length || 0, bookedDesks: uniqueBookedDesks });
      setBookings(todayBookings || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthOccupancy = async () => {
    try {
      setMonthLoading(true);
      const monthStart = format(startOfMonth(viewMonth), 'yyyy-MM-dd');
      const monthEnd   = format(endOfMonth(viewMonth),   'yyyy-MM-dd');

      const [{ data: desks }, { data: monthData }] = await Promise.all([
        supabase.from('desks').select('id'),
        supabase.from('bookings').select('date, desk_id, user_id').gte('date', monthStart).lte('date', monthEnd),
      ]);

      const total = desks?.length ?? 0;
      const occMap: Record<string, Set<string>> = {};
      (monthData ?? []).forEach((b: { date: string; desk_id: string }) => {
        if (!occMap[b.date]) occMap[b.date] = new Set();
        occMap[b.date].add(b.desk_id);
      });
      const pctMap: Record<string, number> = {};
      if (total > 0) {
        Object.entries(occMap).forEach(([d, s]) => {
          pctMap[d] = Math.round((s.size / total) * 100);
        });
      }
      setMonthOccupancy(pctMap);
      setMyMonthDates(new Set(
        (monthData ?? []).filter((b: { user_id: string }) => b.user_id === user.id).map((b: { date: string }) => b.date)
      ));
    } catch (error) {
      console.error('Error fetching month occupancy:', error);
    } finally {
      setMonthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="flex-1 min-w-0 space-y-8">
          <div>
            <div className="h-8 w-48 bg-zinc-100 rounded-lg animate-pulse"></div>
            <div className="h-4 w-40 bg-zinc-100 rounded-lg animate-pulse mt-2"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map(i => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
                <div className="h-4 w-32 bg-zinc-100 rounded animate-pulse"></div>
                <div className="h-10 w-24 bg-zinc-100 rounded animate-pulse"></div>
                <div className="h-2.5 w-full bg-zinc-100 rounded-full animate-pulse"></div>
              </div>
            ))}
          </div>
          <div>
            <div className="h-6 w-44 bg-zinc-100 rounded animate-pulse mb-4"></div>
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
              {[0, 1, 2].map(i => (
                <div key={i} className="p-4 flex items-center gap-3 border-b border-zinc-100 last:border-0">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 animate-pulse shrink-0"></div>
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-28 bg-zinc-100 rounded animate-pulse"></div>
                    <div className="h-3 w-16 bg-zinc-100 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="w-full md:w-72 shrink-0">
          <div className="h-6 w-44 bg-zinc-100 rounded animate-pulse mb-4"></div>
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4 h-72 animate-pulse"></div>
        </div>
      </div>
    );
  }

  const occupancyRate = stats.totalDesks > 0
    ? Math.round((stats.bookedDesks / stats.totalDesks) * 100)
    : 0;

  const myBookings = bookings.filter(b => b.user_id === user.id);

  // Calendar
  const monthDays = eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) });
  const calendarOffset = (getDay(monthDays[0]) + 6) % 7;

  // KPI: average occupancy of past workdays in the viewed month (weekends excluded)
  const today = new Date();
  const pastWorkdays = monthDays.filter(d => {
    const dow = getDay(d);
    return dow !== 0 && dow !== 6 && d <= today;
  });
  const avgOccupancy = pastWorkdays.length > 0
    ? Math.round(
        pastWorkdays.reduce((sum, d) => sum + (monthOccupancy[format(d, 'yyyy-MM-dd')] ?? 0), 0)
        / pastWorkdays.length
      )
    : null;

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start">
      {/* Left panel */}
      <div className="flex-1 min-w-0 space-y-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t.title}</h2>
          <p className="text-zinc-500 mt-1">{format(new Date(), t.dateFormat, { locale: dateLocale })}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex items-center gap-3 text-zinc-500 mb-2">
              <Users className="w-5 h-5" />
              <h3 className="font-medium">{t.occupancy}</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight">{stats.bookedDesks}</span>
              <span className="text-zinc-500 font-medium">/ {stats.totalDesks} {t.desks}</span>
            </div>
            <div className="mt-4 w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  occupancyRate <= 50 ? 'bg-emerald-500' : occupancyRate <= 80 ? 'bg-amber-400' : 'bg-red-400'
                }`}
                style={{ width: `${occupancyRate}%` }}
              ></div>
            </div>
            <p className="text-sm text-zinc-500 mt-2">{occupancyRate}% {t.capacity}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <div className="flex items-center gap-3 text-zinc-500 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="font-medium">{t.yourStatus}</h3>
            </div>

            {myBookings.length > 0 ? (
              <div className="space-y-4">
                {myBookings.map(booking => (
                  <div key={booking.id} className="border-b border-zinc-100 last:border-0 pb-4 last:pb-0">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium mb-3">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      {t.bookedFor} <span className="capitalize">{formatTimeOfDay(booking.time_of_day)}</span>
                    </div>
                    <p className="text-sm text-zinc-500">{t.allSet}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-sm font-medium mb-3">
                  <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
                  {t.notBooked}
                </div>
                <p className="text-zinc-500 mb-4">{t.noDesk}</p>
                {onBookToday && (
                  <button
                    onClick={onBookToday}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 transition-colors"
                  >
                    <Calendar className="w-4 h-4" />
                    {t.bookToday}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">{t.peopleToday}</h3>

          {bookings.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200 border-dashed">
              <p className="text-zinc-500">{t.noOne}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
              <ul className="divide-y divide-zinc-100">
                {bookings.map((booking) => (
                  <li key={booking.id} className="p-4 flex items-center gap-3 hover:bg-zinc-50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-medium shrink-0">
                      {(booking.user_name || booking.user_id).substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900">
                        {booking.user_id === user.id ? t.you : (booking.user_name || `User ${booking.user_id.substring(0, 6)}`)}
                      </p>
                      <p className="text-sm text-zinc-500 capitalize">
                        {formatTimeOfDay(booking.time_of_day)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — monthly occupancy calendar */}
      <div className="w-full md:w-72 shrink-0">
        <h3 className="text-lg font-semibold mb-4">{t.monthlyOccupancy}</h3>
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setViewMonth(m => subMonths(m, 1))}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-sm font-medium text-zinc-700">
              {format(viewMonth, 'MMMM yyyy', { locale: dateLocale })}
            </p>
            <button
              onClick={() => setViewMonth(m => addMonths(m, 1))}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* KPI */}
          {avgOccupancy !== null && (
            <div className="mb-3 px-3 py-2 bg-zinc-50 rounded-xl flex items-center justify-between">
              <span className="text-xs text-zinc-500">{t.avgOccupancy}</span>
              <span className="text-sm font-semibold text-zinc-800">{avgOccupancy}%</span>
            </div>
          )}

          <div className={cn('transition-opacity', monthLoading ? 'opacity-40' : 'opacity-100')}>
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-zinc-400 py-1">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: calendarOffset }).map((_, i) => (
                <div key={`e${i}`} />
              ))}
              {monthDays.map(day => {
                const ds = format(day, 'yyyy-MM-dd');
                const pct = monthOccupancy[ds];
                const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                const isMine = myMonthDates.has(ds);
                const style = !isWeekend && pct !== undefined && pct > 0
                  ? occupancyStyle(pct)
                  : undefined;
                return (
                  <div
                    key={ds}
                    title={!isWeekend && pct !== undefined ? `${pct}%` : undefined}
                    style={style}
                    className={cn(
                      'relative flex flex-col items-center justify-center rounded-lg aspect-square text-xs font-medium transition-colors',
                      isWeekend
                        ? 'text-zinc-200'
                        : pct === undefined || pct === 0
                        ? 'text-zinc-400'
                        : ''
                    )}
                  >
                    <span>{format(day, 'd')}</span>
                    {!isWeekend && pct !== undefined && pct > 0 && (
                      <span className="text-[9px] leading-none opacity-80">{pct}%</span>
                    )}
                    {isMine && (
                      <div className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-px border border-white shadow-sm">
                        <Check className="w-2 h-2" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
