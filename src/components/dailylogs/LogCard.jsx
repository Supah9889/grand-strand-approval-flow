import React from 'react';
import { format, parseISO } from 'date-fns';
import { Camera, AlertCircle, Sun, Cloud, CloudRain, Wind, Thermometer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WEATHER_ICON = {
  sunny: Sun, cloudy: Cloud, rain: CloudRain, storm: CloudRain,
  windy: Wind, cold: Thermometer, hot: Thermometer, humid: Thermometer,
};

const WEATHER_COLOR = {
  sunny: 'text-yellow-500', cloudy: 'text-slate-400', rain: 'text-blue-500',
  storm: 'text-purple-600', windy: 'text-cyan-500', cold: 'text-blue-400',
  hot: 'text-orange-500', humid: 'text-teal-500', other: 'text-muted-foreground',
};

export default function LogCard({ log, onClick }) {
  const navigate = useNavigate();
  const photos = (() => { try { return JSON.parse(log.photos || '[]'); } catch { return []; } })();
  const WeatherIcon = WEATHER_ICON[log.weather];

  return (
    <button onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-xs font-mono text-muted-foreground">
              {log.log_date ? format(parseISO(log.log_date), 'EEE, MMM d, yyyy') : ''}
            </p>
            {WeatherIcon && <WeatherIcon className={`w-3.5 h-3.5 ${WEATHER_COLOR[log.weather]}`} />}
          </div>
          <p className="text-sm font-semibold text-foreground truncate">{log.job_address || log.job_title || 'Unknown Job'}</p>
          {log.crew_present && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">Crew: {log.crew_present}</p>
          )}
          {log.work_completed && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.work_completed}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {photos.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Camera className="w-3.5 h-3.5" /> {photos.length}
            </span>
          )}
          {log.follow_up_needed && (
            <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
              <AlertCircle className="w-3 h-3" /> Follow-up
            </span>
          )}
        </div>
      </div>
    </button>
  );
}