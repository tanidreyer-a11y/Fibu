import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { db } from '../lib/db';
import { getAiDailyMessage } from '../lib/coach';
import { getDailyQuote } from '../lib/quotes';
import { computeSessionVolumeKg } from '../lib/training';
import { displayWeight } from '../lib/units';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function Home() {
  const navigate = useNavigate();
  const today = new Date();
  const dayName = DAY_NAMES[today.getDay()];
  const curatedQuote = getDailyQuote(today);
  const [quote, setQuote] = useState(curatedQuote);

  const profile = useLiveQuery(() => db.profile.get('me'));
  const settings = useLiveQuery(() => db.settings.get('app'));
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').reverse().toArray(), [], []);

  useEffect(() => {
    if (!settings?.geminiApiKey) return;
    let cancelled = false;
    getAiDailyMessage(dayName, curatedQuote).then((text) => {
      if (!cancelled) setQuote(text);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.geminiApiKey, dayName]);

  const units = settings?.units ?? 'kg';
  const lastSession = sessions?.[0];

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const sessionsThisWeek = (sessions ?? []).filter((s) => new Date(s.date) >= startOfWeek);

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-rise-in">
        <p className="text-sm font-medium text-text-faint">{dayName}</p>
        <h1 className="font-display mt-1 text-[28px] font-semibold leading-tight text-text">
          {profile ? `Hey. Let's get started.` : 'Welcome to Fibu.'}
        </h1>
        <p className="mt-2 text-text-muted">&ldquo;{quote}&rdquo;</p>
      </div>

      <Card className="animate-rise-in" style={{ animationDelay: '60ms' }}>
        <p className="text-sm text-text-muted">What do you want to do today?</p>
        <div className="mt-4 flex flex-col gap-2.5">
          <Button size="lg" onClick={() => navigate('/train')}>
            Start a workout
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate('/body')}>
            View muscle progress
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 animate-rise-in" style={{ animationDelay: '120ms' }}>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-faint">This week</p>
          <p className="font-display mt-1 text-2xl font-semibold text-text">{sessionsThisWeek.length}</p>
          <p className="text-xs text-text-muted">workout{sessionsThisWeek.length === 1 ? '' : 's'} logged</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-text-faint">Last session</p>
          {lastSession ? (
            <>
              <p className="font-display mt-1 text-2xl font-semibold text-text">
                {displayWeight(computeSessionVolumeKg(lastSession), units)}
                <span className="text-sm text-text-muted"> {units}</span>
              </p>
              <p className="truncate text-xs text-text-muted">{lastSession.dayLabel}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-text-muted">No sessions yet</p>
          )}
        </Card>
      </div>
    </div>
  );
}
