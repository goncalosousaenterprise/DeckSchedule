import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format, addDays, startOfDay, isSameDay, getDay } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, X, Users, Lock, Sun, Sunrise, Sunset } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { detectLang, getTranslations, getDateLocale } from '../lib/i18n';

const lang = detectLang();
const t = getTranslations(lang).booking;
const dateLocale = getDateLocale(lang);

function getInitials(email: string): string {
  const local = email.split('@')[0];
  const parts = local.split('.');
  const first = parts[0]?.[0]?.toUpperCase() ?? '';
  if (parts.length >= 2) {
    return first + (parts[1][0]?.toUpperCase() ?? '');
  }
  return first + (parts[0]?.[1]?.toUpperCase() ?? first);
}

function getOverlapping(deskId: string, bookings: any[], timeOfDay: string) {
  return bookings.filter(
    b =>
      b.desk_id === deskId &&
      (b.time_of_day === 'entire_day' || timeOfDay === 'entire_day' || b.time_of_day === timeOfDay)
  );
}

export function Booking({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [desks, setDesks] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [userBookings, setUserBookings] = useState<{ date: string; time_of_day: string }[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<'entire_day' | 'morning' | 'afternoon'>('entire_day');

  const dates = Array.from({ length: 28 }).map((_, i) => addDays(startOfDay(new Date()), i));

  const timeOptions = [
    { id: 'entire_day' as const, label: t.entireDay },
    { id: 'morning' as const, label: t.morning },
    { id: 'afternoon' as const, label: t.afternoon },
  ];

  useEffect(() => {
    fetchDesksAndBookings();
  }, [selectedDate]);

  useEffect(() => {
    fetchUserBookings();
  }, []);

  const fetchUserBookings = async () => {
    try {
      const startDate = format(dates[0], 'yyyy-MM-dd');
      const endDate = format(dates[dates.length - 1], 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('bookings')
        .select('date, time_of_day')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);
      if (error) throw error;
      if (data) setUserBookings(data);
    } catch (error) {
      console.error('Error fetching user bookings:', error);
    }
  };

  const fetchDesksAndBookings = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data: desksData, error: desksError } = await supabase
        .from('desks')
        .select('*')
        .order('name');
      if (desksError) throw desksError;

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, user_name, time_of_day')
        .eq('date', dateStr);
      if (bookingsError) throw bookingsError;

      setDesks(desksData || []);
      setBookings(bookingsData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error(t.loadError);
    } finally {
      setLoading(false);
    }
  };

  const handleBookDesk = async (deskId: string) => {
    try {
      setActionLoading(deskId);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const myBookingsToday = bookings.filter(b => b.user_id === user.id);
      const hasOverlap = myBookingsToday.some(
        b =>
          b.desk_id === deskId &&
          (b.time_of_day === 'entire_day' || timeOfDay === 'entire_day' || b.time_of_day === timeOfDay)
      );
      if (hasOverlap) {
        const slotLabel = timeOptions.find(o => o.id === timeOfDay)?.label ?? timeOfDay;
        toast.error(t.overlapError(slotLabel));
        setActionLoading(null);
        return;
      }

      const targetType = desks.find(d => d.id === deskId)?.type;
      const hasCrossType = myBookingsToday.some(b => {
        const bookedType = desks.find(d => d.id === b.desk_id)?.type;
        return targetType === 'private' ? bookedType !== 'private' : bookedType === 'private';
      });
      if (hasCrossType) {
        toast.error(t.crossTypeError);
        setActionLoading(null);
        return;
      }

      const { error } = await supabase.from('bookings').insert([
        {
          user_id: user.id,
          desk_id: deskId,
          date: dateStr,
          status: 'booked',
          time_of_day: timeOfDay,
          user_name: getInitials(user.email || ''),
        },
      ]);

      if (error) {
        if (error.code === '23505') {
          toast.error(t.doubleBookError);
        } else {
          throw error;
        }
      } else {
        // Check if morning + afternoon should merge into entire_day
        const myExistingOpen = bookings.filter(
          b => b.user_id === user.id && openDesks.some(d => d.id === b.desk_id)
        );
        const needsMerge =
          (timeOfDay === 'afternoon' && myExistingOpen.some(b => b.time_of_day === 'morning')) ||
          (timeOfDay === 'morning' && myExistingOpen.some(b => b.time_of_day === 'afternoon'));

        if (needsMerge) {
          const { data: freshBookings } = await supabase
            .from('bookings')
            .select('id, desk_id, time_of_day')
            .eq('date', dateStr)
            .eq('user_id', user.id);

          const morningB = freshBookings?.find(b => b.time_of_day === 'morning');
          const afternoonB = freshBookings?.find(b => b.time_of_day === 'afternoon');

          if (morningB && afternoonB) {
            await supabase.from('bookings').delete().in('id', [morningB.id, afternoonB.id]);
            await supabase.from('bookings').insert([{
              user_id: user.id,
              desk_id: morningB.desk_id,
              date: dateStr,
              status: 'booked',
              time_of_day: 'entire_day',
              user_name: getInitials(user.email || ''),
            }]);
            toast.success(t.mergedToEntireDay);
          } else {
            toast.success(t.bookedSuccess);
          }
        } else {
          toast.success(t.bookedSuccess);
        }
        fetchDesksAndBookings();
        fetchUserBookings();
      }
    } catch (error: any) {
      console.error('Error booking desk:', error);
      toast.error(error.message || t.bookError);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      setActionLoading(bookingId);
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success(t.cancelSuccess);
      fetchDesksAndBookings();
      fetchUserBookings();
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      toast.error(t.cancelError);
    } finally {
      setActionLoading(null);
    }
  };

  // Derived state
  const openDesks = desks.filter(d => d.type !== 'private');
  const privateOffice = desks.find(d => d.type === 'private') ?? null;

  const availableOpenDesks = openDesks.filter(d => getOverlapping(d.id, bookings, timeOfDay).length === 0);
  const availableCount = availableOpenDesks.length;
  const totalOpen = openDesks.length;

  const myOpenBooking = bookings.find(
    b => b.user_id === user.id && openDesks.some(d => d.id === b.desk_id) &&
      (b.time_of_day === 'entire_day' || timeOfDay === 'entire_day' || b.time_of_day === timeOfDay)
  );

  const privateOverlapping = privateOffice ? getOverlapping(privateOffice.id, bookings, timeOfDay) : [];
  const isPrivateBooked = privateOverlapping.length > 0;
  const myPrivateBooking = privateOverlapping.find(b => b.user_id === user.id);

  const handleBookSpot = () => {
    const first = availableOpenDesks[0];
    if (first) handleBookDesk(first.id);
  };

  const isAnyActionLoading = actionLoading !== null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t.title}</h2>
        <p className="text-zinc-500 mt-1">{t.subtitle}</p>
      </div>

      {/* Date Selector */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {dates.map((date) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            const isWeekend = getDay(date) === 0 || getDay(date) === 6;
            const dateStr = format(date, 'yyyy-MM-dd');
            const bookingsForDate = userBookings.filter(b => b.date === dateStr);
            const isEntireDay = bookingsForDate.some(b => b.time_of_day === 'entire_day');
            const hasMorning = bookingsForDate.some(b => b.time_of_day === 'morning');
            const hasAfternoon = bookingsForDate.some(b => b.time_of_day === 'afternoon');
            const hasBoth = hasMorning && hasAfternoon;

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  'relative flex flex-col items-center justify-center w-16 h-20 rounded-xl transition-all shrink-0',
                  isSelected
                    ? 'bg-zinc-900 text-white shadow-md'
                    : isWeekend
                    ? 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100 border border-zinc-100'
                    : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
                )}
              >
                <span
                  className={cn(
                    'text-xs font-medium uppercase tracking-wider mb-1',
                    isSelected ? 'text-zinc-300' : isWeekend ? 'text-zinc-300' : 'text-zinc-500'
                  )}
                >
                  {format(date, 'EEE', { locale: dateLocale })}
                </span>
                <span className="text-xl font-semibold">{format(date, 'd')}</span>
                {isToday && (
                  <span
                    className={cn(
                      'w-1 h-1 rounded-full mt-1',
                      isSelected ? 'bg-white' : isWeekend ? 'bg-zinc-300' : 'bg-zinc-900'
                    )}
                  ></span>
                )}
                {/* Entire day */}
                {isEntireDay && (
                  <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border-2 border-white">
                    <Sun className="w-3 h-3" />
                  </div>
                )}
                {/* Morning only */}
                {!isEntireDay && hasMorning && !hasAfternoon && (
                  <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border-2 border-white">
                    <Sunrise className="w-3 h-3" />
                  </div>
                )}
                {/* Afternoon only */}
                {!isEntireDay && !hasMorning && hasAfternoon && (
                  <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border-2 border-white">
                    <Sunset className="w-3 h-3" />
                  </div>
                )}
                {/* Morning + afternoon → two badges */}
                {!isEntireDay && hasBoth && (
                  <>
                    <div className="absolute -bottom-1.5 -left-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border-2 border-white">
                      <Sunrise className="w-3 h-3" />
                    </div>
                    <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border-2 border-white">
                      <Sunset className="w-3 h-3" />
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time of Day Selector */}
      <div className="flex bg-zinc-100 p-1 rounded-xl w-full max-w-md">
        {timeOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => setTimeOfDay(option.id)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-all',
              timeOfDay === option.id
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Date header */}
      <div className="flex items-center gap-3 pb-2 border-b border-zinc-100">
        <CalendarIcon className="w-5 h-5 text-zinc-400" />
        <h3 className="font-semibold text-lg">
          {format(selectedDate, 'EEEE, MMMM d', { locale: dateLocale })}
        </h3>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200 h-44 animate-pulse"></div>
          <div className="bg-white rounded-2xl border border-zinc-200 h-32 animate-pulse"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Open Workspaces */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Users className="w-5 h-5 text-zinc-400" />
              <h4 className="font-semibold text-zinc-900">{t.openWorkspaces}</h4>
            </div>

            {myOpenBooking ? (
              /* User already has a spot — show status + cancel */
              <div className="flex items-center justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {t.youHaveSpot}
                  </div>
                  <p className="text-sm text-zinc-500 capitalize">
                    {timeOptions.find(o => o.id === myOpenBooking.time_of_day)?.label ?? myOpenBooking.time_of_day?.replace('_', ' ')}
                  </p>
                </div>
                <button
                  onClick={() => handleCancelBooking(myOpenBooking.id)}
                  disabled={isAnyActionLoading}
                  className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === myOpenBooking.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  {t.cancelSpot}
                </button>
              </div>
            ) : (
              /* Show counter + book button */
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className={cn(
                  'text-2xl font-bold tracking-tight',
                  availableCount === 0 ? 'text-zinc-300' : 'text-zinc-900'
                )}>
                  {t.spotsAvailable(availableCount, totalOpen)}
                </p>
                {availableCount > 0 ? (
                  <button
                    onClick={handleBookSpot}
                    disabled={isAnyActionLoading}
                    className="shrink-0 px-6 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {t.bookSpot}
                  </button>
                ) : (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg shrink-0">
                    {t.noSpotsAvailable}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Private Office */}
          {privateOffice && (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <Lock className="w-5 h-5 text-zinc-400" />
                <h4 className="font-semibold text-zinc-900">{t.privateOfficeLabel}</h4>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      myPrivateBooking
                        ? 'bg-emerald-500'
                        : isPrivateBooked
                        ? 'bg-red-400'
                        : 'bg-emerald-500'
                    )}
                  ></span>
                  <span className="text-sm font-medium text-zinc-700">
                    {myPrivateBooking
                      ? t.youHaveSpot
                      : isPrivateBooked
                      ? t.occupied
                      : t.available}
                  </span>
                </div>

                {myPrivateBooking ? (
                  <button
                    onClick={() => handleCancelBooking(myPrivateBooking.id)}
                    disabled={isAnyActionLoading}
                    className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === myPrivateBooking.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    {t.cancelOffice}
                  </button>
                ) : !isPrivateBooked ? (
                  <button
                    onClick={() => handleBookDesk(privateOffice.id)}
                    disabled={isAnyActionLoading}
                    className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading === privateOffice.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    {t.bookOffice}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
