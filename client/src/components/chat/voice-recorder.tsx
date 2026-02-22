import { useRef, useEffect, memo } from 'react';
import { Trash2, ArrowUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WaveformCanvasProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
  audioLevelsRef: React.RefObject<Float32Array | null>;
}

const BAR_COUNT = 24;
const BAR_GAP = 3;
const BAR_MIN_H = 3;
const DB_MIN = -90;
const DB_MAX = -10;

const WaveformCanvas = memo(function WaveformCanvas({
  analyserRef,
  audioLevelsRef,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);

      const analyser = analyserRef.current;
      const levels = audioLevelsRef.current;
      if (!analyser || !levels) return;

      analyser.getFloatFrequencyData(levels as Float32Array<ArrayBuffer>);

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width * dpr;
      const h = rect.height * dpr;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      const color = getComputedStyle(canvas).color;
      ctx.fillStyle = color;

      const totalBarWidth = (w - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;
      const barWidth = Math.max(2, totalBarWidth);

      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = Math.floor((i / BAR_COUNT) * levels.length);
        const db = levels[idx] ?? DB_MIN;
        const norm = Math.max(0, Math.min(1, (db - DB_MIN) / (DB_MAX - DB_MIN)));
        const barH = Math.max(BAR_MIN_H * dpr, norm * h * 0.85);

        const x = i * (barWidth + BAR_GAP);
        const y = (h - barH) / 2;
        const radius = Math.min(barWidth / 2, barH / 2);

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, radius);
        ctx.fill();
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [analyserRef, audioLevelsRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-6 flex-1 text-foreground/60"
      style={{ imageRendering: 'pixelated' }}
    />
  );
});

interface VoiceRecorderProps {
  duration: number;
  analyserRef: React.RefObject<AnalyserNode | null>;
  audioLevelsRef: React.RefObject<Float32Array | null>;
  isTranscribing: boolean;
  onCancel: () => void;
  onSend: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function VoiceRecorder({
  duration,
  analyserRef,
  audioLevelsRef,
  isTranscribing,
  onCancel,
  onSend,
}: VoiceRecorderProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <button
        type="button"
        onClick={onCancel}
        disabled={isTranscribing}
        aria-label="Cancel recording"
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          'text-destructive/60 transition-colors',
          'hover:bg-destructive/10 hover:text-destructive',
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <WaveformCanvas
        analyserRef={analyserRef}
        audioLevelsRef={audioLevelsRef}
      />

      <span
        className="shrink-0 text-xs text-muted-foreground"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatDuration(duration)}
      </span>

      <button
        type="button"
        onClick={onSend}
        disabled={isTranscribing}
        aria-label="Send voice message"
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          'bg-primary text-primary-foreground transition-opacity',
          'hover:opacity-90',
          'disabled:pointer-events-none disabled:opacity-60',
        )}
      >
        {isTranscribing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        )}
      </button>
    </div>
  );
}
