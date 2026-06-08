import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Users, CheckCircle2, Calendar } from 'lucide-react';
import { detectLang, getTranslations, getDateLocale } from '../lib/i18n';

const lang = detectLang();
const t = getTranslations(lang).dashboard;
const tTime = getTranslations(lang).timeOfDay;
const dateLocale = getDateLocale(lang);

function formatTimeOfDay(value: string | undefined): string {
  if (!value) return tTime.entire_day;
  return tTime[value as keyof typeof tTime] ?? value.replace('_', ' ');
}

export function Dashboard({ user, onBookToday }: { user: any; onBookToday?: () => void }) {
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

      const { data: desks, error: desksError } = await supabase
        .from('desks')
        .select('id, name');
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

  if (loading) {
    return (
      <div className="space-y-8">
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
    );
  }

  const occupancyRate = stats.totalDesks > 0
    ? Math.round((stats.bookedDesks / stats.totalDesks) * 100)
    : 0;

  const myBookings = bookings.filter(b => b.user_id === user.id);

  return (
    <div className="space-y-8">
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
  );
}
