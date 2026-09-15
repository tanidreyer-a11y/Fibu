import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogoMark } from '../components/Logo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { db } from '../lib/db';
import { getAiDailyMessage } from '../lib/coach';
import { getDailyQuote } from '../lib/quotes';
import { computeSessionVolumeKg } from '../lib/training';
import { displayWeight } from '../lib/units';
import { useCountUp } from '../lib/useCountUp';

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

  const weekCount = useCountUp(sessionsThisWeek.length);
  const lastVolume = useCountUp(lastSession ? displayWeight(computeSessionVolumeKg(lastSession), units) : 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-rise-in flex items-start gap-3">
        <LogoMark size={34} className="mt-0.5 shrink-0 text-text" />
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-faint">{dayName}</p>
          <p className="font-display mt-1 text-[19px] font-semibold leading-snug text-text">{quote}</p>
        </div>
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

      <Card className="animate-rise-in" style={{ animationDelay: '120ms' }}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-faint">This week</p>
            <p className="font-display mt-1 text-4xl font-bold tabular-nums text-text">
              {weekCount}
              {profile && <span className="text-lg font-medium text-text-muted"> / {profile.daysPerWeek}</span>}
            </p>
            <p className="text-xs text-text-muted">workout{sessionsThisWeek.length === 1 ? '' : 's'} logged</p>
          </div>
          {lastSession ? (
            <div className="text-right">
              <p className="text-xs text-text-faint">Last · {lastSession.dayLabel}</p>
              <p className="font-display text-xl font-semibold tabular-nums text-text">
                {lastVolume}
                <span className="text-xs font-medium text-text-muted"> {units}</span>
              </p>
            </div>
          ) : (
            <p className="text-right text-xs text-text-faint">No sessions yet</p>
          )}
        </div>
      </Card>
    </div>
  );
}
