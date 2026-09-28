"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { ActivityEventRow } from "@/types/database";

export type RadarConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface UseLiveStackRadarOptions {
  limit?: number;
  soundEnabled?: boolean;
}

export interface UseLiveStackRadarResult {
  events: ActivityEventRow[];
  unreadCount: number;
  urgentCount: number;
  actionableCount: number;
  status: RadarConnectionStatus;
  lastSeenTimestamp: string | null;
  refresh: () => Promise<void>;
  markAsRead: (eventId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const MAX_RING_BUFFER_SIZE = 100;

/**
 * Resilient Client-Side Hook for Prism V2 Live Stack Radar.
 *
 * 1. Establishes Supabase Realtime subscription on public.activity_events.
 * 2. High-Watermark Catchup: Backfills missed events on WebSocket reconnect,
 *    tab focus (visibilitychange), and network recovery (online).
 * 3. Bounded in-memory ring buffer (max 100 items) to prevent memory leaks in
 *    long-running cockpit sessions.
 * 4. Multi-tab synchronization via Realtime UPDATE events.
 * 5. Optimistic local state updates for instant latency-free interactions.
 */
export function useLiveStackRadar(
  options: UseLiveStackRadarOptions = {}
): UseLiveStackRadarResult {
  const { limit = 50, soundEnabled = false } = options;

  const [events, setEvents] = useState<ActivityEventRow[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [status, setStatus] = useState<RadarConnectionStatus>("connecting");
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string | null>(null);

  const lastSeenRef = useRef<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const hasSubscribedRef = useRef<boolean>(false);

  // Play subtle audio alert for high priority alerts
  const playAlertSound = useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const audioCtx = new (window.AudioContext ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    } catch {
      // AudioContext disallowed before user gesture or unavailable
    }
  }, [soundEnabled]);

  // Merge helper: deduplicates by ID, sorts descending, bounds to MAX_RING_BUFFER_SIZE
  const mergeEvents = useCallback(
    (existing: ActivityEventRow[], incoming: ActivityEventRow[]) => {
      const map = new Map<string, ActivityEventRow>();
      // Older items first
      for (const item of existing) {
        map.set(item.id, item);
      }
      // Incoming overrides/adds
      for (const item of incoming) {
        map.set(item.id, item);
      }

      const merged = Array.from(map.values()).sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return merged.slice(0, MAX_RING_BUFFER_SIZE);
    },
    []
  );

  // Fetch initial telemetry events
  const fetchInitial = useCallback(async () => {
    try {
      setStatus("connecting");
      const res = await fetch(`/api/telemetry/events?limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const initialEvents: ActivityEventRow[] = data.events || [];

      setEvents(initialEvents);
      setUnreadCount(data.unreadCount ?? 0);
      setStatus("connected");

      if (initialEvents.length > 0) {
        const topTimestamp = initialEvents[0].created_at;
        lastSeenRef.current = topTimestamp;
        setLastSeenTimestamp(topTimestamp);
      }
    } catch (err) {
      console.warn("[Prism Radar] Initial fetch error:", err);
      setStatus("error");
    }
  }, [limit]);

  // High-watermark catchup: fetches delta of events newer than lastSeenRef
  const fetchCatchup = useCallback(async () => {
    if (!lastSeenRef.current || isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      const res = await fetch(
        `/api/telemetry/events?since=${encodeURIComponent(lastSeenRef.current)}`
      );
      if (!res.ok) return;

      const data = await res.json();
      const delta: ActivityEventRow[] = data.events || [];

      if (delta.length > 0) {
        setEvents((prev) => {
          const updated = mergeEvents(prev, delta);
          if (updated.length > 0) {
            const topTimestamp = updated[0].created_at;
            lastSeenRef.current = topTimestamp;
            setLastSeenTimestamp(topTimestamp);
          }
          return updated;
        });
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (err) {
      console.warn("[Prism Radar] Catchup error:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [mergeEvents]);

  // Realtime subscription setup
  useEffect(() => {
    let isMounted = true;

    async function loadInitialFeed() {
      try {
        const res = await fetch(`/api/telemetry/events?limit=${limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const initialEvents: ActivityEventRow[] = data.events || [];

        if (isMounted) {
          setEvents(initialEvents);
          setUnreadCount(data.unreadCount ?? 0);
          setStatus("connected");

          if (initialEvents.length > 0) {
            const topTimestamp = initialEvents[0].created_at;
            lastSeenRef.current = topTimestamp;
            setLastSeenTimestamp(topTimestamp);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn("[Prism Radar] Initial fetch error:", err);
          setStatus("error");
        }
      }
    }

    void loadInitialFeed();

    const supabase = createClient();
    const channelName = `prism-radar-${Math.random().toString(36).slice(2, 9)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_events",
        },
        (payload) => {
          const newRow = payload.new as ActivityEventRow;

          setEvents((prev) => {
            const updated = mergeEvents(prev, [newRow]);
            if (
              !lastSeenRef.current ||
              new Date(newRow.created_at) > new Date(lastSeenRef.current)
            ) {
              lastSeenRef.current = newRow.created_at;
              setLastSeenTimestamp(newRow.created_at);
            }
            return updated;
          });

          setUnreadCount((c) => (newRow.is_read ? c : c + 1));

          if (newRow.priority === "critical" || newRow.priority === "urgent") {
            playAlertSound();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "activity_events",
        },
        (payload) => {
          const updatedRow = payload.new as ActivityEventRow;

          setEvents((prev) =>
            prev.map((item) => (item.id === updatedRow.id ? updatedRow : item))
          );

          // Recompute local unread tally if status toggled
          setEvents((current) => {
            const count = current.filter((e) => !e.is_read).length;
            setUnreadCount(count);
            return current;
          });
        }
      )
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === "SUBSCRIBED") {
          setStatus("connected");
          if (hasSubscribedRef.current) {
            // Reconnected after drop — run high-watermark catchup immediately
            void fetchCatchup();
          }
          hasSubscribedRef.current = true;
        } else if (
          subscribeStatus === "CLOSED" ||
          subscribeStatus === "CHANNEL_ERROR"
        ) {
          setStatus("reconnecting");
        }
      });

    // Catchup triggers: tab focus & online transition
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchCatchup();
      }
    };

    const handleOnline = () => {
      setStatus("connecting");
      void fetchCatchup();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      void supabase.removeChannel(channel);
    };
  }, [fetchCatchup, limit, mergeEvents, playAlertSound]);

  // Optimistic Mark as Read
  const markAsRead = useCallback(async (eventId: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, is_read: true } : e))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await fetch("/api/telemetry/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: [eventId], isRead: true }),
      });
    } catch (err) {
      console.warn("[Prism Radar] Failed to sync read status:", err);
    }
  }, []);

  // Optimistic Mark All as Read
  const markAllAsRead = useCallback(async () => {
    setEvents((prev) => prev.map((e) => ({ ...e, is_read: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/telemetry/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
    } catch (err) {
      console.warn("[Prism Radar] Failed to mark all as read:", err);
    }
  }, []);

  const urgentCount = events.filter(
    (e) => !e.is_read && (e.priority === "urgent" || e.priority === "critical")
  ).length;

  const actionableCount = events.filter((e) => !e.is_read && e.actionable).length;

  return {
    events,
    unreadCount,
    urgentCount,
    actionableCount,
    status,
    lastSeenTimestamp,
    refresh: fetchInitial,
    markAsRead,
    markAllAsRead,
  };
}
