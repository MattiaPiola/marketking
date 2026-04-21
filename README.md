# MarketKing

MarketKing is a simple, interactive multiplayer economics game for high school students.
Players manage small brands and compete for market share over multiple rounds by choosing:

- Price
- Product quality
- Marketing spend

Each round uses a clear classical-economics style model:

- Lower prices generally increase demand
- Better quality and stronger marketing increase attractiveness
- Profit depends on revenue, production cost, and marketing cost

## Run

Open `/home/runner/work/marketking/marketking/index.html` in a browser.

## Netlify hosting and external services

This current implementation is fully client-side and works on Netlify with **no external services**.
So for the current game mode, you do **not** need Pusher, Supabase, or a backend.

You would only need external services if you want true online multiplayer (different students on different devices in the same live match), persistent rooms, or authentication:

- **Supabase**: good if you want database + auth + realtime state sync.
- **Pusher**: good for realtime messaging/events, but usually still paired with backend logic.
- **Other option**: Netlify Functions + a database for authoritative game state.
