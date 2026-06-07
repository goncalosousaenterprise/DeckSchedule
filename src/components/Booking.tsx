import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Check, X } from 'lucide-react';
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

export function Booking({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [desks, setDesks] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [userBookedDates, setUserBookedDates] = useState<string[]>([]);
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
        .select('date')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;
      if (data) setUserBookedDates(data.map(b => b.date));
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
      const hasOverlap = myBookingsToday.some(b =>
        b.time_of_day === 'entire_day' ||
        timeOfDay === 'entire_day' ||
        b.time_of_day === timeOfDay
      );

      if (hasOverlap) {
        const slotLabel = timeOptions.find(o => o.id === timeOfDay)?.label ?? timeOfDay;
        toast.error(t.overlapError(slotLabel));
        setActionLoading(null);
        return;
      }

      const { error } = await supabase
        .from('bookings')
        .insert([{
          user_id: user.id,
          desk_id: deskId,
          date: dateStr,
          status: 'booked',
          time_of_day: timeOfDay,
          user_name: getInitials(user.email || ''),
        }]);

      if (error) {
        if (error.code === '23505') {
          toast.error(t.doubleBookError);
        } else {
          throw error;
        }
      } else {
        toast.success(t.bookedSuccess);
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

  const myBookingsToday = bookings.filter(b => b.user_id === user.id);

  const isFullyBooked = desks.length > 0 && desks.every(desk => {
    const deskBookings = bookings.filter(b => b.desk_id === desk.id);
    return deskBookings.some(b =>
      b.time_of_day === 'entire_day' ||
      timeOfDay === 'entire_day' ||
      b.time_of_day === timeOfDay
    );
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{t.title}</h2>
        <p className="text-zinc-500 mt-1">{t.subtitle}</p>
      </div>

      {/* Date Selector */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto mb-6">
        <div className="flex gap-2 min-w-max">
          {dates.map((date) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            const hasBooking = userBookedDates.includes(format(date, 'yyyy-MM-dd'));

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "relative flex flex-col items-center justify-center w-16 h-20 rounded-xl transition-all shrink-0",
                  isSelected
                    ? "bg-zinc-900 text-white shadow-md"
                    : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100 border border-zinc-200"
                )}
              >
                <span className={cn("text-xs font-medium uppercase tracking-wider mb-1", isSelected ? "text-zinc-300" : "text-zinc-500")}>
                  {format(date, 'EEE', { locale: dateLocale })}
                </span>
                <span className="text-xl font-semibold">
                  {format(date, 'd')}
                </span>
                {isToday && (
                  <span className={cn("w-1 h-1 rounded-full mt-1", isSelected ? "bg-white" : "bg-zinc-900")}></span>
                )}
                {hasBooking && (
                  <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border-2 border-white">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time of Day Selector */}
      <div className="flex bg-zinc-100 p-1 rounded-xl w-full max-w-md mb-6">
        {timeOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => setTimeOfDay(option.id)}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-lg transition-all",
              timeOfDay === option.id
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-zinc-400" />
            <h3 className="font-semibold text-lg">
              {format(selectedDate, 'EEEE, MMMM d', { locale: dateLocale })}
            </h3>
          </div>
          <div className="text-sm font-medium text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">
            {bookings.length} / {desks.length} {t.bookedCounter}
          </div>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-32 rounded-xl border-2 border-zinc-100 bg-zinc-50 animate-pulse"></div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6">
            {myBookingsToday.length > 0 ? (
              <div className="space-y-3 mb-8">
                {myBookingsToday.map(booking => (
                  <div key={booking.id} className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-emerald-700 font-medium mb-1">
                        <Check className="w-5 h-5" />
                        {t.youHaveBooked} <span className="capitalize">({timeOptions.find(o => o.id === booking.time_of_day)?.label ?? booking.time_of_day?.replace('_', ' ')})</span>
                      </div>
                      <p className="text-emerald-900 text-lg font-semibold">
                        {desks.find(d => d.id === booking.desk_id)?.name}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      disabled={actionLoading === booking.id}
                      className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {actionLoading === booking.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                      {t.cancelBooking}
                    </button>
                  </div>
                ))}
              </div>
            ) : isFullyBooked ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-8">
                <p className="text-amber-800 font-medium">{t.fullyBooked}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {desks.map((desk) => {
                const deskBookings = bookings.filter(b => b.desk_id === desk.id);
                const overlappingBookings = deskBookings.filter(b =>
                  b.time_of_day === 'entire_day' ||
                  timeOfDay === 'entire_day' ||
                  b.time_of_day === timeOfDay
                );
                const isBooked = overlappingBookings.length > 0;
                const myOverlappingBooking = overlappingBookings.find(b => b.user_id === user.id);
                const isMyBooking = !!myOverlappingBooking;
                const displayBooking = myOverlappingBooking || overlappingBookings[0];

                return (
                  <div
                    key={desk.id}
                    className={cn(
                      "relative p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 h-32",
                      isMyBooking
                        ? "border-emerald-500 bg-emerald-50"
                        : isBooked
                        ? "border-zinc-200 bg-zinc-50 opacity-60"
                        : "border-zinc-200 bg-white hover:border-zinc-900 cursor-pointer"
                    )}
                    onClick={() => {
                      if (!isBooked && !myBookingsToday.some(b => b.time_of_day === 'entire_day' || timeOfDay === 'entire_day' || b.time_of_day === timeOfDay)) {
                        handleBookDesk(desk.id);
                      }
                    }}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center font-semibold text-lg",
                      isMyBooking ? "bg-emerald-100 text-emerald-700" :
                      isBooked ? "bg-zinc-200 text-zinc-500" : "bg-zinc-100 text-zinc-900"
                    )}>
                      {desk.name.replace('Desk ', '')}
                    </div>

                    <div className="text-center">
                      <p className={cn("font-medium text-sm", isBooked ? "text-zinc-500" : "text-zinc-900")}>
                        {desk.name}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {isMyBooking ? t.yourDesk : isBooked ? (displayBooking?.user_name || t.bookedCounter) : t.available}
                      </p>
                    </div>

                    {actionLoading === desk.id && (
                      <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center backdrop-blur-sm">
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-900" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
