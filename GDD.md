# MERCATO VIVO – Game Design Document (Essenziale)

## OVERVIEW

Gioco educativo di economia multiplayer online. Studenti (o giocatori singoli) gestiscono azienda di abbigliamento in competizione diretta. Dinamiche di mercato emergono organicamente dalle scelte dei giocatori. Un insegnante/admin controlla tutto da pannello centralizzato: timer, shock, parametri, insights.

**Durata:** 6 turni (customizzabile). 35-45 minuti tipici.  
**Giocatori:** 1-8 per partita.  
**Stack:** Netlify (frontend) + Supabase (database real-time + auth).

---

## SETUP INIZIALE (Admin)

**Admin crea stanza con:**
- Nome stanza
- Numero turni (default 6)
- Budget iniziale (default €5.000)
- Catalogo massimo per giocatore (default 3 prodotti)
- **Livello complessità meccanico** (modificabile durante partita)

**Tre livelli di complessità:**

**LIVELLO 1: Elasticità Pura**
- Input: Prezzo, Qualità, Marketing
- Meccaniche: Elasticità della domanda (varia per qualità), segmentazione cliente
- Output: Domanda → Profitto
- Uso: Prima volta, focus su elasticità pura

**LIVELLO 2: Equilibrio Naturale [DEFAULT]**
- Input: Prezzo, Qualità, Marketing, Produzione (quantità)
- Meccaniche: Elasticità, reputazione, economie di scala, inventario leggero, catalogo espandibile
- Output: Elasticità osservata + insight economico + suggerimento tattico
- Uso: Applicazione educativa standard

**LIVELLO 3: Economia Complessa**
- Input: Tutto L2 + supply chain, promozioni tattiche (sconto, bundle, loyalty, flash sale)
- Meccaniche: Tutto L2 + pricing psychology, retention vs. acquisition, marginal utility
- Output: Feedback denso con molte interconnessioni
- Uso: Classe avanzata oppure secondo gioco

Admin può switchare tra livelli durante partita quando studenti imparano.

---

## CICLO DI TURNO

### 1. Admin Avvia Turno

**Opzioni:**
- Turno con timer (durata: 2/5/10 min oppure custom)
- Turno senza timer (admin termina manualmente)
- Pausa turno (studenti non possono modificare fino a ripresa)

Giocatori vedono numero turno e countdown (se attivo).

### 2. Giocatori Decidono (Blind)

Ogni giocatore vede SOLO il suo pannello, zero visibility su competitor fino a risultati.

**Input decisioni:**
- **Qualità** (1-10, slider)
- **Prezzo** (€5-€50, input numerico)
- **Marketing** (€0-€500, slider con rendimenti decrescenti visibili)
- **Produzione** (0-1000 pezzi, slider con feedback economia di scala)
- **Espansione catalogo** (opzionale, se budget/slot disponibili)
  - Costo: €800 (una tantum) + €50/turno
  - Scelta prodotto da lista disponibile
  - Qualità iniziale (consigliata coerente con altri prodotti)

**Live Preview Engine:**
Ogni modifica slider aggiorna istantaneamente preview:
- Domanda stimata (con formula elasticità se L2+)
- Ricavi/Costi/Profitto stimato
- Impatto economia di scala
- Impatto inventario
- Posizionamento astratto sulla mappa prezzo-qualità (niente competitor visibile)

Giocatore **conferma decisione** quando pronto. Una volta confermato, input freezati.

### 3. Admin Monitora & Commenta

**Durante turno, admin panel mostra:**
- Status turno (timer, numero giocatori confermati vs. in decisione)
- Live preview di ogni giocatore (quali decisioni sta facendo)
- Note di sistema (es: "Decisione coerente", "Salita qualità risky")
- Opzione shock da applicare (tipo, intensità, timing, visibilità)

**Admin può:**
- Leggere commenti studenti (chat integrata opzionale)
- Inviare commenti classroom al volo (guidance, zero spoiler)
- Estendere tempo (+2 min, ripetibile)
- Pausare turno

### 4. Admin Termina Turno

Quando admin clicca [TERMINA TURNO], sistema:
1. Freeza tutti gli input
2. Calcola risultati per ogni giocatore:
   - Domanda (elasticità formula + reputazione + shock se applicato)
   - Ricavi/Costi/Profitto
   - Word-of-mouth (rating → organic boost/malus)
3. Aggiorna classifica globale
4. Aggiorna mappa prezzo-qualità
5. Rivela risultati simultaneamente a tutti

### 5. Feedback Post-Turno

**Ogni giocatore riceve feedback personalizzato:**

**LIVELLO 1:**
- Domanda generata
- Ricavi/Costi/Profitto
- Posizionamento (prezzo/qualità)

**LIVELLO 2 (aggiunge):**
- Insight economico: "Elasticità Q6 = -1.0. Osservi: +10% prezzo = -10% domanda (formula verificata)"
- Reputazione crescita se qualità stabile
- Economie di scala osservate
- Suggerimento mini non direttivo (es: "Reputazione è tuo asset. Se mantieni Q6 ancora 2 turni...")
- Trend mercato (prezzo medio, qualità media, interpretazione)

**LIVELLO 3 (aggiunge):**
- Dettagli interconnessioni (supply chain impact, retention dynamics, ecc.)
- Suggerimenti strategici complessi

Tutti vedono:
- Classifica aggiornata
- Mappa prezzo-qualità (dove sono piazzati loro + competitor)
- Note generali di mercato (oligopolio emerge, nicchie si formano)

---

## ADMIN PANEL – VISTA GLOBALE

Dopo ogni turno, admin vede panorama completo:

**Classifica + statistiche:**
- Profitto cumulativo per giocatore
- Profitto per turno (trend)
- Prezzo/qualità/reputazione mediano per giocatore

**Mappa mercato:**
- Posizionamento prezzo-qualità di ogni brand
- Nicchie emergenti
- Oligopolio structure

**Analisi dinamiche:**
- Per giocatore: strategia riconosciuta (premium, budget, mainstream, ecc.), vulnerabilità, momentum
- Avvertimenti sistema (es: "GIALLI in crisi, profitto -50% vs turno 1")
- Opportunità (es: "ROSSI sta salendo, competitor war imminente con BLU")

**Statistiche dettagliate:**
- Domanda per giocatore per turno
- Margine medio
- Volume totale
- Reputazione growth
- Inventory status

**Capacità ritocco in tempo reale:**
- Modifica elasticità, costi base, economie di scala, reputazione parameters, marketing rendimenti
- Applica shock (tipo, intensità, targeting, durata, visibilità)
- Limita catalogo se necessario

---

## SHOCK ESOGENI (Opzionali, Admin-Controllati)

Admin può applicare shock quando decide. Shock cambiano le dinamiche di mercato organicamente.

**Tipi di shock:**
- **Stagionali:** Summer demand +40%, Winter demand +30% felpe, ecc.
- **Trend Shift:** "Vintage cool" boost Q1-3, hurts Q9-10; "Luxury status" inverso
- **Competitor:** Nuovo player entra in nicchia specifica, oppure competitor fallisce
- **Economic:** Recession (demand -20%, behavior shift), Boom (demand +25%)
- **Supply Chain:** Shortage (costi +20%), Efficiency (inventario -50%)
- **Viral:** Random brand gets +50% awareness, +20% domanda per 1-2 turni

**Parametri shock:**
- **Intensità:** Leggero (-/+10%), Moderato (-/+20-30%), Forte (-/+50%)
- **Targeting:** Globale (tutti), Segmentale (es: solo Q1-3), Selettivo (es: solo VERDI)
- **Durata:** One-shot (1 turno), Persistent (2-3 turni), Gradual (decay)
- **Visibilità:** Pubblico (annuncia turno prima), Silenzioso (vedi solo nei numeri)

Admin seleziona questi parametri da UI, vede preview di impatto, applica.

**Meccanica:** Shock NON sono randomici, sono decisioni dell'admin. Insegna volatilità quando insegnante sceglie di insegnarla.

---

## PARAMETRI GIOCO (Modificabili Tra Turni)

Admin può ritoccare al volo:

- **Elasticità per qualità** (Q1-3, Q4-6, Q7-9, Q10): sliders
- **Costi base per qualità:** inputs
- **Economie di scala:** fattori moltiplicativi (×0.95, ×0.90, ecc.)
- **Reputazione:** crescita per turno, cap, sovrapprezzo, perdita cambio qualità
- **Inventario:** costo magazzinaggio, cap (se limitato)
- **Marketing:** coefficienti rendimenti decrescenti (€0-100, €101-300, ecc.)
- **Catalogo:** costo lancio, costo gestione, max prodotti, dilution, sinergia per qualità coerente

Cambio parametri avviene tra turni (non durante turno attivo).

---

## REPUTAZIONE

**Meccanica:**
- Giocatore mantiene stessa qualità per X turni → reputazione sale (+15% ogni turno, cap 95%)
- Reputazione permette **sovrapprezzo percepito:** Prezzo × (1 + Reputazione × 0.15)
  - Es: €20 con reputazione 50% → €20 × 1.075 = €21.50 percepito
- Cambio qualità improvviso → reputazione reset a 0%, clienti fedeli se ne vanno (-20% domanda turno dopo)

**Interpretazione economica:** Brand loyalty, costo di un pivot strategico, protezione da price wars.

---

## INVENTARIO & ECONOMIE DI SCALA

**Inventario:**
- Giocatore produce X pezzi, vende based on domanda
- Pezzi invenduti costano €0.50/pezzo/turno (magazzinaggio)
- Se inventario > 200 pezzi, sconto clienti -5% prezzo
- Insegna rischio di over-production

**Economie di scala:**
- Costo base per pezzo varia con qualità (es: Q6 = €10)
- Produzione volumi varia il costo:
  - 0-50 pz: Costo standard × 1.0
  - 51-150 pz: × 0.95
  - 151-300 pz: × 0.90
  - 300+ pz: × 0.85
- Insegna che "volume ha senso se domanda lo supporta"

---

## CATALOGO ESPANDIBILE

**Meccanica:**
- Turni 1-2: 1 prodotto (scelta: T-shirt, Felpa, Jeans, Sneaker)
- Turno 3+: Opzione di aggiungere 1 prodotto ogni 2 turni (max customizzabile)
- Costo lancio: €800, costo gestione: €50/turno

**Sinergia/Dilution:**
- Aggiungere prodotto attrae nuovi clienti ma divide risorse (dilution -3-5%)
- Se qualità coerente tra prodotti, sinergia positiva (+8%)
- Se qualità incoerente, dilution più forte (-10%)
- Cliente combo (compra 2+ prodotti) rappresenta bundle naturale

**Strategia:** Studenti scelgono quando diversificare vs. quando rimanere focalizzati.

---

## ELASTICITÀ DELLA DOMANDA (Core Meccanica)

**Formula:** ΔQuantità% = ΔPrezzo% × Elasticità

**Varia con qualità:**
- **Q1-3 (Budget):** Elasticità -1.8 (molto elastica)
  - +10% prezzo → -18% domanda
  - Clientela: 90% price-hunters
- **Q4-6 (Standard):** Elasticità -1.0 (unitaria)
  - +10% prezzo → -10% domanda
  - Clientela: 70% value-seekers, 20% price-hunters
- **Q7-9 (Premium):** Elasticità -0.4 (anelastica)
  - +10% prezzo → -4% domanda
  - Clientela: 60% quality-focused, 30% trendsetters
- **Q10 (Esclusivo):** Elasticità -0.2 (molto anelastica)
  - +10% prezzo → -2% domanda
  - Clientela: 80% quality-focused, 20% trendsetters

**Segmentazione cliente (base di mercato ~800 consumatori):**
- 25% price-hunters (massima elasticità)
- 45% value-seekers (media elasticità)
- 20% quality-focused (bassa elasticità)
- 10% trendsetters (fedeltà brand/reputazione)

**Interpretazione pedagogica:** Elasticità non è universale, varia con qualità. Vedono empiricamente che prezzo basso = elastico, prezzo alto = anelastico.

---

## MARKETING

**Rendimenti decrescenti:**
- €0-100 spesi: +0.5% consapevolezza per €
- €101-300: +0.3% consapevolezza per €
- €301-600: +0.15% consapevolezza per €
- 600+: +0.05% consapevolezza per €

**Consapevolezza:** Probabilità che un cliente veda il tuo brand. Attrae clienti nuovi.

**Lezione:** Non tutte le risorse sono uguali. Prima €1 di marketing vale più dell'ultima €1. Distribuzione razionale importantissima.

---

## METRICHE DI RISULTATO PER TURNO

**Calcolate automaticamente dal sistema:**

- **Domanda generata:** elasticità formula × reputazione multiplicatore × shock se presente
- **Ricavi:** Domanda × Prezzo
- **Costi produzione:** (Domanda o produzione se meno) × costo base qualità × economia scala
- **Costi inventario:** (Produzione - Domanda) × €0.50
- **Costi marketing:** importo speso
- **Profitto netto:** Ricavi - Costi
- **Profitto cumulativo:** somma turni precedenti + profitto turno attuale
- **Reputazione:** +15% se qualità stabile, reset se cambio, cap 95%
- **Word-of-mouth:** Rating (Q/2 + coerenza bonus) genera boost/malus demand organica (+/-5%)
- **Posizionamento:** Prezzo/qualità/reputazione per mappa

---

## DINAMICHE EMERGENTI

**Giocatori NON coordinano.** Cosa emerge organicamente:

- **Oligopolio naturale:** Mercato auto-segmenta in 2-4 nicchie diverse (budget, mainstream, premium, ultra-premium), nessuno coordinamento
- **Nicchie stabili:** Ciascun brand trova posizione e rimane coerente per sopravvivere
- **Price wars:** Brand nella stessa nicchia competono su prezzo (elasticità effetto)
- **Brand loyalty:** Reputazione protegge da price wars
- **Posizionamento stabile** è più redditizio che pivot frequenti
- **Volatilità shocks:** Oligopolio rimane stabile finché shock esogeni lo destabilizzano

---

## GAMEPLAY SETUP (PER INSEGNANTE)

L'agente NON deve pre-configurare nulla su come l'insegnante usa il gioco. Ma il gioco deve supportare:

**Setup possibili:**
- Classe divisa in squadre blind-play, insegnante commenta live su main screen
- Giocatori singoli online asincroni, insegnante avvia turni quando pronto
- Multiplayer sincro online (timer), insegnante monitora da admin panel
- Ibrido: alcuni giocatori in lab, altri da casa (tutti sulla stessa stanza)

L'app non prescrive layout fisico, solo supporta la meccanica online.

---

## PERSISTENZA & EXPORT

**Sistema salva:**
- Tutte le decisioni turno per turno
- Domanda/ricavi/costi per giocatore per turno
- Shock applicati e parametri usati
- Classifica aggiornata ogni turno
- Stato reputazione/inventario per giocatore

**Admin può:**
- Rivedere replay turno per turno (evolution mercato)
- Esportare CSV con tutte le statistiche
- Condividere risultati post-partita

---

## PUNTI DI INSEGNAMENTO

Il gioco insegna empiricamente (non teoria astratta):

1. **Elasticità della domanda varia con qualità** (non è universale)
2. **Segmentazione di mercato emerge naturalmente** da scelte di prezzo/qualità diverse
3. **Reputazione è asset proteggente** che cresce lentamente e degrada velocemente
4. **Economie di scala:** più vendi = costo unitario cala (ma servono volumi)
5. **Oligopolio emerge senza coordinamento** (mano invisibile)
6. **Trade-off margine vs. volume:** profitto non è solo ricavi
7. **Scarsità di risorse:** ogni scelta ha costo opportunità (budget limitato)
8. **Volatilità esogena:** shocks insegnano che equilibrio non è stabile
9. **Profitto ≠ ricavi:** efficienza importa più di volume totale
10. **Inventario è rischio:** over-produce = danno

---

## STACK TECNICO

**Frontend:**
- React (Vite)
- Hosted su Netlify
- Real-time UI updates via Supabase WebSockets

**Backend:**
- Supabase (PostgreSQL + Realtime + Auth)
- Funzioni di calcolo domanda/profitto via Edge Functions (serverless)
- Zero backend custom da gestire

**Database schema (essenziale):**
- Rooms (room_id, admin_id, status, current_turn, num_turns, budget_initial, complexity_level, catalog_max)
- Players (player_id, room_id, nickname, color/team, budget_current, status)
- Decisions (decision_id, player_id, turn, quality, price, marketing, production, products[])
- Results (result_id, player_id, turn, demand_generated, revenues, costs, profit, cumulative_profit, reputation, position_data)
- Shocks (shock_id, room_id, turn, type, intensity, targeting, duration, visibility, parameters)
- Parameters (param_id, room_id, complexity_level, elasticity_by_quality[], costs_by_quality[], scales[], etc.)

**Auth:**
- Email/password oppure anonymous per studenti (admin can manage)

**Realtime:**
- Supabase Realtime per sync turno (quando admin termina, tutti vedono risultati)
- WebSocket per live preview durante turno

---

## FEATURE CORE (MVP)

**Essenziale per MVP:**
- Room creation/join (admin + players)
- Turno decisione (slider input + live preview)
- Turno risultati (calcolo domanda, profitto, ranking)
- Admin panel (monitor, timer, shock, parametri)
- Feedback post-turno (tre livelli di complessità)

**Nice-to-have (post-MVP):**
- Chat integrata
- Replay turno per turno
- Export CSV
- Promozioni tattiche (L3)
- Voice/video chat integration

---

## VINCOLI

- Budget minimo: €0, massimo: €10.000 (cap prudenziale)
- Prezzo minimo: €5, massimo: €50
- Qualità: 1-10
- Produzione: 0-1000 pezzi
- Giocatori: 1-8 per partita (scalabile oltre)
- Turni: 2-10 (default 6)
- Calcoli: Tutti deterministici, zero RNG su domanda base (shock only)

---

## ONBOARDING

**Admin:**
1. Crea stanza (nome, # turni, budget, catalogo_max, complexity_level)
2. Condividi link con studenti
3. Aspetta giocatori, clicca "Start"

**Giocatore:**
1. Accede link
2. Immette nickname
3. Sceglie colore/team (opzionale)
4. Aspetta admin inizio
5. Turni 1-6: decide, vede feedback, prosegue

**Insegnante durante turno:**
1. Monitora panel
2. Commenta in classroom se vuole
3. Applica shock se vuole
4. Clicca "Termina turno" quando pronto

---

## NOTA FINALE

Non c'è "story" narrativa. È pura economia emergente. Meccaniche sono trasparenti, calcoli sempre visibili, feedback educativo (non manipolativo). Il gioco insegna osservando numeri veri, non ripetendo lezioni.
