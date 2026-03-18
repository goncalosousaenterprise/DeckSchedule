import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format, addDays, isBefore, startOfDay, isSameDay } from 'date-fns';
import { Calendar as CalendarIcon, Loader2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

export function Booking({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [desks, setDesks] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [userBookedDates, setUserBookedDates] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Generate next 14 days
  const dates = Array.from({ length: 14 }).map((_, i) => addDays(startOfDay(new Date()), i));

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
      if (data) {
        setUserBookedDates(data.map(b => b.date));
      }
    } catch (error) {
      console.error('Error fetching user bookings:', error);
    }
  };

  const fetchDesksAndBookings = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // Fetch all desks
      const { data: desksData, error: desksError } = await supabase
        .from('desks')
        .select('*')
        .order('name');
      
      if (desksError) throw desksError;

      // Fetch bookings for selected date
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, user_name')
        .eq('date', dateStr);

      if (bookingsError) throw bookingsError;

      setDesks(desksData || []);
      setBookings(bookingsData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load desks');
    } finally {
      setLoading(false);
    }
  };

  const handleBookDesk = async (deskId: string) => {
    try {
      setActionLoading(deskId);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const { error } = await supabase
        .from('bookings')
        .insert([
          {
            user_id: user.id,
            desk_id: deskId,
            date: dateStr,
            status: 'booked',
            user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown'
          }
        ]);

      if (error) {
        if (error.code === '23505') {
          toast.error('You already have a booking for this day or the desk was just taken.');
        } else {
          throw error;
        }
      } else {
        toast.success('Desk booked successfully!');
        fetchDesksAndBookings();
        fetchUserBookings();
      }
    } catch (error: any) {
      console.error('Error booking desk:', error);
      toast.error(error.message || 'Failed to book desk');
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
      
      toast.success('Booking cancelled');
      fetchDesksAndBookings();
      fetchUserBookings();
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      toast.error('Failed to cancel booking');
    } finally {
      setActionLoading(null);
    }
  };

  const userBooking = bookings.find(b => b.user_id === user.id);
  const isFullyBooked = bookings.length >= desks.length && desks.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Book a Desk</h2>
        <p className="text-zinc-500 mt-1">Select a date to see available desks.</p>
      </div>

      {/* Date Selector */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto">
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
                  {format(date, 'EEE')}
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

      {/* Main Content */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-zinc-400" />
            <h3 className="font-semibold text-lg">
              {format(selectedDate, 'EEEE, MMMM d')}
            </h3>
          </div>
          
          <div className="text-sm font-medium text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">
            {bookings.length} / {desks.length} booked
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="p-6">
            {userBooking ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center justify-between mb-8">
                <div>
                  <div className="flex items-center gap-2 text-emerald-700 font-medium mb-1">
                    <Check className="w-5 h-5" />
                    You have a desk booked
                  </div>
                  <p className="text-emerald-900 text-lg font-semibold">
                    {desks.find(d => d.id === userBooking.desk_id)?.name}
                  </p>
                </div>
                <button
                  onClick={() => handleCancelBooking(userBooking.id)}
                  disabled={actionLoading === userBooking.id}
                  className="px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {actionLoading === userBooking.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  Cancel Booking
                </button>
              </div>
            ) : isFullyBooked ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center mb-8">
                <p className="text-amber-800 font-medium">The office is fully booked on this day.</p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {desks.map((desk) => {
                const booking = bookings.find(b => b.desk_id === desk.id);
                const isBooked = !!booking;
                const isMyBooking = booking?.user_id === user.id;

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
                      if (!isBooked && !userBooking) {
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
                        {isMyBooking ? 'Your desk' : isBooked ? (booking.user_name || 'Booked') : 'Available'}
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
