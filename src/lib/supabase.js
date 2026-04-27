import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when the required env vars are absent.
 * App.jsx checks this flag and renders a config-error screen instead of the
 * normal router, so the app never mounts with a missing/null client.
 */
export const supabaseMisconfigured = !supabaseUrl || !supabaseAnonKey

export const supabase = supabaseMisconfigured
  ? null
  : createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

/**
 * Subscribe to all changes in a room.
 * Returns an unsubscribe function.
 */
export function subscribeToRoom(roomId, callback) {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `room_id=eq.${roomId}` }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'decisions', filter: `room_id=eq.${roomId}` }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'results', filter: `room_id=eq.${roomId}` }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shocks', filter: `room_id=eq.${roomId}` }, callback)
    .subscribe()

  return () => supabase.removeChannel(channel)
}

/**
 * Subscribe to a broadcast channel for turn events (admin → all players).
 * Returns an unsubscribe function.
 */
export function subscribeToBroadcast(roomId, eventName, callback) {
  const channel = supabase
    .channel(`broadcast:${roomId}`)
    .on('broadcast', { event: eventName }, ({ payload }) => callback(payload))
    .subscribe()

  return () => supabase.removeChannel(channel)
}
