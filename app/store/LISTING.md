# Cash Diamond Baseball: store listing kit

Publisher: BIRCO, Inc. App id (both stores): `com.birco.cashdiamond`. Version 1.0.0.

## Names

| Field | Text |
|---|---|
| App name (Play, 30 max) | Cash Diamond Baseball |
| App name (Apple, 30 max) | Cash Diamond Baseball |
| Apple subtitle (30 max) | Hit, earn cash, upgrade bats |
| Name under the icon | Cash Diamond |
| Category | Games > Sports |
| Apple keywords (100 max) | baseball,homerun,derby,pitch,batting,slugger,sandlot,cartoon,kids,arcade,swing,league |

## Short description (Play, 80 max)

Cartoon baseball where every hit earns cash. Upgrade your bat and go pro!

## Full description (Play and Apple)

Step up to the plate in Cash Diamond, a bright cartoon baseball game that plays great on a phone.

EVERY HIT PAYS
Singles, doubles and home runs earn in-game cash. Strikeouts cost you. Spend your winnings in the Pro Shop on bats, gloves, pitches, arms and wild ball effects that get bigger and crazier as you go.

SEVEN LEAGUES, SEVEN BALLPARKS
Start in the sandlot and climb through Little League, High School, College, the Minors and the Big Leagues, all the way to the World Series.

THREE WAYS TO PLAY
- Play Ball: 3-inning games against the computer. You bat, pitch and field.
- HR Derby: knock balloons out of the park, then try the endless Legend levels.
- Pitch Challenge: knock down cans, castles, ghosts, UFOs and asteroids with your arm.

PLAY A FRIEND
Online Vs lets you play a family member or friend with a private game code. One phone pitches, the other bats. No chat, no strangers.

EASY TO PICK UP
Hold to wind up, slide to aim, let go to swing.

FREE TO START
The first three leagues, Derby levels and Pitch stages are free. The Full Game is one $3.99 purchase that unlocks everything. No subscription. Purchases sit behind a grown-up check.

The cash in Cash Diamond is pretend game money. It can't be bought, cashed out or traded, and there's no gambling.

## In-app product (set up in both stores)

| Field | Value |
|---|---|
| Product id | `cashdiamond_full_game` (must match exactly) |
| Type | Play: one-time product, non-consumable. Apple: Non-Consumable |
| Name | Full Game |
| Description | Unlock every league, Derby level and Pitch Challenge stage. |
| Price | $3.99 USD (Apple tier $3.99) |

## Art (in `app/store/`)

| Store slot | File |
|---|---|
| Play app icon 512 | `play-icon-512.png` |
| Play feature graphic 1024x500 | `play-feature-graphic-1024x500.png` |
| Play phone screenshots | `screenshots/play-phone-1080x1920/` (5) |
| Apple app icon 1024 | already inside the iOS project (`app-store-icon-1024.png` is a copy) |
| Apple iPhone 6.9" screenshots | `screenshots/iphone-6.9in-1320x2868/` (5) |
| Apple iPad 13" screenshots | `screenshots/ipad-13in-2064x2752/` (5) |

## Kids, privacy and content answers

What the app does with data (true for v1.0.0):
- No accounts, no ads, no analytics, no tracking, no ad ID.
- Progress is saved on the phone only.
- Online Vs sends a player nickname and moves to BIRCO's game server for the match only. Nothing is stored after the room closes (3 hours max). No chat.
- Purchases are handled by Apple / Google. BIRCO never sees card details.

| Question | Answer |
|---|---|
| Apple age rating | 4+ (no violence, gambling, or user content). Answer "No" to simulated gambling: game cash is not wagered. |
| Apple Kids Category | Don't opt in for v1. It bans most ad SDKs, which would block AdMob later. The game still gets 4+. |
| Apple privacy label | "Data Not Collected" |
| Play target age groups | 9-12 and 13+ (recommended). Choosing under 13 turns on the Families policy, which we already meet (no ads, no data). Later AdMob must use child-directed settings. |
| Play content rating (IARC) | Expect Everyone / PEGI 3. No violence, no gambling, no user chat, has in-app purchase, has online play with friends by code. |
| Play data safety | No data collected or shared. Data encrypted in transit: yes. |
| Play "contains ads" | No (v1) |
| Privacy policy URL | Required by both. Page is `privacy.html` in the repo; it goes live at https://edgarbirlew-source.github.io/cash-diamond/privacy.html |

## Name check (2026-10-24)

| Where | Result |
|---|---|
| Apple App Store | No app named "Cash Diamond". Nearby names are casino or reward apps (Diamond Cash Slots, Cash Frenzy). |
| Google Play | No app named "Cash Diamond". Same crowd of "cash / diamonds" reward apps. |
| Trademark (US) | No "Cash Diamond" mark found in a web search. Do a free knockout search at tmsearch.uspto.gov before filing. Filing is about $350 per class (Class 9 games software, Class 41 online games). |
| Domains | cashdiamond.com is taken. Free: cashdiamond.app, cashdiamondgame.com, cashdiamondbaseball.com, playcashdiamond.com, cashdiamond.games |

Why "Cash Diamond Baseball" as the store name: "cash" plus "diamond" mostly turns up slots and pay-to-earn apps, so the word Baseball keeps reviewers and parents from mistaking it for one, and it helps search.
