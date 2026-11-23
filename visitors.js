/* Optional public country-level counter. Set settings.visitorEndpoint to enable. */
window.startVisitorInsights = async function (settings) {
  'use strict';
  const $ = id => document.getElementById(id);
  const status = message => { $('visitor-status').textContent = message; };
  if (!settings.visitorEndpoint) return;
  $('visitors').hidden = false;
  let endpoint;
  try {
    endpoint = new URL(settings.visitorEndpoint.trim());
    if (endpoint.protocol !== 'https:' || endpoint.search || endpoint.hash || endpoint.username || endpoint.password) throw new Error('Plain HTTPS base URL required');
    endpoint.pathname = endpoint.pathname.replace(/\/$/, '');
  } catch { status('Visitor statistics are unavailable.'); return; }
  if (location.protocol !== 'https:') { status('Visitor statistics are disabled in local previews.'); return; }
  const optedOut = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  const storageKey = 'bappa-visit:' + endpoint.origin;
  let sessionState = '';
  try { sessionState = sessionStorage.getItem(storageKey) || ''; } catch { sessionState = 'storage-unavailable'; }
  let shouldRecord = !optedOut && !sessionState;
  // Mark the attempt before sending. A lost response must not trigger another POST on refresh.
  if (shouldRecord) { try { sessionStorage.setItem(storageKey, 'attempted'); } catch { shouldRecord = false; } }
  status('Loading visitor statistics…');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = endpoint.href.replace(/\/$/, '') + (shouldRecord ? '/visit' : '/stats');
    const response = await fetch(url, {
      method: shouldRecord ? 'POST' : 'GET',
      headers: shouldRecord ? { 'Content-Type': 'application/json' } : {},
      body: shouldRecord ? '{}' : undefined,
      credentials: 'omit', cache: 'no-store', signal: controller.signal
    });
    if (!response.ok) throw new Error('Counter unavailable');
    const data = await response.json();
    if (!Number.isSafeInteger(data.totalVisits) || data.totalVisits < 0 || !Array.isArray(data.countries)) throw new Error('Invalid statistics');
    if (shouldRecord && data.counted === true) {
      try { sessionStorage.setItem(storageKey, 'counted'); } catch { /* no persistent identifier */ }
    }
    $('visit-total').textContent = data.totalVisits.toLocaleString();
    const countries = data.countries;
    const codes = new Set();
    let sum = 0;
    for (const item of countries) {
      if (!item || !/^[A-Z]{2}$/.test(item.code) || !Number.isSafeInteger(item.visits) || item.visits < 1 || codes.has(item.code)) throw new Error('Invalid country statistics');
      codes.add(item.code); sum += item.visits;
    }
    if (!Number.isSafeInteger(sum) || sum !== data.totalVisits) throw new Error('Inconsistent statistics');
    $('country-total').textContent = countries.filter(item => item.code !== 'XX' && item.visits > 0).length.toLocaleString();
    const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
    const countryName = code => code === 'XX' ? 'Unknown location' : (names ? names.of(code) : code);
    const latest = data.lastVisit && new Date(data.lastVisit.at);
    if (latest && Number.isFinite(latest.getTime())) {
      $('last-visit').textContent = `${countryName(data.lastVisit.country)} · ${latest.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`;
      $('last-visit').title = `${latest.toISOString()} (UTC)`;
    } else $('last-visit').textContent = 'No recorded visits yet';
    $('country-list').replaceChildren(...countries.sort((a, b) => b.visits - a.visits).map(item => {
      const chip = document.createElement('span'); chip.className = 'country-chip';
      chip.textContent = `${countryName(item.code)} ${item.visits.toLocaleString()}`; return chip;
    }));
    const since = data.since && new Date(data.since);
    $('visitor-note').textContent = `Approximate countries · recorded visits${since && Number.isFinite(since.getTime()) ? ' since ' + since.toLocaleDateString() : ''}. Counts visits, not unique people or current viewers.`;
    $('visitor-data').hidden = false;
    status(optedOut ? 'Your privacy preference is respected; this visit was not counted.' : 'Country-level activity');
  } catch {
    status('Visitor statistics are temporarily unavailable.');
    $('visitor-data').hidden = true;
  } finally { clearTimeout(timeout); }
};
