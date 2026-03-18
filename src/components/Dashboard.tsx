import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Users, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function Dashboard({ user }: { user: any }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalDesks: 0, bookedDesks: 0 });
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch all desks
      const { data: desks, error: desksError } = await supabase
        .from('desks')
        .select('id, name');
      
      if (desksError) throw desksError;

      // Fetch today's bookings
      const { data: todayBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          user_id,
          desk_id,
          status,
          user_name,
          desks (name)
        `)
        .eq('date', today);

      if (bookingsError) throw bookingsError;

      setStats({
        totalDesks: desks?.length || 0,
        bookedDesks: todayBookings?.length || 0,
      });

      setBookings(todayBookings || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const occupancyRate = stats.totalDesks > 0 
    ? Math.round((stats.bookedDesks / stats.totalDesks) * 100) 
    : 0;

  const myBooking = bookings.find(b => b.user_id === user.id);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Today's Overview</h2>
        <p className="text-zinc-500 mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-3 text-zinc-500 mb-2">
            <Users className="w-5 h-5" />
            <h3 className="font-medium">Office Occupancy</h3>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight">{stats.bookedDesks}</span>
            <span className="text-zinc-500 font-medium">/ {stats.totalDesks} desks</span>
          </div>
          
          <div className="mt-4 w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-zinc-900 h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${occupancyRate}%` }}
            ></div>
          </div>
          <p className="text-sm text-zinc-500 mt-2">{occupancyRate}% capacity</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-3 text-zinc-500 mb-2">
            <CheckCircle2 className="w-5 h-5" />
            <h3 className="font-medium">Your Status</h3>
          </div>
          
          {myBooking ? (
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Booked for today
              </div>
              <p className="text-zinc-900 font-medium mb-1">
                Desk: {myBooking.desks?.name}
              </p>
              <p className="text-sm text-zinc-500">
                You're all set for today.
              </p>
            </div>
          ) : (
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-sm font-medium mb-3">
                <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
                Not booked
              </div>
              <p className="text-zinc-500">You don't have a desk reserved for today.</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">People in the office today</h3>
        
        {bookings.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200 border-dashed">
            <p className="text-zinc-500">No one has booked a desk for today yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <ul className="divide-y divide-zinc-100">
              {bookings.map((booking) => (
                <li key={booking.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-medium">
                      {(booking.user_name || booking.user_id).substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900">
                        {booking.user_id === user.id ? 'You' : (booking.user_name || `User ${booking.user_id.substring(0, 6)}`)}
                      </p>
                      <p className="text-sm text-zinc-500">
                        Booked
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-zinc-900 bg-zinc-100 px-3 py-1 rounded-full">
                    {booking.desks?.name}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
