import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAudioPreview } from "@/lib/audio-preview";

interface AudioPlayerState {
  isOpen: boolean;
  isPlaying: boolean;
  trackName: string;
  artistName: string;
  previewUrl: string | null;
  artworkUrl: string | null;
  duration: number;
  currentTime: number;
}

let globalSetState: ((state: Partial<AudioPlayerState>) => void) | null = null;
let globalGetState: (() => AudioPlayerState) | null = null;

export function playTrack(artist: string, track: string) {
  if (globalSetState && globalGetState) {
    const current = globalGetState();
    if (current.trackName === track && current.artistName === artist) {
      globalSetState({ isPlaying: !current.isPlaying });
    } else {
      globalSetState({ isOpen: true, isPlaying: true, trackName: track, artistName: artist, currentTime: 0, duration: 0, previewUrl: null, artworkUrl: null });
    }
  }
}

export function AudioPlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerBarRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<AudioPlayerState>({
    isOpen: false,
    isPlaying: false,
    trackName: "",
    artistName: "",
    previewUrl: null,
    artworkUrl: null,
    duration: 0,
    currentTime: 0,
  });

  useEffect(() => {
    globalSetState = (partial) => setState((prev) => ({ ...prev, ...partial }));
    globalGetState = () => state;
    return () => { globalSetState = null; globalGetState = null; };
  });

  useEffect(() => {
    const root = document.documentElement;
    if (!state.isOpen) {
      root.style.setProperty("--audio-player-offset", "0px");
      return;
    }

    // Set a safe mobile fallback immediately so fixed controls never render
    // behind the player before ResizeObserver measures the final bar height.
    root.style.setProperty("--audio-player-offset", "112px");

    const updateOffset = () => {
      const height = playerBarRef.current?.getBoundingClientRect().height ?? 0;
      root.style.setProperty("--audio-player-offset", `${Math.max(112, Math.ceil(height))}px`);
    };

    requestAnimationFrame(updateOffset);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateOffset) : null;
    if (playerBarRef.current) observer?.observe(playerBarRef.current);
    window.addEventListener("resize", updateOffset);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateOffset);
      root.style.setProperty("--audio-player-offset", "0px");
    };
  }, [state.isOpen]);

  const { data: preview } = useQuery({
    queryKey: ["audio-preview", state.artistName, state.trackName],
    queryFn: () => getAudioPreview({ data: { artist: state.artistName, track: state.trackName } }),
    enabled: state.isOpen && !!state.trackName && !state.previewUrl,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });

  useEffect(() => {
    if (preview?.previewUrl && audioRef.current) {
      setState((prev) => ({ ...prev, previewUrl: preview.previewUrl, artworkUrl: preview.artworkUrl, duration: preview.duration ?? 30 }));
      audioRef.current.src = preview.previewUrl;
      audioRef.current.play().catch(() => {});
    }
  }, [preview]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state.isPlaying && state.previewUrl) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [state.isPlaying, state.previewUrl]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setState((prev) => ({ ...prev, currentTime: audioRef.current!.currentTime }));
    }
  }, []);

  const handleEnded = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, []);

  const close = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setState({ isOpen: false, isPlaying: false, trackName: "", artistName: "", previewUrl: null, artworkUrl: null, duration: 0, currentTime: 0 });
  };

  if (!state.isOpen) return null;

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <>
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} preload="none" />
      <div ref={playerBarRef} className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--card)] border-t border-[var(--border)]" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="px-4 py-3 flex items-center gap-3 max-w-7xl mx-auto">
          {state.artworkUrl ? (
            <img
              src={state.artworkUrl}
              alt=""
              className="w-12 h-12 rounded object-cover flex-shrink-0"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
              <i className="fas fa-music text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold truncate">{state.trackName}</div>
            <div className="text-xs text-muted-foreground truncate">{state.artistName}</div>
            <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${progress}%`, transition: "width 0.1s linear" }} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              {!state.previewUrl && state.isOpen ? "No preview" : `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`}
            </span>
            <button
              onClick={() => setState((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))}
              disabled={!state.previewUrl}
              className="w-10 h-10 rounded-full bg-[var(--accent)] text-black flex items-center justify-center hover:brightness-95 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-default"
            >
              <i className={`fas ${state.isPlaying ? "fa-pause" : "fa-play"} ${!state.isPlaying ? "ml-0.5" : ""}`} />
            </button>
            <button onClick={close} className="w-8 h-8 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center cursor-pointer">
              <i className="fas fa-times" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
