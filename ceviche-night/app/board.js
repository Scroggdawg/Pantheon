/*
 * Ceviche Night: the board. A back-pocket second layout (route #board) for a laptop or tablet
 * propped on the counter. Rough on purpose.
 *
 *   left third    the current step, big, with the same main button as the phone guide,
 *                 plus alerts and running timers
 *   right         the clock, the dinner status, and a timeline of the whole day:
 *                 one lane per dish, solid bars for steps, light bars for timers that run by themselves,
 *                 a red "now" line, a band for each kitchen (hers faintly tinted), striped bands for the time he is out
 *
 * Contract (SPEC 6): window.CookBoard = { mount(rootEl, CookApp), unmount() }.
 * Everything is read through CookApp (plan, engine, getState, now, getFocus, getProjection, getAlerts) and
 * every change goes through CookApp.act(), so the phone guide and the board can never disagree.
 * No step id, count or text is hard-coded: only the names the spec fixes (`dinner`, the four moves, the anchors).
 *
 * Rendering: each region is an HTML string that is written only when it changed. The callback that fires
 * every second otherwise only touches countdown text and the position of the "now" line.
 * Positions on the timeline are set through the CSSOM (never style attributes).
 *
 * Taps: a bar (or a "Coming up" card) of a step that is not done focuses it through CookApp.act('focus'),
 * exactly like "Do this now" on the phone. A done bar is only looked at here (Back to now / Not done).
 * Nothing in this file uses the phone guide's data-act attributes, so its click handler never sees the board.
 *
 * Checks and screenshots: node ceviche-night/app/dev/board-shots.js
 */
(function () {
  'use strict';

  var MIN = 60000, HOUR = 3600000, DAY = 86400000;
  var COLORS = { scoop: 1, pink: 1, patron: 1, milky: 1, blanch: 1, cream: 1, elote: 1, day: 1 };
  var MOVE_LABEL = { leaveAm: "I'm leaving now", backHome: "I'm home", leavePm: "I'm on my way", arrive: "I'm here" };
  var PLACE = { 'home-am': 'Your kitchen', 'away': 'Out', 'home-pm': 'Your kitchen · pack up', 'drive': 'Driving', 'hers': 'Her kitchen' };
  var BAND = { 'home-am': 'Your kitchen', 'away': 'Out', 'home-pm': 'Pack up', 'drive': 'Drive', 'hers': 'Her kitchen' };
  var AFTER = { 'home-am': 'away', 'away': 'home-pm', 'home-pm': 'drive', 'drive': 'hers', 'hers': 'hers' };
  var SQUEEZE = { away: 40, drive: 32 };     // px. Nothing is cooked while he is out, so those stretches are drawn narrow.
  var EMPTY_PROJ = { rows: [], byStep: {}, dinnerAt: null, dinnerAnchor: NaN, lateMin: 0, spareMin: 0, warnings: [] };

  var api = { mount: mount, unmount: unmount, guardMs: 500 };     // guardMs: a second tap on the action bar inside this time is ignored

  var app = null, root = null, R = null, ix = null, ui = null, tl = null, unsub = null, failed = false;
  var pc = { state: null, at: 0, p: null };                        // only used when CookApp has no getProjection

  /* ================================================================== styles (tokens from index.html only) */

  var CSS = [
    '#board-root{background:var(--bg)}',
    '.bd,.bd *,.bd *::before,.bd *::after{box-sizing:border-box}',
    ':where(.bd) h1,:where(.bd) h2,:where(.bd) p,:where(.bd) ul,:where(.bd) li{margin:0;padding:0}',
    ':where(.bd) ul{list-style:none}',
    ':where(.bd) button{-webkit-appearance:none;appearance:none;border:0;margin:0;padding:0;background:none;font:inherit;color:inherit;text-align:inherit;cursor:pointer;touch-action:manipulation;-webkit-user-select:none;user-select:none}',
    ':where(.bd) a{color:inherit;text-decoration:none;touch-action:manipulation}',
    ':where(.bd) svg{display:block;flex:none}',
    '.bd :focus{outline:none}',
    '.bd :focus-visible{outline:3px solid var(--focus);outline-offset:2px}',
    '.bd{--bd-ok:1;--dish:var(--d-day);height:100%;min-height:0;display:grid;grid-template-columns:minmax(340px,1fr) minmax(0,2fr);background:var(--bg);color:var(--fg);font:400 21px/1.4 var(--font);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
    '.bd-c-scoop{--dish:var(--d-scoop)}.bd-c-pink{--dish:var(--d-pink)}.bd-c-patron{--dish:var(--d-patron)}.bd-c-milky{--dish:var(--d-milky)}',
    '.bd-c-blanch{--dish:var(--d-blanch)}.bd-c-cream{--dish:var(--d-cream)}.bd-c-elote{--dish:var(--d-elote)}.bd-c-day{--dish:var(--d-day)}',

    /* ---- left: the current step ---- */
    '.bd-left{position:relative;min-width:0;min-height:0;display:flex;flex-direction:column;border-right:1px solid var(--line);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:16px}',
    '.bd-nav{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:60px}',
    '.bd-link{display:inline-flex;align-items:center;gap:4px;min-height:44px;padding:6px 14px 6px 8px;border-radius:14px;background:var(--fill);font:600 17px/1.2 var(--font);white-space:nowrap}',
    '.bd-link:active{background:var(--fill-press)}',
    '.bd-place{min-width:0;font:600 17px/1.2 var(--font);color:var(--fg-2);text-align:right}',
    '.bd-alerts,.bd-timers{flex:none;display:grid;grid-template-columns:minmax(0,1fr);gap:8px;padding-bottom:10px}',
    '.bd-alert{display:flex;align-items:center;gap:12px;min-height:72px;padding:8px 8px 8px 16px;border-radius:18px;background:var(--alert);color:var(--alert-fg)}',
    '.bd-alert-t{flex:1;min-width:0;font:700 21px/1.2 var(--font);text-wrap:balance}',
    '.bd-alert-t small{display:block;font:600 17px/1.25 var(--font)}',
    '.bd-alert button{flex:none;min-width:92px;min-height:56px;padding:6px 14px;border-radius:14px;background:var(--alert-btn);color:var(--alert-btn-fg);font:700 21px/1.1 var(--font);text-align:center}',
    '.bd-alert button:active{background:var(--alert-btn-press)}',
    '.bd-alert.is-soon{min-height:56px;padding:8px 16px;background:var(--late-tint);color:var(--late-text)}',
    '.bd-alert.is-preview{min-height:64px;background:var(--preview);color:var(--preview-fg)}',
    '.bd-alert.is-preview button{background:var(--preview-btn);color:var(--preview-btn-fg)}',
    '.bd-alert.is-preview button:active{background:var(--preview-btn-press)}',
    '.bd-timer{display:flex;align-items:center;gap:10px;min-height:46px;padding:6px 14px 6px 12px;border-radius:14px;background:var(--time-tint);color:var(--time-text);font:600 18px/1.2 var(--font)}',
    '.bd-timer span{flex:1;min-width:0}',
    '.bd-timer b{flex:none;font:700 24px/1 var(--font-round);font-variant-numeric:tabular-nums}',
    '.bd-timer.is-ready{background:var(--alert-tint);color:var(--alert-text)}',
    '.bd-scrollwrap{position:relative;flex:1 1 auto;min-height:0;display:flex}',
    '.bd-scroll{flex:1;min-width:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding-block:4px 28px}',
    '.bd-more{position:absolute;left:0;right:0;bottom:0;height:64px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px;pointer-events:none;background:linear-gradient(to bottom,var(--bg-0),var(--bg) 70%)}',
    '.bd-more button{pointer-events:auto;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:6px 18px 6px 14px;border-radius:22px;background:var(--fg);color:var(--bg);font:700 17px/1 var(--font)}',
    '.bd-card{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}',
    '.bd-crumb{display:flex;flex-wrap:wrap;align-items:center;gap:2px 10px;font:600 17px/1.25 var(--font);color:var(--fg-2)}',
    '.bd-crumb b{color:var(--dish);font-weight:700}',
    '.bd-crumb i{flex-basis:100%;font-style:normal;font-weight:500}',
    '.bd-dot{flex:none;width:14px;height:14px;border-radius:50%;background:var(--dish)}',
    '.bd-title{font:700 clamp(30px,3.2vw,44px)/1.08 var(--font);letter-spacing:-0.022em;text-wrap:balance}',
    '.bd-note{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;background:var(--fill);font:600 18px/1.25 var(--font)}',
    '.bd-note>span{flex:1;min-width:0}',
    '.bd-note b{font-weight:700}',
    '.bd-note.is-time{background:var(--time-tint);color:var(--time-text)}',
    '.bd-note.is-ok{background:var(--ok-tint);color:var(--ok-text)}',
    '.bd-note button{flex:none;min-height:48px;min-width:64px;padding:6px 14px;border-radius:12px;background:var(--btn);box-shadow:inset 0 0 0 1px var(--btn-line);font:700 18px/1.1 var(--font);text-align:center}',
    '.bd-note button:active{background:var(--btn-press)}',
    '.bd-body{display:grid;grid-template-columns:minmax(0,1fr);gap:12px}',
    '.bd-body p,.bd-lead{font-size:clamp(21px,1.9vw,25px);line-height:1.36}',
    '.bd-lead b{font-weight:700}',
    '.bd-term{color:var(--link);font-weight:500;cursor:pointer;-webkit-text-decoration:underline dotted;text-decoration:underline dotted;text-decoration-thickness:2px;text-underline-offset:5px}',
    '.bd-term:active{opacity:0.55}',
    '.bd-block{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}',
    '.bd-label{font:600 17px/1.2 var(--font);color:var(--fg-2)}',
    '.bd-need{display:flex;flex-wrap:wrap;gap:8px}',
    '.bd-need li{background:var(--card);border-radius:12px;padding:8px 12px;font:500 19px/1.2 var(--font)}',
    '.bd-call{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:16px;background:var(--card)}',
    '.bd-call svg{margin-top:2px;color:var(--fg-2)}',
    '.bd-call>div{flex:1;min-width:0}',
    '.bd-call .bd-label{display:block;margin-bottom:3px}',
    '.bd-val{font-size:clamp(21px,1.8vw,24px);line-height:1.32}',
    '.bd-call.is-into svg{color:var(--dish)}',
    '.bd-call.is-into .bd-val{font-weight:700}',
    '.bd-call.is-look svg{color:var(--ok-text)}',
    '.bd-call.is-warn{background:var(--alert-tint);color:var(--alert-text)}',
    '.bd-call.is-warn svg{color:var(--alert-text)}',
    '.bd-call.is-warn .bd-val{font-weight:600}',
    '.bd-meta{display:grid;gap:3px;font:500 17px/1.35 var(--font);color:var(--fg-2)}',
    '.bd-count{font:700 clamp(56px,6vw,84px)/1 var(--font-round);font-variant-numeric:tabular-nums;letter-spacing:-0.02em;color:var(--time-text)}',
    '.bd-ticks{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}',
    '.bd-tick{display:flex;align-items:center;gap:14px;width:100%;min-height:60px;padding:10px 14px;border-radius:16px;background:var(--btn);font:500 20px/1.25 var(--font)}',
    '.bd-tick:active{background:var(--btn-press)}',
    '.bd-box{flex:none;width:32px;height:32px;border-radius:50%;border:2.5px solid var(--fg-2);color:var(--go-fg);display:flex;align-items:center;justify-content:center}',
    '.bd-box svg{opacity:0}',
    '.bd-tick-t{flex:1;min-width:0}',
    '.bd-tick-t small{display:block;font:400 17px/1.25 var(--font);color:var(--fg-2)}',
    '.bd-tick[aria-pressed="true"] .bd-box{background:var(--go);border-color:var(--go)}',
    '.bd-tick[aria-pressed="true"] .bd-box svg{opacity:1}',
    '.bd-tick[aria-pressed="true"] .bd-tick-t{color:var(--fg-2);text-decoration:line-through;text-decoration-thickness:1.5px}',
    '.bd-sub{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;padding:10px 4px 6px 14px;font-size:20px;line-height:1.36}',
    '.bd-actions{flex:none;display:grid;grid-template-columns:minmax(0,1fr);gap:12px;padding-block:12px 14px;border-top:1px solid var(--line)}',
    '.bd-rowx{display:flex;gap:12px;align-items:stretch}',
    '.bd-btn{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;gap:10px;min-height:64px;padding:8px 14px;border-radius:18px;background:var(--btn);color:var(--fg);box-shadow:inset 0 0 0 1px var(--btn-line);font:600 20px/1.15 var(--font);text-align:center}',
    '.bd-btn:active{background:var(--btn-press)}',
    '.bd-btn.is-back{flex:0 0 24%;min-width:84px}',
    '.bd-btn.is-side{flex:0 0 26%;min-width:88px;font-size:19px}',
    '.bd-btn.is-main{flex:3 1 0}',
    '.bd-btn.is-big{min-height:76px;font-size:22px;font-weight:700}',
    '.bd-btn.is-go{min-height:84px;background:var(--go);color:var(--go-fg);box-shadow:none;font-size:28px;font-weight:700;letter-spacing:-0.01em}',
    '.bd-btn.is-go:active{background:var(--go-press)}',
    '.bd-btn.is-go.is-ans{font-size:23px}',
    '.bd-lines{display:grid;gap:3px;min-width:0}',
    '.bd-btn small{display:block;font:500 17px/1.2 var(--font)}',
    '.bd-btn.is-go small{font-weight:600}',
    '.bd-timerbox{flex:3 1 0;min-width:0;min-height:84px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:var(--time-solid);color:var(--time-on);font:700 clamp(40px,4.4vw,56px)/1 var(--font-round);font-variant-numeric:tabular-nums;letter-spacing:-0.01em}',
    '.bd-gloss{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;padding-top:8px}',
    '.bd-gloss h2{font:700 32px/1.12 var(--font);letter-spacing:-0.02em;text-wrap:balance}',
    '.bd-gloss p{font-size:clamp(21px,1.9vw,25px);line-height:1.4}',

    /* ---- right: clock, dinner, timeline ---- */
    '.bd-right{min-width:0;min-height:0;display:flex;flex-direction:column;gap:10px;overflow-x:hidden;overflow-y:auto;padding-block:8px 12px;padding-left:16px;padding-right:max(16px,env(safe-area-inset-right,0px))}',
    '.bd-head{flex:none;display:flex;align-items:center;flex-wrap:wrap;gap:6px 28px;min-height:64px}',
    '.bd-clock{font:700 clamp(46px,5.2vw,70px)/1 var(--font-round);font-variant-numeric:tabular-nums;letter-spacing:-0.02em;white-space:nowrap}',
    '.bd-clock small{margin-left:6px;font-size:0.4em;font-weight:700;color:var(--fg-2)}',
    '.bd-dinner{display:grid;gap:5px;justify-items:start}',
    '.bd-dinner-t{font:700 clamp(22px,2.3vw,30px)/1.1 var(--font);font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.bd-pill{display:inline-flex;align-items:center;min-height:32px;padding:4px 14px;border-radius:16px;background:var(--ok-tint);color:var(--ok-text);font:700 18px/1.15 var(--font);font-variant-numeric:tabular-nums}',
    '.bd-pill.is-late{background:var(--late-tint);color:var(--late-text)}',
    '.bd-pill.is-plain{background:var(--fill);color:var(--fg)}',
    '.bd-prog{margin-left:auto;text-align:right;font:600 17px/1.25 var(--font);color:var(--fg-2);font-variant-numeric:tabular-nums}',
    '.bd-prog b{display:block;font:700 clamp(22px,2.3vw,30px)/1.1 var(--font-round);color:var(--fg)}',
    '.bd-warns{flex:none;display:grid;grid-template-columns:minmax(0,1fr);gap:6px}',
    '.bd-warns li{padding:7px 12px;border-radius:12px;background:var(--late-tint);color:var(--late-text);font:500 17px/1.3 var(--font)}',
    '.bd-tl{flex:1 0 auto;display:flex;flex-direction:column;min-width:0;border:1px solid var(--line);border-radius:14px;overflow:hidden}',
    '.bd-tlin{position:relative;flex:1 1 auto;display:flex;flex-direction:column;min-height:0}',
    '.bd-plot{position:relative;flex:1 1 auto;display:flex;flex-direction:column;min-height:0}',
    '.bd-band{position:absolute;top:0;bottom:0}',
    '.bd-band.is-in{background:var(--card)}',
    '.bd-band.is-hers{background:var(--card);background:color-mix(in srgb,var(--link) 7%,var(--card))}',
    '.bd-band.is-out{background-image:repeating-linear-gradient(135deg,var(--line) 0,var(--line) 2px,transparent 2px,transparent 9px)}',
    '.bd-gl{position:absolute;top:60px;bottom:0;width:1px;background:var(--line)}',
    '.bd-dl{position:absolute;top:22px;bottom:0;width:0;border-left:2px dashed var(--ok-text)}',
    '.bd-axis{position:relative;flex:none;height:62px}',
    '.bd-bl{position:absolute;top:22px;padding-left:7px;font:700 14px/18px var(--font);color:var(--fg-2);white-space:nowrap}',
    '.bd-df{position:absolute;top:22px;transform:translateX(-100%);padding-right:6px;font:700 14px/18px var(--font);color:var(--ok-text);white-space:nowrap}',
    '.bd-df.is-r{transform:none;padding:0 0 0 7px}',
    '.bd-tk{position:absolute;top:42px;transform:translateX(-50%);font:600 14px/16px var(--font-round);font-variant-numeric:tabular-nums;color:var(--fg-2);white-space:nowrap}',
    '.bd-tk.is-l{transform:none;padding-left:3px}',
    '.bd-lanes{position:relative;flex:1 1 auto;display:flex;flex-direction:column;min-height:0}',
    '.bd-lane{position:relative;flex:1 1 0;min-height:44px;display:flex;flex-direction:column;justify-content:center;gap:1px;padding-block:2px;border-top:1px solid var(--line)}',
    '.bd-lane-h{position:relative;z-index:5;flex:none;padding-left:3px;font:700 15px/16px var(--font);white-space:nowrap;pointer-events:none}',
    '.bd-lane-h>span{display:inline-block;padding:0 5px 0 4px;border-radius:4px;background:var(--card);color:var(--dish)}',
    '.bd-lane-h i{margin-left:7px;font-style:normal;font-weight:600;color:var(--fg-2);font-variant-numeric:tabular-nums}',
    '.bd-row{position:relative;flex:1 1 auto;min-height:14px;max-height:40px;cursor:pointer}',
    '.bd-wrow{position:relative;flex:0 1 14px;min-height:8px}',
    '.bd-bar{position:absolute;top:0;bottom:0;min-width:4px;border-radius:3px;background:var(--dish);border-right:1px solid var(--card)}',
    '.bd-bar.is-done{opacity:0.3}',
    '.bd-bar.is-move{background:var(--fg);border-radius:2px}',
    '.bd-bar.is-late{box-shadow:0 4px 0 0 var(--alert)}',
    '.bd-bar.is-focus{z-index:2;opacity:1;border-right:0;box-shadow:0 0 0 2px var(--card),0 0 0 5px var(--fg)}',
    '.bd-wait{position:absolute;top:0;bottom:0;min-width:3px;border-radius:4px;overflow:hidden}',
    '.bd-wait::before{content:"";position:absolute;inset:0;background:var(--dish);opacity:0.24}',
    '.bd-wait.is-live::before{opacity:0.45}',
    '.bd-wait.is-past{opacity:0.5}',
    '.bd-now{position:absolute;top:0;bottom:0;width:0;z-index:4;margin-left:-1.5px;border-left:3px solid var(--alert);pointer-events:none}',
    '.bd-now b{position:absolute;top:2px;left:1px;padding:0 7px;border-radius:6px;background:var(--alert);color:var(--alert-fg);font:700 13px/18px var(--font);white-space:nowrap}',
    '.bd-now.is-flip b{left:auto;right:4px}',
    '.bd-upwrap{flex:none;display:grid;grid-template-columns:minmax(0,1fr);gap:6px}',
    '.bd-up{display:flex;gap:10px;align-items:stretch}',
    '.bd-up-i{flex:1 1 0;min-width:0;min-height:78px;display:grid;grid-template-columns:minmax(0,1fr);align-content:start;gap:3px;padding:9px 12px;border-radius:14px;background:var(--card);text-align:left}',
    'button.bd-up-i:active{background:var(--btn-press)}',
    '.bd-up-i.is-free{background:none;box-shadow:inset 0 0 0 1px var(--line)}',
    '.bd-up-t{font:700 16px/1.15 var(--font-round);font-variant-numeric:tabular-nums;color:var(--fg-2)}',
    '.bd-up-ttl{font:600 17px/1.2 var(--font);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}',
    '.bd-up-m{display:flex;align-items:center;gap:6px;min-width:0;font:600 15px/1.2 var(--font);color:var(--fg-2)}',
    '.bd-up-m>span:last-child{min-width:0}',
    '.bd-up-m .bd-dot{width:10px;height:10px}',
    '.bd-uphead{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 16px;min-height:20px}',
    '.bd-legend{display:flex;flex-wrap:wrap;align-items:center;gap:4px 16px;margin-left:auto;font:500 15px/1.2 var(--font);color:var(--fg-2)}',
    '.bd-legend span{display:inline-flex;align-items:center;gap:6px}',
    '.bd-lg{display:block;border-radius:3px;background:var(--d-day)}',
    '.bd-lg.is-step{width:8px;height:16px}',
    '.bd-lg.is-wait{width:24px;height:9px;opacity:0.3}',
    '.bd-lg.is-done{width:8px;height:16px;opacity:0.3}',
    '@media (hover:hover){.bd-bar:hover{box-shadow:0 0 0 2px var(--fg)}.bd-btn:hover,.bd-up-i:hover{filter:brightness(0.97)}}',

    /* ---- narrow screens: one column, the page scrolls, the timeline scrolls sideways inside its own box ---- */
    '@media (max-width:859px){',
    '.bd{display:block;height:auto;min-height:100%}',
    '.bd-left{border-right:0;padding-right:max(16px,env(safe-area-inset-right,0px))}',
    '.bd-scrollwrap{display:block}',
    '.bd-scroll{overflow:visible;padding-bottom:12px}',
    '.bd-more{display:none}',
    '.bd-right{overflow:visible;padding-left:max(16px,env(safe-area-inset-left,0px))}',
    '.bd-tl{flex:none;overflow-x:auto;overflow-y:hidden}',
    '.bd-tlin{min-width:720px;min-height:500px}',
    '.bd-up{flex-wrap:wrap}',
    '.bd-up-i{flex:1 1 150px}',
    '}'
  ].join('\n');

  var adopted = false;
  function styled() {
    var p = root && root.firstElementChild;
    return !!p && String(window.getComputedStyle(p).getPropertyValue('--bd-ok')).trim() === '1';
  }
  // The styles go in as a <style> element. If the page refuses that, a constructed sheet is tried.
  // If neither took, mount() throws and the phone guide stays up: an unstyled board would be unreadable.
  function ensureStyle() {
    if (!document.getElementById('bd-style') && !adopted) {
      var s = document.createElement('style');
      s.id = 'bd-style';
      s.textContent = CSS;
      (document.head || document.documentElement).appendChild(s);
    }
    if (styled()) return true;
    if (!adopted) {
      try {
        var sheet = new window.CSSStyleSheet();
        sheet.replaceSync(CSS);
        document.adoptedStyleSheets = Array.prototype.slice.call(document.adoptedStyleSheets || []).concat([sheet]);
        adopted = true;
      } catch (e) { /* not available here */ }
    }
    return styled();
  }

  /* ================================================================== small helpers */

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function at(name, val) { return ' data-' + name + '="' + esc(val) + '"'; }
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function safe(fn, fallback) { try { var v = fn(); return v == null ? fallback : v; } catch (e) { return fallback; } }
  function setHTML(el, html) { if (el.__h === html) return false; el.innerHTML = html; el.__h = html; return true; }
  function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
  function show(el, on) { on = !!on; if (el.hidden === on) el.hidden = !on; }
  function num2(x) { return String(Math.round(x * 100) / 100); }

  var ICONS = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    down: '<path d="M5 9l7 7 7-7"/>',
    go: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5"/>',
    jar: '<rect x="7" y="2.8" width="10" height="3.6" rx="1.2"/><path d="M6.5 11a4 4 0 0 1 2.2-3.6h6.6A4 4 0 0 1 17.5 11v7.5A2.5 2.5 0 0 1 15 21H9a2.5 2.5 0 0 1-2.5-2.5z"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/>',
    tip: '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    warn: '<path d="M12 4 2.8 20h18.4L12 4z"/><path d="M12 10v4.5M12 17.4h.01"/>'
  };
  function ico(name, size) {
    size = size || 24;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  function clock(ms) { return isNum(ms) ? app.engine.fmtClock(ms) : ''; }
  function dur(mins) { return app.engine.fmtDur(mins); }
  function countdown(ms) { return app.engine.fmtCountdown(ms); }
  function stepMins(step) {
    return typeof app.engine.stepMins === 'function' ? app.engine.stepMins(step) : (step.mins || 0) + (step.timer ? step.timer.secs / 60 : 0);
  }
  // a countdown node: tickText() fills it in and keeps it current
  function cd(until, doneText, pre, post) {
    return '<span data-bd-until="' + until + '"' + at('done', doneText || '0:00') + (pre ? at('pre', pre) : '') + (post ? at('post', post) : '') + '></span>';
  }
  var TERM_RE = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
  // escaped text; [[key]] and [[key|shown]] become words he can tap for an explanation
  function rich(text) {
    text = String(text == null ? '' : text);
    var out = '', last = 0, m, gl = app.plan.glossary || {};
    TERM_RE.lastIndex = 0;
    while ((m = TERM_RE.exec(text))) {
      out += esc(text.slice(last, m.index));
      var key = m[1].trim(), shown = m[2] ? m[2] : key;
      if (gl[key]) out += '<span class="bd-term" role="button" tabindex="0" data-b="term"' + at('key', key) + '>' + esc(shown) + '</span>';
      else out += esc(shown);
      last = TERM_RE.lastIndex;
    }
    return out + esc(text.slice(last));
  }
  function lines(arr) { return (arr || []).map(function (l) { return '<p>' + rich(l) + '</p>'; }).join(''); }
  function dayLabel(ms) {
    return safe(function () { return new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).replace(/,/g, ''); }, '');
  }

  function indexPlan(plan) {
    var x = { byId: {}, waitDef: {}, waitDish: {}, moveOf: {}, dishById: {}, lanes: [] };
    (plan.steps || []).forEach(function (s) {
      if (!s || typeof s.id !== 'string') return;
      if (!x.byId[s.id]) x.byId[s.id] = s;
      if (s.wait && typeof s.wait.id === 'string' && !x.waitDef[s.wait.id]) { x.waitDef[s.wait.id] = s.wait; x.waitDish[s.wait.id] = s.dish; }
      if (s.kind === 'move' && s.move && !x.moveOf[s.move]) x.moveOf[s.move] = s;
    });
    x.lanes = [{ id: 'day', nick: 'The day', name: '', color: 'day' }].concat(plan.dishes || []);
    x.lanes.forEach(function (d) { if (!x.dishById[d.id]) x.dishById[d.id] = d; });
    return x;
  }
  function dishOf(step) { return ix.dishById[step.dish] || ix.dishById.day; }
  function cc(d) { return 'bd-c-' + (COLORS[d.color] ? d.color : 'day'); }
  function moveLabel(step) { return MOVE_LABEL[step.move] || 'Done'; }

  /* ================================================================== what to show right now */

  function projection(E, plan, state, now) {
    if (typeof app.getProjection === 'function') {
      var p = safe(function () { return app.getProjection(); }, null);
      if (p && p.rows && p.byStep) return p;
    }
    if (!pc.p || pc.state !== state || Math.abs(now - pc.at) >= 15000) {
      pc.p = safe(function () { return E.project(plan, state, now); }, null);
      if (!pc.p || !pc.p.rows || !pc.p.byStep) pc.p = Object.assign({}, EMPTY_PROJ, { dinnerAnchor: E.anchorMs(state, 'dinner') });
      pc.state = state; pc.at = now;
    }
    return pc.p;
  }
  function currentAlerts() {
    if (typeof app.getAlerts === 'function') return safe(function () { return app.getAlerts(); }, []);
    return safe(function () { return app.engine.alerts(app.plan, app.getState(), app.now()); }, []).map(function (a) { return Object.assign({ key: a.id }, a); });
  }
  function currentFocus() {
    if (typeof app.getFocus === 'function') return app.getFocus() || null;
    return safe(function () { return app.engine.nextStep(app.plan, app.getState(), app.now()); }, null);
  }
  function view() {
    var E = app.engine, plan = app.plan, state = app.getState(), now = app.now();
    var v = { E: E, plan: plan, state: state, now: now };
    v.preview = typeof app.isPreview === 'function' ? !!app.isPreview() : false;
    v.loc = safe(function () { return E.location(plan, state); }, 'home-am');
    var f = currentFocus();
    v.step = f && ix.byId[f] ? ix.byId[f] : null;
    v.proj = projection(E, plan, state, now);
    v.alerts = currentAlerts();
    v.waits = safe(function () { return E.waitsView(plan, state, now); }, []);
    var done = state.done || {}, k;
    v.dinnerDone = !!done.dinner;
    v.anyDone = false;
    for (k in done) if (done[k]) { v.anyDone = true; break; }
    var d0 = E.dayMs(state);
    v.tonight = !v.preview && isNum(d0) && now < d0 + 4 * HOUR && !v.anyDone;
    v.mode = v.step ? 'step' : v.dinnerDone ? 'done' : v.tonight ? 'tonight' : (v.loc === 'away' || v.loc === 'drive') ? v.loc : 'free';
    // a done step he tapped on the timeline is only looked at here; it never becomes the phone's current step
    var fid = v.step ? v.step.id : null;
    if (ui.peek && (state !== ui.peekState || fid !== ui.peekFocus || !ix.byId[ui.peek])) ui.peek = null;
    v.peek = ui.peek ? ix.byId[ui.peek] : null;
    v.shown = v.peek || v.step;
    return v;
  }

  /* ================================================================== left: alerts, timers, the step, its buttons */

  function btn(b, attrs, label, cls) {
    return '<button type="button" class="bd-btn' + (cls ? ' ' + cls : '') + '" data-b="' + b + '"' + (attrs || '') + '>' + label + '</button>';
  }
  function rowx() {
    var inner = Array.prototype.slice.call(arguments).join('');
    return inner ? '<div class="bd-rowx">' + inner + '</div>' : '';
  }
  function two(a, b) { return '<span class="bd-lines"><span>' + esc(a) + '</span><small>' + esc(b) + '</small></span>'; }
  function backBtn() { return btn('undo', '', 'Back', 'is-back'); }

  function alertHTML(a, focusId) {
    var st = a.stepId ? ix.byId[a.stepId] : null, viewing = !!st && st.id === focusId;
    var main = a.title || '', small = '', b = '', cls = 'bd-alert';
    if (a.kind === 'lap') b = /^turn/i.test(main) ? 'Turned' : 'Done';
    else if (a.kind === 'leave') {
      if (a.minsLeft >= 1) cls += ' is-soon';
      else { main = 'Time to leave'; if (st && !viewing) b = 'Go'; }
    } else if (a.kind === 'fg') {
      main = st ? st.title : 'Timer'; small = 'The timer has finished'; b = 'Go';
    } else {
      var def = ix.waitDef[a.waitId] || {}, label = def.label || '';
      var why = a.kind === 'max' ? (def.max ? 'more than ' + dur(def.max) : 'too long') : 'time is up';
      if (st && !viewing) { main = st.title; small = label ? label + ': ' + why : why; b = 'Go'; }
      else { main = a.kind === 'max' ? 'Too long' : 'Time is up'; small = label; b = 'OK'; }
    }
    return '<div class="' + cls + '"><div class="bd-alert-t">' + esc(main) + (small ? '<small>' + esc(small) + '</small>' : '') + '</div>' +
      (b ? '<button type="button" data-b="alert"' + at('key', a.key) + '>' + b + '</button>' : '') + '</div>';
  }
  function alertsHTML(v) {
    var h = '', live = {}, list = v.alerts || [], focusId = v.step && !v.peek ? v.step.id : null, k;
    if (v.preview) {
      h += '<div class="bd-alert is-preview"><div class="bd-alert-t">PREVIEW<small>nothing is saved</small></div><button type="button" data-b="preview-exit">Exit</button></div>';
    }
    list.forEach(function (a) { live[a.key] = 1; });
    for (k in ui.acked) if (!live[k]) delete ui.acked[k];
    var open = list.filter(function (a) { return !ui.acked[a.key] && !(a.kind === 'fg' && a.stepId === focusId); });   // on its own step the button already says so
    var shown = open.slice(0, 2), leave = open.filter(function (a) { return a.kind === 'leave'; })[0];
    if (leave && shown.indexOf(leave) < 0) shown[1] = leave;                 // the hard out always gets a place
    shown.forEach(function (a) { h += alertHTML(a, focusId); });
    return h;
  }
  function timersHTML(v) {
    var h = '', fg = v.state.fg, focusId = v.step && !v.peek ? v.step.id : null;
    function row(label, end, ready) {
      return '<div class="bd-timer' + (ready ? ' is-ready' : '') + '">' + ico('timer', 22) + '<span>' + esc(label) + '</span><b>' + (ready ? 'Ready' : cd(end, 'Ready')) + '</b></div>';
    }
    if (fg && ix.byId[fg.stepId] && v.now < fg.endsAt && fg.stepId !== focusId) {
      var fs = ix.byId[fg.stepId];
      h += row((fs.timer && fs.timer.label) || fs.title, fg.endsAt, false);
    }
    v.waits.forEach(function (w) { h += row(w.label, w.endsAt, w.elapsed); });
    return h;
  }

  function whereOf(v, step) {
    if (step.kind === 'move') return '';
    var w = step.where;
    if (w === 'either') { var b = v.proj.byStep[step.id]; w = (b ? b.loc : v.loc) === 'hers' ? 'hers' : 'home'; }
    return w === 'hers' ? 'Her kitchen' : 'Your kitchen';
  }
  function noteRow(cls, icon, html, extra) {
    return '<div class="bd-note' + (cls ? ' ' + cls : '') + '">' + (icon ? ico(icon, 22) : '') + '<span>' + html + '</span>' + (extra || '') + '</div>';
  }
  // why the step on screen cannot be done yet (same words as the phone guide)
  function statusNote(v, step) {
    var bl = safe(function () { return v.E.blockers(v.plan, v.state, step, v.now); }, []), by = {};
    bl.forEach(function (b) { if (!by[b.type]) by[b.type] = b; });
    if (by.wait) {
      var label = (ix.waitDef[by.wait.waitId] || {}).label || 'Timer';
      if (by.wait.endsAt == null) return noteRow('is-time', 'timer', esc(label) + ': not started yet');
      return noteRow('is-time', 'timer', cd(by.wait.endsAt, label + ': ready', label + ' · ', ' left'));
    }
    if (by.time) return noteRow('', 'timer', 'You are early. Planned for ' + esc(clock(by.time.at)) + '.');
    if (by.after && ix.byId[by.after.stepId]) return noteRow('', '', 'First: ' + esc(ix.byId[by.after.stepId].title));
    if (by.place && step.kind !== 'move') {
      return noteRow('', '', by.place.where === 'hers' ? 'This step is for her kitchen.' : by.place.where === 'home' ? 'This step is for your kitchen.' : 'Not while you are packing up.');
    }
    return '';
  }
  // what the plan does right after the step on screen
  function nextLine(v, step) {
    var rows = v.proj.rows || [], seen = false, i, r, st;
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (!seen) {
        if ((r.type === 'step' || r.type === 'move') && r.stepId === step.id) { if (r.status !== 'next') return ''; seen = true; }
        continue;
      }
      if (r.type === 'wait') continue;
      if (r.type === 'free') return 'Next: free time until ' + clock(r.end);
      st = ix.byId[r.stepId];
      return st ? 'Next: ' + st.title : '';
    }
    return '';
  }
  function checklistItems(v, step) {
    if (typeof v.E.checklistItems === 'function') return safe(function () { return v.E.checklistItems(v.plan, v.state, step); }, []);
    if (typeof step.items === 'string') return safe(function () { return v.E.packList(v.plan, v.state, step.items); }, []);
    var mine = (v.state.ticks || {})[step.id] || {};
    return (step.items || []).map(function (label, i) { return { id: 'i' + i, label: label, note: '', ticked: !!mine['i' + i], stepId: step.id }; });
  }
  function tickRow(it, peek) {
    var inner = '<span class="bd-box">' + ico('check', 20) + '</span><span class="bd-tick-t">' + esc(it.label) + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</span>';
    if (!it.stepId || peek) return '<li><div class="bd-tick" aria-pressed="' + (it.ticked ? 'true' : 'false') + '">' + inner + '</div></li>';
    return '<li><button type="button" class="bd-tick" aria-pressed="' + (it.ticked ? 'true' : 'false') + '" data-b="tick"' + at('step', it.stepId) + at('item', it.id) + '>' + inner + '</button></li>';
  }
  function callout(cls, icon, label, html) {
    return '<div class="bd-call ' + cls + '">' + ico(icon, 26) + '<div>' + (label ? '<span class="bd-label">' + label + '</span>' : '') + '<div class="bd-val">' + html + '</div></div></div>';
  }
  function stepCard(v, step, peek) {
    var d = dishOf(step), where = whereOf(v, step), h = '<article class="bd-card ' + cc(d) + '">';
    h += '<div class="bd-crumb"><span class="bd-dot"></span><b>' + esc(d.nick) + '</b>' + (where ? '<span>' + where + '</span>' : '') +
      (d.id !== 'day' && d.name ? '<i>' + esc(d.name) + '</i>' : '') + '</div>';
    h += '<h1 class="bd-title">' + esc(step.title) + '</h1>';
    if (peek) {
      var at0 = (v.state.done || {})[step.id];
      h += noteRow('is-ok', 'check', 'Done' + (isNum(at0) ? ' at ' + esc(clock(at0)) : ''));
    } else {
      h += statusNote(v, step);
      var nx = safe(function () { return v.E.nextStep(v.plan, v.state, v.now); }, null);
      var rung = (v.alerts || []).some(function (a) { return a.stepId === nx && a.kind !== 'lap' && !ui.acked[a.key]; });   // the alert above already offers it
      if (nx && nx !== step.id && ix.byId[nx] && !rung) {
        h += noteRow('', 'go', 'Up next in the plan: <b>' + esc(ix.byId[nx].title) + '</b>', '<button type="button" data-b="focus"' + at('step', nx) + '>Go</button>');
      }
    }
    if (step.body && step.body.length) h += '<div class="bd-body">' + lines(step.body) + '</div>';
    if (step.kind === 'checklist') {
      var items = checklistItems(v, step);
      h += '<div class="bd-block"><p class="bd-label">' + items.filter(function (i) { return i.ticked; }).length + ' of ' + items.length + ' ticked</p>' +
        '<ul class="bd-ticks">' + items.map(function (it) { return tickRow(it, peek); }).join('') + '</ul></div>';
    }
    if (step.need && step.need.length) {
      h += '<div class="bd-block"><p class="bd-label">You need</p><ul class="bd-need">' + step.need.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
    }
    if (step.into) h += callout('is-into', 'jar', 'Put it in', esc(step.into));
    if (step.look) h += callout('is-look', 'ok', "It's right when", rich(step.look));
    if (step.tip) h += callout('is-tip', 'tip', 'Tip', rich(step.tip));
    if (step.warn) h += callout('is-warn', 'warn', '', rich(step.warn));
    var m = stepMins(step), meta = '', nl = peek ? '' : nextLine(v, step);
    if (m > 0) meta += '<span>About ' + esc(dur(m)) + '</span>';
    if (nl) meta += '<span>' + esc(nl) + '</span>';
    if (meta) h += '<div class="bd-meta">' + meta + '</div>';
    return h + '</article>';
  }
  function canGiveUp(v, step) {
    var c = step.check;
    if (!c || !c.giveUp || v.loc !== 'home-am') return false;
    if (typeof v.E.canGiveUp === 'function') return !!safe(function () { return v.E.canGiveUp(v.plan, v.state, step, v.now); }, false);
    var w = c.giveUp.withinMinsOf;
    if (!w) return true;
    var a = v.E.anchorMs(v.state, w.anchor);
    return isNum(a) && v.now >= a - (w.mins || 0) * MIN;
  }
  // the same main button the phone guide shows for this step
  function stepActions(v, step) {
    var id = at('step', step.id), kind = step.kind || 'do', h = '';
    if (kind === 'check' && step.check) {
      var c = step.check;
      h += rowx(btn('retry', id, two(c.no || 'Not yet', 'check again in ' + dur(c.retryMins || 5)), 'is-big'), btn('done', id, esc(c.yes || 'Yes'), 'is-go is-ans'));
      return h + rowx(backBtn(), canGiveUp(v, step) ? btn('giveup', id, esc(c.giveUp.label || 'No time for this'), 'is-main') : '');
    }
    if (kind === 'choice' && step.choice) {
      (step.choice.options || []).forEach(function (o, i) { h += rowx(btn('choose', id + at('i', i), esc(o.label), 'is-big')); });
      return h + rowx(backBtn());
    }
    var fg = v.state.fg && v.state.fg.stepId === step.id ? v.state.fg : null, main;
    if (step.timer && !fg) main = btn('start', id, 'Start ' + esc(countdown(step.timer.secs * 1000)), 'is-go is-main');
    else if (step.timer && fg && v.now < fg.endsAt) {
      return rowx(backBtn(), '<div class="bd-timerbox" role="timer" aria-label="' + esc(step.timer.label || 'Timer') + '">' + cd(fg.endsAt, '0:00') + '</div>', btn('skiptimer', '', 'Skip timer', 'is-side'));
    } else if (fg) main = btn('done', id, two('Done', 'Time is up'), 'is-go is-main');
    else main = btn('done', id, esc(kind === 'move' ? moveLabel(step) : (kind === 'checklist' && typeof step.items === 'string') ? 'All packed' : 'Done'), 'is-go is-main');
    return rowx(backBtn(), step.optional ? btn('skip', id, 'Skip', 'is-side') : '', main);
  }

  function freeParts(v) {
    var E = v.E, u = safe(function () { return E.nextUnlock(v.plan, v.state, v.now); }, null), h = '<div class="bd-card">', top = '', early = '';
    var mvName = { 'home-am': 'leaveAm', 'home-pm': 'leavePm' }[v.loc], mv = mvName ? ix.moveOf[mvName] : null;
    if (u && ix.byId[u.stepId]) {
      var nx = ix.byId[u.stepId];
      var why = u.reason === 'wait' ? ((ix.waitDef[nx.afterWait] || {}).label || 'A timer is running') + '.'
        : u.reason === 'time' ? 'The next step is timed so the food is hot at dinner.' : 'Everything for this kitchen is done.';
      h += '<h1 class="bd-title">Free until ' + esc(clock(u.at)) + '</h1><div class="bd-count" role="timer">' + cd(u.at, '0:00') + '</div>' +
        '<p class="bd-lead">' + esc(why) + '</p><div class="bd-block"><span class="bd-label">Next</span><p class="bd-lead"><b>' + esc(nx.title) + '</b></p></div>';
      if (v.preview) h += noteRow('', '', 'In a preview, skip ahead from the phone guide.');
      else if (u.reason === 'time') top = btn('focus', at('step', u.stepId), 'Start it now', 'is-go');
    } else {
      h += '<h1 class="bd-title">Nothing to do right now</h1><p class="bd-lead">The timeline shows what is left.</p>';
    }
    // Leaving: when nothing else is left here the card shows the walk-out checks and the button leaves.
    // While timers still run he can leave early, through the leave step, so he sees those checks first.
    var canLeave = !!mv && !safe(function () { return E.isDone(v.plan, v.state, mv); }, false);
    var leaveNow = canLeave && (!u || u.reason === 'move');
    if (leaveNow && mv.body && mv.body.length) h += '<div class="bd-body">' + lines(mv.body) + '</div>';
    if (leaveNow && !top) top = btn('done', at('step', mv.id), esc(moveLabel(mv)), 'is-go');
    else if (leaveNow) early = btn('done', at('step', mv.id), esc(moveLabel(mv)), 'is-main');
    else if (canLeave) early = btn('focus', at('step', mv.id), 'Leave early', 'is-main');
    return { card: h + '</div>', actions: rowx(top) + rowx(backBtn(), early) };
  }
  function leftParts(v) {
    var s = v.state, E = v.E, h, mv;
    if (v.peek) {
      return { card: stepCard(v, v.peek, true), actions: rowx(btn('unpeek', '', 'Back to now', 'is-big is-main'), btn('undone', at('step', v.peek.id), 'Not done', 'is-side')) };
    }
    if (v.mode === 'step') return { card: stepCard(v, v.step, false), actions: stepActions(v, v.step) };
    if (v.mode === 'done') {
      var dn = ix.byId.dinner || { body: [] };
      return { card: '<div class="bd-card"><h1 class="bd-title">Dinner is served.</h1><div class="bd-body">' + lines(dn.body) + '</div></div>', actions: rowx(backBtn()) };
    }
    if (v.mode === 'tonight') {
      var d0 = E.dayMs(s), eve = v.now >= d0 - DAY;
      var when = v.now >= d0 ? 'Today starts at ' : eve ? 'Tomorrow starts at ' : dayLabel(d0) + ' starts at ';
      h = '<div class="bd-card"><h1 class="bd-title">' + (eve ? 'Tonight' : 'Before the day') + '</h1>' +
        '<p class="bd-lead">A few small jobs so the cooking goes smoothly.</p><ul class="bd-ticks">';
      (v.plan.tonight || []).forEach(function (it) {
        var on = !!(s.tonight && s.tonight[it.id]);
        h += '<li><button type="button" class="bd-tick" aria-pressed="' + (on ? 'true' : 'false') + '" data-b="tonight"' + at('id', it.id) + '><span class="bd-box">' + ico('check', 20) +
          '</span><span class="bd-tick-t">' + esc(it.title) + '</span></button>' +
          (!on && it.body && it.body.length ? '<div class="bd-sub">' + lines(it.body) + '</div>' : '') + '</li>';
      });
      h += '</ul><p class="bd-lead"><b>' + esc(when + clock(E.anchorMs(s, 'start'))) + '</b></p></div>';
      return { card: h, actions: '' };
    }
    if (v.mode === 'away' || v.mode === 'drive') {
      mv = ix.moveOf[v.mode === 'away' ? 'backHome' : 'arrive'];
      var eta;
      if (v.mode === 'away') eta = 'Back home around ' + clock(E.anchorMs(s, 'backHome')) + '.';
      else {
        var left = ix.moveOf.leavePm ? (s.done || {})[ix.moveOf.leavePm.id] : null;
        var arr = isNum(left) ? left + (s.anchors.arrive - s.anchors.leavePm) * MIN : E.anchorMs(s, 'arrive');
        eta = 'You should get there around ' + clock(arr) + '.';
      }
      h = '<div class="bd-card"><h1 class="bd-title">' + (v.mode === 'away' ? "You're out." : 'Drive to her place.') + '</h1><p class="bd-lead">' + esc(eta) + '</p>' +
        (mv && mv.body ? '<div class="bd-body">' + lines(mv.body) + '</div>' : '') + '</div>';
      return { card: h, actions: rowx(backBtn(), mv ? btn('done', at('step', mv.id), esc(moveLabel(mv)), 'is-go is-main') : '') };
    }
    return freeParts(v);
  }
  function glossHTML(g) {
    return '<div class="bd-gloss" role="dialog" aria-label="What this word means"><p class="bd-label">What it means</p><h2>' + esc(g.term) + '</h2>' +
      String(g.text || '').split('\n').map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>';
  }
  function updateMore() {
    var c = R.card;
    show(R.more, c.scrollHeight - c.clientHeight - c.scrollTop > 16);
  }
  function renderLeft(v) {
    setText(R.place, (v.preview ? 'Preview · ' : '') + (PLACE[v.loc] || ''));
    var ah = alertsHTML(v), th = timersHTML(v), parts = leftParts(v);
    show(R.alerts, ah); setHTML(R.alerts, ah);
    show(R.timers, th); setHTML(R.timers, th);
    var base = v.shown ? v.shown.id : v.mode;
    if (ui.gloss && ui.glossFor !== base) ui.gloss = null;                  // the step changed under the explanation
    var g = ui.gloss ? (v.plan.glossary || {})[ui.gloss] : null;
    if (g) parts = { card: glossHTML(g), actions: rowx(btn('gloss-close', '', 'Close', 'is-big')) };
    var id = g ? 'word:' + ui.gloss : base, keep = R.card.__id === id ? R.card.scrollTop : 0;
    if (!g && R.card.__id !== id && ui.backTo && ui.backTo.id === id) keep = ui.backTo.top;   // closing an explanation returns to the same line
    if (!g) ui.backTo = null;
    if (setHTML(R.card, parts.card)) R.card.scrollTop = keep;
    R.card.__id = id;
    show(R.actions, parts.actions); setHTML(R.actions, parts.actions || '');
    updateMore();
  }

  /* ================================================================== right: clock, dinner, the day */

  function headHTML(v) {
    var p = v.proj, c = clock(v.now), m = /^(.*?)\s*([AP]M)$/i.exec(c), t, pill, cls = '';
    var d0 = v.E.dayMs(v.state), day = !isNum(d0) || v.now >= d0 ? '' : v.now >= d0 - DAY ? 'tomorrow ' : dayLabel(d0) + ', ';   // opened before the cook day
    if (v.dinnerDone) { t = 'Dinner ' + clock((v.state.done || {}).dinner); pill = 'Dinner is served'; }
    else if (p.dinnerAt == null) { t = 'Dinner ' + day + clock(p.dinnerAnchor); pill = 'Some steps cannot be planned yet'; cls = ' is-plain'; }
    else if (p.lateMin > 0) { t = 'Dinner ' + day + 'about ' + clock(p.dinnerAt); pill = 'Running ' + p.lateMin + ' min late'; cls = ' is-late'; }
    else { t = 'Dinner ' + day + clock(p.dinnerAnchor); pill = 'On time' + (p.spareMin > 0 ? ' · ' + p.spareMin + ' min to spare' : ''); }
    var pr = safe(function () { return v.E.progress(v.plan, v.state); }, null);
    return '<div class="bd-clock">' + (m ? esc(m[1]) + '<small>' + esc(m[2]) + '</small>' : esc(c)) + '</div>' +
      '<div class="bd-dinner"><div class="bd-dinner-t">' + esc(t) + '</div><div class="bd-pill' + cls + '">' + esc(pill) + '</div></div>' +
      (pr && pr.total ? '<div class="bd-prog"><b>' + pr.done + ' of ' + pr.total + '</b>steps done</div>' : '');
  }

  // The day as HTML. Time runs left to right at one scale inside the kitchens; the stretches he is out are squeezed.
  function buildTimeline(v, W, hiId) {
    var E = v.E, p = v.proj, rows = p.rows || [], state = v.state, now = v.now, i, r;
    var a0 = E.anchorMs(state, 'start'), dn = p.dinnerAnchor, lo = Infinity, hi = -Infinity;
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      var rs = r.type === 'move' ? r.at : r.start, re = r.type === 'move' ? r.at : r.end;
      if (isNum(rs) && rs < lo) lo = rs;
      if (isNum(re) && re > hi) hi = re;
    }
    if (isNum(a0)) lo = Math.min(lo, a0);
    if (isNum(dn)) hi = Math.max(hi, dn);
    if (!isFinite(lo) || !isFinite(hi)) return null;
    if (isNum(a0)) lo = Math.max(lo, a0 - 3 * HOUR);             // a step ticked off the evening before must not stretch the day
    if (isNum(dn)) hi = Math.min(hi, Math.max(dn, isNum(p.dinnerAt) ? p.dinnerAt : dn) + 3 * HOUR);
    lo -= 12 * MIN; hi += 15 * MIN;
    if (hi - lo < HOUR) hi = lo + HOUR;

    // where he is, from the move rows
    var segs = [], cur = { loc: 'home-am', a: lo };
    rows.forEach(function (row) {
      if (row.type !== 'move' || !isNum(row.at)) return;
      var t = Math.min(hi, Math.max(lo, row.at));
      if (t > cur.a) { cur.b = t; segs.push(cur); }
      cur = { loc: row.to || AFTER[cur.loc] || cur.loc, a: Math.max(t, cur.a) };
    });
    if (hi > cur.a) { cur.b = hi; segs.push(cur); }
    if (!segs.length) return null;

    function layout() {
      var fixed = 0, flex = 0;
      segs.forEach(function (s) {
        s.fix = SQUEEZE[s.loc] && !s.toScale ? SQUEEZE[s.loc] : 0;
        if (s.fix) fixed += s.fix; else flex += s.b - s.a;
      });
      return flex > 0 ? Math.max(40, W - fixed) / flex : 0;       // px per ms
    }
    var per = layout(), again = false;
    segs.forEach(function (s) { if (s.fix && (s.b - s.a) * per < s.fix) { s.toScale = true; again = true; } });   // a short trip is drawn to scale
    if (again) per = layout();
    var total = 0;
    segs.forEach(function (s) { s.px = s.fix || (s.b - s.a) * per; s.x0 = total; total += s.px; });
    if (!(total > 0)) return null;
    function xOf(t) {                                             // percent of the width
      if (!(t > lo)) return 0;
      if (t >= hi) return 100;
      for (var k = 0; k < segs.length; k++) {
        var s = segs[k];
        if (t <= s.b) return (s.x0 + (t - s.a) / (s.b - s.a) * s.px) / total * 100;
      }
      return 100;
    }
    function px(pct) { return pct / 100 * W; }
    function segAt(t) { for (var k = 0; k < segs.length; k++) if (t <= segs[k].b) return segs[k]; return segs[segs.length - 1]; }

    var h = '', axis = '', minPct = 4 / W * 100;
    segs.forEach(function (s) {
      var out = s.loc === 'away' || s.loc === 'drive', x0 = s.x0 / total * 100, w = s.px / total * 100, label = BAND[s.loc] || '';
      h += '<div class="bd-band ' + (out ? 'is-out' : s.loc === 'hers' ? 'is-in is-hers' : 'is-in') + '"' + at('x', num2(x0)) + at('w', num2(w)) + '></div>';
      if (label && px(w) >= label.length * 8.2 + 12) axis += '<div class="bd-bl"' + at('x', num2(x0)) + '>' + esc(label) + '</div>';
    });
    // Time labels: every whole hour in a kitchen (none inside a squeezed stretch),
    // plus the moment each kitchen stretch starts after he was out, so the break in the scale is plain.
    var marks = [];
    segs.forEach(function (s, k) { if (k > 0 && segs[k - 1].fix && !s.fix) marks.push({ t: s.a, edge: 1 }); });
    var d = new Date(lo), hr = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1, 0, 0, 0), guard = 0;
    while (hr.getTime() <= hi && guard++ < 60) {
      var t = hr.getTime(), sg = segAt(t);
      if (!(sg.fix && t > sg.a && t < sg.b)) {
        h += '<div class="bd-gl"' + at('x', num2(xOf(t))) + '></div>';
        marks.push({ t: t, edge: 0 });
      }
      hr = new Date(hr.getFullYear(), hr.getMonth(), hr.getDate(), hr.getHours() + 1, 0, 0, 0);
    }
    var placed = [], lastHalf = '';
    marks.sort(function (a, b) { return b.edge - a.edge || a.t - b.t; });
    marks.forEach(function (m) {
      var dd = new Date(m.t + 30000);                           // to the nearest minute
      m.h = dd.getHours(); m.m = dd.getMinutes(); m.x = xOf(m.t); m.px = px(m.x);
      if (m.px > W - 14) return;
      for (var k = 0; k < placed.length; k++) if (Math.abs(placed[k].px - m.px) < (m.m || placed[k].m ? 48 : 36)) return;
      placed.push(m);
    });
    placed.sort(function (a, b) { return a.px - b.px; });
    placed.forEach(function (m) {
      var half = m.h < 12 ? 'AM' : 'PM';
      var text = (m.h % 12 === 0 ? 12 : m.h % 12) + (m.m ? ':' + (m.m < 10 ? '0' : '') + m.m : '') + (half !== lastHalf ? ' ' + half : '');
      lastHalf = half;
      axis += '<div class="bd-tk' + (m.px - (text.length * 8 + 4) / 2 < 2 ? ' is-l' : '') + '"' + at('x', num2(m.x)) + '>' + text + '</div>';
    });
    if (isNum(dn) && dn > lo && dn < hi) {
      h += '<div class="bd-dl"' + at('x', num2(xOf(dn))) + '></div>';
      axis += '<div class="bd-df' + (W - px(xOf(dn)) >= 70 ? ' is-r' : '') + '"' + at('x', num2(xOf(dn))) + '>Dinner</div>';   // beside the line, on the side with room
    }

    var lanes = ix.lanes.map(function (dd) { return { d: dd, bars: '', waits: [] }; }), laneOf = {};
    lanes.forEach(function (l, n) { if (laneOf[l.d.id] == null) laneOf[l.d.id] = n; });
    rows.forEach(function (row) {
      var lane, x0, w, s, e;
      if (row.type === 'step' || row.type === 'move') {
        var st = ix.byId[row.stepId];
        if (!st) return;
        lane = lanes[laneOf[st.dish] != null ? laneOf[st.dish] : laneOf.day];
        s = row.type === 'move' ? row.at : row.start; e = row.type === 'move' ? row.at : row.end;
        if (!isNum(s) || !isNum(e)) return;
        x0 = xOf(s); w = Math.max(xOf(e) - x0, minPct);
        if (x0 + w > 100) x0 = 100 - w;
        var mins = stepMins(st), done = row.status === 'done';
        var tip = clock(s) + ' · ' + st.title + (mins > 0 ? ' · ' + dur(mins) : '') + (done ? ' · done' : '');
        lane.bars += '<button type="button" tabindex="-1" class="bd-bar' + (done ? ' is-done' : row.status === 'next' ? ' is-next' : '') + (row.type === 'move' ? ' is-move' : '') +
          (row.late && !done ? ' is-late' : '') + (st.id === hiId ? ' is-focus' : '') + '" data-b="bar"' + at('step', st.id) + at('x', num2(x0)) + at('w', num2(w)) +
          ' title="' + esc(tip) + '" aria-label="' + esc(tip) + '"></button>';
      } else if (row.type === 'wait') {
        if (!isNum(row.start) || !isNum(row.end)) return;
        var dish = ix.waitDish[row.waitId];
        lane = lanes[laneOf[dish] != null ? laneOf[dish] : laneOf.day];
        x0 = xOf(row.start); w = xOf(row.end) - x0;
        if (!(w > 0)) return;
        lane.waits.push({ w: w, html: '<div class="bd-wait' + (row.end <= now ? ' is-past' : row.start <= now ? ' is-live' : '') + '"' + at('x', num2(x0)) + at('w', num2(w)) +
          ' title="' + esc(row.label + ' · ' + clock(row.start) + ' to ' + clock(row.end)) + '"></div>' });
      }
    });
    h += '<div class="bd-axis">' + axis + '</div><div class="bd-lanes">';
    lanes.forEach(function (l) {
      var pr = safe(function () { return E.dishProgress(v.plan, state, l.d.id); }, null);
      l.waits.sort(function (a, b) { return b.w - a.w; });         // long timers underneath, short ones on top
      h += '<div class="bd-lane ' + cc(l.d) + '"><div class="bd-lane-h"><span>' + esc(l.d.nick) + (pr && pr.total ? '<i>' + pr.done + '/' + pr.total + '</i>' : '') + '</span></div>' +
        '<div class="bd-row">' + l.bars + '</div><div class="bd-wrow">' + l.waits.map(function (x) { return x.html; }).join('') + '</div></div>';
    });
    return { html: h + '</div>', xOf: xOf, lo: lo, hi: hi };
  }
  // the next few things, in words (the bars are too thin to read)
  function upHTML(v, max) {
    var rows = v.proj.rows || [], items = [], h = '', fid = v.step ? v.step.id : null;
    rows.forEach(function (r) {
      if (items.length >= max) return;
      if ((r.type === 'step' || r.type === 'move') && r.status !== 'done' && r.stepId !== fid && ix.byId[r.stepId]) items.push(r);
      else if (r.type === 'free' && items.length && r.end > v.now) items.push(r);
    });
    items.forEach(function (r) {
      if (r.type === 'free') {
        h += '<div class="bd-up-i is-free"><span class="bd-up-t">' + esc(clock(r.start)) + '</span><span class="bd-up-ttl">Free time</span><span class="bd-up-m">until ' + esc(clock(r.end)) + '</span></div>';
        return;
      }
      var st = ix.byId[r.stepId], d = dishOf(st), m = stepMins(st);
      h += '<button type="button" class="bd-up-i ' + cc(d) + '" data-b="bar"' + at('step', st.id) + '><span class="bd-up-t">' + esc(clock(r.type === 'move' ? r.at : r.start)) + (m > 0 ? ' · ' + esc(dur(m)) : '') + '</span>' +
        '<span class="bd-up-ttl">' + esc(st.title) + '</span><span class="bd-up-m"><span class="bd-dot"></span><span>' + esc(d.nick) + '</span></span></button>';
    });
    return h;
  }
  function place(container) {
    var nodes = container.querySelectorAll('[data-x]'), i, e, w;
    for (i = 0; i < nodes.length; i++) {
      e = nodes[i];
      e.style.left = e.getAttribute('data-x') + '%';
      w = e.getAttribute('data-w');
      if (w) e.style.width = w + '%';
    }
  }
  function renderTimeline(v) {
    var W = R.tlin.clientWidth || 700, hiId = v.shown ? v.shown.id : '', n = R.right.clientWidth >= 760 ? 4 : 3;
    if (v.proj !== tl.proj) { tl.proj = v.proj; tl.n++; }
    var key = tl.n + '|' + W + '|' + hiId + '|' + n;
    if (key !== tl.key) {                                         // only after a change, or when the app re-plans (every 15 s at most)
      tl.key = key;
      var built = buildTimeline(v, W, hiId);
      tl.xOf = built ? built.xOf : null; tl.lo = built ? built.lo : 0; tl.hi = built ? built.hi : 0;
      if (setHTML(R.plot, built ? built.html : '')) place(R.plot);
      var up = upHTML(v, n);
      show(R.uplabel, up); show(R.up, up); setHTML(R.up, up);
    }
    var x = tl.xOf && v.now >= tl.lo && v.now <= tl.hi ? tl.xOf(v.now) : -1;
    show(R.now, x >= 0);
    if (x >= 0) {
      var s = x.toFixed(2) + '%';
      if (R.now.__x !== s) { R.now.style.left = s; R.now.__x = s; R.now.classList.toggle('is-flip', x > 88); }
    }
  }
  // the plan's warnings, kept to a line: a long list of steps becomes a count (the phone guide's Day tab names them)
  function warnText(w) {
    var t = String(w.text || ''), n = w.stepIds ? w.stepIds.length : 0, i = t.indexOf(': ');
    return n > 2 && i > 0 ? t.slice(0, i) + ': ' + n + ' steps.' : t;
  }
  function renderRight(v) {
    setHTML(R.head, headHTML(v));
    var warns = (v.proj.warnings || []).filter(function (w) { return w.code !== 'late' && w.text; }).slice(0, 2);
    show(R.warns, warns.length);
    setHTML(R.warns, warns.map(function (w) { return '<li>' + esc(warnText(w)) + '</li>'; }).join(''));
    renderTimeline(v);
  }

  /* ================================================================== the loop */

  function tickText(now) {
    var nodes = root.querySelectorAll('[data-bd-until]'), i, n, rem, txt;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      rem = Number(n.getAttribute('data-bd-until')) - now;
      txt = rem > 0 ? (n.getAttribute('data-pre') || '') + countdown(rem) + (n.getAttribute('data-post') || '') : n.getAttribute('data-done');
      if (n.textContent !== txt) n.textContent = txt;
    }
  }
  function update() {
    if (!app || !root || !R) return;
    try {
      var v = view();
      renderLeft(v);
      renderRight(v);
      tickText(v.now);
      failed = false;
    } catch (e) { fail(e); }
  }
  function fail(e) {
    if (!failed && window.console && console.error) console.error('Board: ' + (e && e.message ? e.message : e));
    failed = true;
    try {
      setHTML(R.card, '<div class="bd-card"><h1 class="bd-title">The board hit a problem</h1><p class="bd-lead">Your progress is safe. Use the phone guide.</p></div>');
      show(R.actions, true);
      setHTML(R.actions, '<div class="bd-rowx"><a class="bd-btn is-go" href="#now">Open the phone guide</a></div>');
    } catch (e2) { /* nothing more to do */ }
  }

  /* ================================================================== taps */

  function openStep(id) {
    var st = ix.byId[id], f = currentFocus();
    if (!st) return;
    var state = app.getState();
    if (safe(function () { return app.engine.isDone(app.plan, state, st); }, false)) {
      ui.peek = id; ui.peekState = state; ui.peekFocus = f && ix.byId[f] ? f : null;        // look only: the phone's current step stays
    } else {
      ui.peek = null;
      if (id !== f) app.act('focus', id);
    }
    update();
  }
  // the timers that ring for the step on screen are answered by using its buttons
  function ackFor(stepId) {
    currentAlerts().forEach(function (a) {
      if (a.stepId === stepId && (a.kind === 'wait' || a.kind === 'max' || a.kind === 'fg') && !ui.acked[a.key]) {
        ui.acked[a.key] = true;
        app.act('ackAlert', a.key);
      }
    });
  }
  var HANDLERS = {
    'undo': function () { ui.peek = null; app.act('undo'); },
    'done': function (el, id) { app.act('complete', id); },
    'retry': function (el, id) { app.act('retry', id); },
    'giveup': function (el, id) { app.act('giveUp', id); },
    'skip': function (el, id) { app.act('skip', id); },
    'choose': function (el, id) {
      var st = ix.byId[id], o = st && st.choice ? (st.choice.options || [])[Number(el.getAttribute('data-i'))] : null;
      if (o) app.act('complete', id, { value: o.value });
    },
    'start': function (el, id) { app.act('startTimer', id); },
    'skiptimer': function () { app.act('skipTimer'); },
    'tick': function (el, id) { app.act('tick', id, el.getAttribute('data-item'), el.getAttribute('aria-pressed') !== 'true'); },
    'tonight': function (el) { app.act('tickTonight', el.getAttribute('data-id'), el.getAttribute('aria-pressed') !== 'true'); },
    'focus': function (el, id) { ui.peek = null; app.act('focus', id); },
    'bar': function (el, id) { openStep(id); },
    'unpeek': function () { ui.peek = null; },
    'undone': function (el, id) { ui.peek = null; app.act('uncomplete', id); },
    'term': function (el) {
      if (ui.gloss) return;
      ui.backTo = { id: R.card.__id, top: R.card.scrollTop };
      ui.gloss = el.getAttribute('data-key'); ui.glossFor = R.card.__id;
    },
    'gloss-close': function () { ui.gloss = null; },
    'more': function () { R.card.scrollTop += Math.round(R.card.clientHeight * 0.75); },
    'preview-exit': function () { app.act('previewExit'); },
    'alert': function (el) {
      var key = el.getAttribute('data-key'), a = currentAlerts().filter(function (x) { return x.key === key; })[0];
      if (!a) return;
      if (a.kind === 'lap') { app.act('ackLap', a.waitId, a.lap); return; }
      ui.acked[a.key] = true;
      app.act('ackAlert', a.key);
      ui.peek = null;
      if (a.stepId && ix.byId[a.stepId] && a.stepId !== currentFocus()) app.act('focus', a.stepId);
    }
  };
  // a tap between two thin bars picks the nearest one
  function nearestBar(rowEl, x) {
    var bars = rowEl.querySelectorAll('.bd-bar'), best = null, bestD = 18, i, r, d;
    for (i = 0; i < bars.length; i++) {
      r = bars[i].getBoundingClientRect();
      d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (d < bestD) { bestD = d; best = bars[i]; }
    }
    return best;
  }
  function onClick(ev) {
    if (!app || !root) return;
    var t = ev.target && ev.target.closest ? ev.target : null;
    if (!t) return;
    var el = t.closest('[data-b]');
    if (!el || !root.contains(el)) {
      var rowEl = t.closest('.bd-row');
      el = rowEl && root.contains(rowEl) ? nearestBar(rowEl, ev.clientX) : null;
    }
    if (!el || el.disabled) return;
    var fn = HANDLERS[el.getAttribute('data-b')];
    if (!fn) return;
    if (el.closest('.bd-actions')) {
      // a slippery double tap must not skip a step: the action bar ignores a second tap for half a second
      if (ev.timeStamp - ui.lastAction < api.guardMs) { ev.preventDefault(); return; }
      ui.lastAction = ev.timeStamp;
      var f = currentFocus();
      if (f && !ui.peek && !ui.gloss) ackFor(f);
    }
    fn(el, el.getAttribute('data-step'), ev);
    update();
  }
  function onEscape(ev) {                                       // on the document: after a re-render the keyboard focus is on the page itself
    if (app && root && ui && ui.gloss && ev.key === 'Escape') { ui.gloss = null; update(); }
  }
  function onKey(ev) {
    if (!app || !root) return;
    var t = ev.target;
    if ((ev.key === 'Enter' || ev.key === ' ') && t && t.getAttribute && t.getAttribute('role') === 'button' && root.contains(t)) {
      ev.preventDefault(); ev.stopPropagation();             // the phone guide listens for the same keys on the document
      t.click();
    }
  }
  function onResize() { if (tl) { tl.key = ''; update(); } }

  /* ================================================================== mount / unmount */

  var SKELETON =
    '<div class="bd">' +
      '<section class="bd-left" aria-label="What to do now">' +
        '<div class="bd-nav"><a class="bd-link" href="#now">' + ico('left', 22) + '<span>Phone guide</span></a><span class="bd-place" data-r="place"></span></div>' +
        '<div class="bd-alerts" data-r="alerts" role="status" aria-live="assertive" hidden></div>' +
        '<div class="bd-timers" data-r="timers" hidden></div>' +
        '<div class="bd-scrollwrap"><div class="bd-scroll" data-r="card"></div>' +
          '<div class="bd-more" data-r="more" hidden><button type="button" data-b="more">' + ico('down', 20) + '<span>More</span></button></div></div>' +
        '<div class="bd-actions" data-r="actions" hidden></div>' +
      '</section>' +
      '<section class="bd-right" data-r="right" aria-label="The day">' +
        '<header class="bd-head" data-r="head"></header>' +
        '<ul class="bd-warns" data-r="warns" hidden></ul>' +
        '<div class="bd-tl"><div class="bd-tlin" data-r="tlin"><div class="bd-plot" data-r="plot"></div><div class="bd-now" data-r="now" hidden><b>Now</b></div></div></div>' +
        '<div class="bd-upwrap"><div class="bd-uphead"><p class="bd-label" data-r="uplabel">Coming up</p>' +
          '<p class="bd-legend"><span><i class="bd-lg is-step"></i>a step</span><span><i class="bd-lg is-wait"></i>a timer running by itself</span><span><i class="bd-lg is-done"></i>done</span></p></div>' +
          '<div class="bd-up" data-r="up" hidden></div></div>' +
      '</section>' +
    '</div>';

  function mount(el, cookApp) {
    if (root) unmount();
    if (!el || !cookApp || !cookApp.plan || !cookApp.engine || typeof cookApp.getState !== 'function' || typeof cookApp.now !== 'function' ||
        typeof cookApp.act !== 'function' || typeof cookApp.subscribe !== 'function') {
      throw new Error('CookBoard.mount needs a root element and the CookApp contract');
    }
    try {
      app = cookApp; root = el;
      ix = indexPlan(app.plan);
      ui = { peek: null, peekState: null, peekFocus: null, gloss: null, glossFor: null, backTo: null, acked: {}, lastAction: -1e9 };
      tl = { proj: null, n: 0, key: '', xOf: null, lo: 0, hi: 0 };
      pc = { state: null, at: 0, p: null };
      failed = false;
      root.innerHTML = SKELETON;
      if (!ensureStyle()) throw new Error('The board styles could not be loaded');
      R = {};
      var nodes = root.querySelectorAll('[data-r]'), i;
      for (i = 0; i < nodes.length; i++) R[nodes[i].getAttribute('data-r')] = nodes[i];
      root.addEventListener('click', onClick);
      root.addEventListener('keydown', onKey);
      document.addEventListener('keydown', onEscape);
      R.card.addEventListener('scroll', updateMore, { passive: true });
      window.addEventListener('resize', onResize);
      unsub = app.subscribe(update);
      update();
    } catch (e) {
      unmount();
      throw e;
    }
  }
  function unmount() {
    if (typeof unsub === 'function') { try { unsub(); } catch (e) { /* ignore */ } }
    unsub = null;
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onEscape);
    if (root) {
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      root.innerHTML = '';
    }
    app = null; root = null; R = null; ix = null; ui = null; tl = null;
  }

  window.CookBoard = api;
})();
