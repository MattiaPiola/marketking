import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_DECISION = { quality: 5, price: 20, marketing: 0, production: 100, products: [] }

/**
 * Manages the decision state for the current player in the current turn.
 *
 * @param {object} opts
 * @param {string} opts.roomId
 * @param {string} opts.playerId
 * @param {number} opts.currentTurn
 * @param {number} opts.complexityLevel – 1 | 2 | 3
 */
export function useDecision({ roomId, playerId, currentTurn, complexityLevel }) {
  const [decision, setDecision] = useState(DEFAULT_DECISION)
  const [params, setParams] = useState(null)
  const [prevResult, setPrevResult] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const hasLoaded = useRef(false)

  // Load params, existing decision, and previous turn result
  useEffect(() => {
    if (!roomId || !playerId || !currentTurn || !complexityLevel) return

    hasLoaded.current = false
    let cancelled = false

    Promise.all([
      supabase
        .from('parameters')
        .select('*')
        .eq('room_id', roomId)
        .eq('complexity_level', complexityLevel)
        .single(),
      supabase
        .from('decisions')
        .select('*')
        .eq('player_id', playerId)
        .eq('turn', currentTurn)
        .maybeSingle(),
      currentTurn > 1
        ? supabase
            .from('results')
            .select('*')
            .eq('player_id', playerId)
            .eq('turn', currentTurn - 1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]).then(([paramsRes, decisionRes, prevResultRes]) => {
      if (cancelled) return

      setParams(paramsRes.data ?? null)
      setPrevResult(prevResultRes.data ?? null)

      const isConfirmed = !!decisionRes.data?.confirmed_at
      if (decisionRes.data) {
        const d = decisionRes.data
        setDecision({
          quality: d.quality,
          price: Number(d.price),
          marketing: Number(d.marketing),
          production: d.production,
          products: Array.isArray(d.products) ? d.products : [],
        })
      } else {
        setDecision(DEFAULT_DECISION)
      }
      setConfirmed(isConfirmed)
      hasLoaded.current = true

      // Mark player as deciding when they open the panel (if not yet confirmed)
      if (!isConfirmed) {
        supabase
          .from('players')
          .update({ status: 'deciding' })
          .eq('player_id', playerId)
          .catch(() => {})
      }
    })

    return () => { cancelled = true }
  }, [roomId, playerId, currentTurn, complexityLevel])

  // Debounced auto-save on every change (skips when confirmed or not yet loaded)
  useEffect(() => {
    if (!hasLoaded.current || confirmed || !playerId || !roomId || !currentTurn) return

    const timer = setTimeout(async () => {
      setSaving(true)
      await supabase.from('decisions').upsert(
        {
          player_id: playerId,
          room_id: roomId,
          turn: currentTurn,
          quality: decision.quality,
          price: decision.price,
          marketing: decision.marketing,
          production: decision.production,
          products: decision.products ?? [],
        },
        { onConflict: 'player_id,turn' },
      )
      setSaving(false)
    }, 600)

    return () => clearTimeout(timer)
  }, [decision, confirmed, playerId, roomId, currentTurn])

  const setField = useCallback(
    (field, value) => {
      if (confirmed) return
      setDecision(prev => ({ ...prev, [field]: value }))
    },
    [confirmed],
  )

  /** Add a new catalog product (L2+, turn ≥ unlock_turn). */
  const addProduct = useCallback(
    (productType) => {
      if (confirmed) return
      setDecision(prev => ({
        ...prev,
        products: [
          ...(prev.products ?? []),
          { product_type: productType, quality: 5, price: 20, marketing: 0, production: 100 },
        ],
      }))
    },
    [confirmed],
  )

  /** Update a field of an extra product at the given index. */
  const setProductField = useCallback(
    (index, field, value) => {
      if (confirmed) return
      setDecision(prev => {
        const products = [...(prev.products ?? [])]
        products[index] = { ...products[index], [field]: value }
        return { ...prev, products }
      })
    },
    [confirmed],
  )

  /** Remove an extra product (only if not yet launched, i.e. not in prevResult). */
  const removeProduct = useCallback(
    (index) => {
      if (confirmed) return
      setDecision(prev => {
        const products = [...(prev.products ?? [])]
        products.splice(index, 1)
        return { ...prev, products }
      })
    },
    [confirmed],
  )

  const confirmDecision = useCallback(async () => {
    if (confirmed || saving) return
    setSaving(true)
    const now = new Date().toISOString()
    await supabase.from('decisions').upsert(
      {
        player_id: playerId,
        room_id: roomId,
        turn: currentTurn,
        quality: decision.quality,
        price: decision.price,
        marketing: decision.marketing,
        production: decision.production,
        products: decision.products ?? [],
        confirmed_at: now,
      },
      { onConflict: 'player_id,turn' },
    )
    await supabase.from('players').update({ status: 'confirmed' }).eq('player_id', playerId)
    setConfirmed(true)
    setSaving(false)
  }, [confirmed, saving, playerId, roomId, currentTurn, decision])

  return { decision, setField, addProduct, setProductField, removeProduct, params, prevResult, confirmed, saving, confirmDecision }
}
