/* Layout behavior only. Edit the text, links, lists, and dates in content.json. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const node = (tag, text = '', className = '') => {
    const element = document.createElement(tag);
    if (text !== '') element.textContent = String(text);
    if (className) element.className = className;
    return element;
  };
  const list = value => Array.isArray(value) ? value : [];
  const safeUrl = value => {
    try {
      if (typeof value !== 'string' || !value.trim()) return '';
      const url = new URL(value.trim(), location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  const external = (label, value, className = '') => {
    const url = safeUrl(value);
    const element = node(url ? 'a' : 'span', label, className);
    if (url) Object.assign(element, { href: url, target: '_blank', rel: 'noopener noreferrer' });
    return element;
  };
  const text = (id, value) => { if ($(id)) $(id).textContent = value || ''; };
  const replace = (id, children) => $(id).replaceChildren(...children);
  const dateKey = value => /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value || '') ? value : '';
  const dateLabel = item => item.dateLabel || item.date || '';

  function setupNavigation() {
    document.documentElement.classList.replace('no-js', 'js');
    const button = $('menu-toggle'), menu = $('primary-menu');
    const setOpen = open => {
      menu.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
    };
    button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
    document.addEventListener('click', event => {
      if (!event.target.closest('.top-nav')) setOpen(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
        setOpen(false); button.focus();
      }
    });
    document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener('click', () => {
      const fromMenu = menu.contains(link) && button.getAttribute('aria-expanded') === 'true';
      setOpen(false);
      if (fromMenu) {
        const target = $(link.hash.slice(1));
        if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
      }
    }));
    const media = window.matchMedia('(min-width: 52.01rem)');
    media.addEventListener('change', () => setOpen(false));
    const header = document.querySelector('.site-header');
    const measureHeader = () => document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`);
    measureHeader();
    if (typeof ResizeObserver === 'function') new ResizeObserver(measureHeader).observe(header);
    else window.addEventListener('resize', measureHeader);
    const markCurrent = () => document.querySelectorAll('.nav-links a[href^="#"]').forEach(link => {
      if (link.hash === (location.hash || '#about')) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    window.addEventListener('hashchange', markCurrent);
    markCurrent();
    text('year', new Date().getFullYear());
  }

  function renderProfile(profile, links) {
    $('profile-name').replaceChildren(document.createTextNode(profile.name + ' '), node('span', profile.degree, 'degree'));
    text('profile-role', profile.role);
    $('profile-affiliation').replaceChildren(external(profile.department, profile.departmentUrl), node('br'), external(profile.institution, profile.institutionUrl));
    const portrait = safeUrl(profile.portrait);
    if (portrait) $('portrait').src = portrait;
    $('portrait').alt = profile.name;
    replace('biography', list(profile.bio).map(paragraph => node('p', paragraph)));
    replace('profile-links', list(profile.relatedLinks).filter(item => safeUrl(item.url)).map(item => external(item.label, item.url)));
    const profiles = [
      ['scholar', 'Google Scholar', 'google-scholar4372.png'], ['linkedin', 'LinkedIn', 'LinkedIn_logo_initials.png'],
      ['github', 'GitHub', 'GitHub-logo.png'], ['researchgate', 'ResearchGate', 'ResearchGate_icon.png'],
      ['orcid', 'ORCID', 'ORCID_iD.png'], ['twitter', 'X / Twitter', 'twitter-x-app.png']
    ];
    replace('social-links', profiles.filter(([key]) => safeUrl(links[key])).map(([key, label, filename]) => {
      const link = external('', links[key]);
      link.setAttribute('aria-label', label); link.title = label;
      const img = node('img'); Object.assign(img, { src: `images/${filename}`, alt: '', width: 30, height: 30 });
      link.append(img); return link;
    }));
  }

  function renderUpdates(items) {
    const active = list(items).filter(item => item.active !== false).sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)));
    const render = item => {
      const li = node('li', '', 'update'), time = node('time', dateLabel(item));
      if (dateKey(item.date)) time.dateTime = item.date;
      const body = node('div'), heading = node('h3');
      heading.append(external(item.title, item.url)); body.append(heading);
      if (item.detail) body.append(node('p', item.detail));
      li.append(time, body); return li;
    };
    replace('updates-list', active.slice(0, 7).map(render));
    replace('updates-archive', active.slice(7).map(render));
    $('updates-more').hidden = active.length <= 7;
    text('updates-count', active.length ? `Latest ${Math.min(7, active.length)}` : 'More news soon');
    text('updates-more-label', `See more updates (${Math.max(0, active.length - 7)})`);
  }

  function renderResearch(categories) {
    replace('research-list', list(categories).map(category => {
      const group = node('article', '', 'research-group');
      if (/^[a-z][a-z0-9-]*$/.test(category.id || '')) group.id = `research-${category.id}`;
      group.append(node('h3', category.title));
      if (category.description) group.append(node('p', category.description, 'research-description'));
      const ul = node('ul', '', 'document-list');
      list(category.documents).forEach(item => {
        const primary = safeUrl(item.url), fallback = safeUrl(item.fallbackUrl);
        const li = node('li'); li.append(external(item.title, primary || fallback, 'document-title'));
        if (!primary && fallback && item.fallbackLabel) li.append(node('span', item.fallbackLabel, 'document-source'));
        if (item.detail) li.append(node('p', item.detail, 'document-detail'));
        ul.append(li);
      });
      group.append(ul);
      return group;
    }));
  }

  function renderPublications(items) {
    const publications = list(items).slice().sort((a, b) => Number(b.year) - Number(a.year));
    const selected = publications.filter(item => item.selected);
    const featured = selected.length ? selected : publications.slice(0, 3);
    const rest = publications.filter(item => !featured.includes(item));
    const render = item => {
      const li = node('li', '', 'publication'), body = node('div'), title = node('h3');
      title.append(external(item.title, item.url));
      const authors = node('p', '', 'authors');
      String(item.authors || '').split(/(B\. Ghosh|Bappa Ghosh)/g).forEach(part => {
        authors.append(/^(B\. Ghosh|Bappa Ghosh)$/.test(part) ? node('strong', part) : document.createTextNode(part));
      });
      body.append(title, authors, node('p', item.journal, 'journal'));
      li.append(node('span', item.year, 'publication-year'), body); return li;
    };
    replace('publications-list', featured.map(render));
    replace('publications-archive', rest.map(render));
    $('publications-more').hidden = !rest.length;
    text('publications-more-label', `See all publications (${publications.length})`);
  }

  function renderTimeline(items) {
    replace('timeline-list', list(items).map(item => {
      const li = node('li', '', 'timeline-item'), body = node('div');
      body.append(node('h3', item.title));
      const institution = node('p', '', 'timeline-institution');
      institution.append(external(item.institution, item.url));
      if (item.location) institution.append(document.createTextNode(` · ${item.location}`));
      body.append(institution);
      if (item.detail) body.append(node('p', item.detail, 'timeline-detail'));
      li.append(node('span', item.period, 'timeline-period'), body); return li;
    }));
  }

  function renderContact(links) {
    const schedule = safeUrl(links.schedule);
    $('schedule-link').hidden = !schedule;
    if (schedule) $('schedule-link').href = schedule;
    const cv = safeUrl(links.cvDriveUrl);
    $('cv-link').hidden = !cv;
    $('cv-pending').hidden = Boolean(cv);
    if (cv) $('cv-link').href = cv;
  }

  function startAnalytics(settings) {
    const measurement = settings.ga4MeasurementId || '';
    const optedOut = navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
    const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname) || location.protocol !== 'https:';
    if (!optedOut && !isLocal && /^G-[A-Z0-9]+$/.test(measurement)) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', measurement, { allow_google_signals: false, allow_ad_personalization_signals: false });
      const script = node('script'); script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurement)}`;
      document.head.append(script);
    }
    if (typeof window.startVisitorInsights === 'function') window.startVisitorInsights(settings);
  }

  async function init() {
    setupNavigation();
    try {
      const embedded = $('site-data');
      const data = embedded ? JSON.parse(embedded.textContent) : await fetch('content.json', { cache: 'no-cache' }).then(response => {
        if (!response.ok) throw new Error('Content unavailable');
        return response.json();
      });
      renderProfile(data.profile, data.links);
      renderUpdates(data.updates); renderResearch(data.researchCategories);
      renderPublications(data.publications); renderTimeline(data.timeline);
      renderContact(data.links);
      startAnalytics(data.settings || {});
      document.documentElement.dataset.contentReady = 'true';
      // Re-align a direct section link after editable content has expanded the page.
      if (location.hash) requestAnimationFrame(() => {
        let id = location.hash.slice(1);
        try { id = decodeURIComponent(id); } catch { /* Preserve malformed anchors as literal text. */ }
        const target = $(id);
        if (target) target.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    } catch (error) {
      $('load-message').hidden = false;
      text('load-message', location.protocol === 'file:'
        ? 'For a local preview, open PREVIEW.html. The editable website loads normally on GitHub Pages.'
        : 'The latest website content could not be loaded. Please refresh the page.');
      console.error('Website content:', error);
    }
  }
  init();
})();
