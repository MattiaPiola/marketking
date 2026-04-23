import { useState, useEffect } from 'react'
import { supabase, subscribeToRoom } from '../lib/supabase'

function fetchRoomData(roomId) {
  return Promise.all([
    supabase.from('rooms').select('*').eq('room_id', roomId).single(),
    supabase.from('players').select('*').eq('room_id', roomId).order('joined_at'),
  ])
}

/**
 * Loads room + players data for a given roomId and keeps them in sync
 * via Supabase Realtime.
 */
export function useRoom(roomId) {
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!roomId) return

    fetchRoomData(roomId).then(([roomRes, playersRes]) => {
      if (roomRes.error) {
        setError(roomRes.error)
        setLoading(false)
        return
      }
      setRoom(roomRes.data)
      setPlayers(playersRes.data ?? [])
      setError(null)
      setLoading(false)
    })

    const unsubscribe = subscribeToRoom(roomId, () => {
      fetchRoomData(roomId).then(([roomRes, playersRes]) => {
        if (roomRes.error) return
        setRoom(roomRes.data)
        setPlayers(playersRes.data ?? [])
      })
    })

    return unsubscribe
  }, [roomId])

  return { room, players, loading, error }
}

