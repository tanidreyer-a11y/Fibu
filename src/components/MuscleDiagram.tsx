import { useEffect, useRef, useState } from 'react';
import { BodyChart, ViewSide, type BodyState } from 'body-muscles';
import { Chip } from './ui/Chip';

export function MuscleDiagram({ bodyState, emptyHint }: { bodyState: BodyState; emptyHint?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<BodyChart | null>(null);
  const [view, setView] = useState<ViewSide>(ViewSide.FRONT);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = new BodyChart(containerRef.current, {
      view,
      bodyState,
      showViewLabel: false,
      enableTransitions: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
    chartRef.current = chart;
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chartRef.current?.update({ view });
  }, [view]);

  useEffect(() => {
    chartRef.current?.update({ bodyState });
  }, [bodyState]);

  const isEmpty = Object.keys(bodyState).length === 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-[220px]">
        <div ref={containerRef} className="[&_svg]:w-full [&_svg]:h-auto" />
        {isEmpty && emptyHint && (
          <p className="absolute inset-x-0 bottom-2 text-center text-xs text-text-faint">{emptyHint}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Chip active={view === ViewSide.FRONT} onClick={() => setView(ViewSide.FRONT)}>
          Front
        </Chip>
        <Chip active={view === ViewSide.BACK} onClick={() => setView(ViewSide.BACK)}>
          Back
        </Chip>
      </div>
    </div>
  );
}
