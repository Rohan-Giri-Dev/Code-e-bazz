
/* -------------------------------------------------------
   BlueBarrier – script.js
   Adds interactivity & demo logic for the landing page
   Works with: index.html + styles.css you shared
   ------------------------------------------------------- */

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------- 1) Counter Up ----------------------- */
  function animateCounters() {
    const counters = $$('.counter');
    const duration = prefersReducedMotion ? 0 : 1200;

    counters.forEach(el => {
      const target = parseFloat(el.dataset.target || '0');
      if (!duration) {
        el.textContent = target.toLocaleString('en-IN');
        return;
      }
      const start = performance.now();
      function tick(now) {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(eased * target).toLocaleString('en-IN');
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  /* ------------------ 2) Tooltip for markers ------------------- */
  const tooltip = $('#tooltip');
  function showTooltip(e, text) {
    if (!tooltip) return;
    tooltip.style.display = 'block';
    tooltip.textContent = text;
    const { clientX: x, clientY: y } = e;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }
  function hideTooltip() {
    if (tooltip) tooltip.style.display = 'none';
  }

  /* -------------------- 3) Modal helpers ----------------------- */
  const modal = $('#alertModal');
  const modalTitle = $('#modalTitle');
  const modalMessage = $('#modalMessage');
  const closeX = $('.close-modal');

  function openModal(title, message) {
    if (!modal) return;
    modalTitle.textContent = title || 'Details';
    modalMessage.textContent = message || '';
    modal.style.display = 'flex';
  }
  function closeModal() {
    if (!modal) return;
    modal.style.display = 'none';
  }
  window.closeModal = closeModal;

  if (closeX) {
    closeX.addEventListener('click', closeModal);
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  /* --------- 4) Demo data (pin-code => predictive view) -------- */
  // This is mock data purely for the hackathon demo front-end.
  const PINCODE_DATA = {
    '721401': { // Digha / WB coast (example)
      location: 'Digha, West Bengal',
      risk: 'High',
      riskScore: 0.86,
      message: 'Severe storm surge expected within 24H. Evacuation advisory likely.',
      coords: { top: '38%', left: '48%' },
      population: 120000,
      similarZones: ['Mandarmani', 'Shankarpur'],
      next72h: [
        { t: '0–24H', risk: 'High', score: 0.86 },
        { t: '24–48H', risk: 'Medium', score: 0.62 },
        { t: '48–72H', risk: 'Low', score: 0.28 }
      ]
    },
    '600001': { // Chennai GPO
      location: 'Chennai Coast, Tamil Nadu',
      risk: 'Medium',
      riskScore: 0.58,
      message: 'Moderate storm bands offshore; harbour operations on alert.',
      coords: { top: '56%', left: '60%' },
      population: 7100000,
      similarZones: ['Mahabalipuram', 'Pondicherry'],
      next72h: [
        { t: '0–24H', risk: 'Medium', score: 0.58 },
        { t: '24–48H', risk: 'Medium', score: 0.52 },
        { t: '48–72H', risk: 'Low', score: 0.30 }
      ]
    },
    '682001': { // Kochi
      location: 'Kochi Backwaters, Kerala',
      risk: 'Low',
      riskScore: 0.22,
      message: 'Stable conditions with light rainfall expected.',
      coords: { top: '70%', left: '25%' },
      population: 677381,
      similarZones: ['Alappuzha', 'Kollam'],
      next72h: [
        { t: '0–24H', risk: 'Low', score: 0.22 },
        { t: '24–48H', risk: 'Low', score: 0.20 },
        { t: '48–72H', risk: 'Low', score: 0.18 }
      ]
    }
  };

  /* ---------- 5) Simple predictive scoring (demo only) ---------- */
  // Combines vulnerability, exposure, and trend into a score.
  function computeRiskScore({ vulnerability = 0.6, exposure = 0.5, trend = 0.5 }) {
    // Weighted sum with a non-linear bump for rising trends
    const base = 0.5 * vulnerability + 0.35 * exposure + 0.15 * trend;
    const bump = trend > 0.6 ? 0.08 : 0;
    return Math.max(0, Math.min(1, base + bump));
  }
  function scoreToBand(score) {
    if (score >= 0.75) return 'High';
    if (score >= 0.4) return 'Medium';
    return 'Low';
  }

  /* ------------- 6) Map markers & sidebar updates --------------- */
  const map = $('#interactiveMap');
  const sidebar = $('.sidebar .threat-list');
  function clearMarkers() {
    $$('.dynamic-marker', map).forEach(n => n.remove());
  }
  function createMarker({coords, risk, info}) {
    const m = document.createElement('div');
    m.className = `threat-marker dynamic-marker threat-${risk.toLowerCase()}`;
    m.style.top = coords.top;
    m.style.left = coords.left;
    m.dataset.info = info;
    attachMarkerHandlers(m);
    map.appendChild(m);
  }
  function addSidebarItem({risk, location, time='Next 24H'}) {
    const item = document.createElement('div');
    item.className = `threat-item ${risk.toLowerCase()}`;
    item.innerHTML = `
      <div class="threat-type">${risk} Risk</div>
      <div class="threat-location">${location}</div>
      <div class="threat-time">${time}</div>
    `;
    item.addEventListener('click', () => {
      openModal('Threat Details', `${risk} risk for ${location}. ${time}.`);
    });
    sidebar.prepend(item);
  }

  function handlePinSearch(pin) {
    clearMarkers();
    if (!pin || !PINCODE_DATA[pin]) {
      openModal('No Results', 'No coastal threat data found for this PIN code. Try 721401, 600001, or 682001 for the demo.');
      return;
    }
    const data = PINCODE_DATA[pin];
    const info = `${data.risk} Risk - ${data.location} - 0–24H`;
    createMarker({ coords: data.coords, risk: data.risk, info });
    addSidebarItem({ risk: data.risk, location: data.location, time: '0–24H' });

    // Update the three summary cards up top as a quick "analytical core" view
    const [lowEl, popEl, highEl] = $$('.status-value');
    if (lowEl && popEl && highEl) {
      const highPop = Math.round((data.population || 0) * data.riskScore);
      const lowCount = data.risk === 'Low' ? 1 : 0;
      lowEl.textContent = lowCount.toString();
      popEl.textContent = (data.population || 0).toLocaleString('en-IN');
      highEl.textContent = highPop.toLocaleString('en-IN');
    }

    // Also append a predictive 72H summary into the alerts panel
    const panel = $('.alerts-panel');
    if (panel) {
      data.next72h.forEach(seg => {
        const el = document.createElement('div');
        el.className = `alert-item ${seg.risk.toLowerCase()}`;
        el.innerHTML = `
          <div class="alert-time">${seg.t}</div>
          <div class="alert-message">Predicted ${seg.risk} Risk (${Math.round(seg.score*100)}%) - ${data.location}</div>
          <div class="alert-status">${seg.risk}</div>
        `;
        panel.appendChild(el);
      });
    }

    openModal('Localized Prediction',
      `${data.location}\n\nRisk: ${data.risk} (${Math.round(data.riskScore*100)}%)\n` +
      `Message: ${data.message}\n` +
      `Similar Zones: ${data.similarZones.join(', ')}\n` +
      `Use the buttons on the right to simulate targeted alerts.`
    );
  }

  /* ------------- 7) Attach handlers to markers ------------------ */
  function attachMarkerHandlers(marker) {
    marker.addEventListener('mouseenter', (e) => showTooltip(e, marker.dataset.info || ''));
    marker.addEventListener('mousemove', (e) => showTooltip(e, marker.dataset.info || ''));
    marker.addEventListener('mouseleave', hideTooltip);
    marker.addEventListener('click', () => {
      openModal('Threat Details', marker.dataset.info || '');
    });
  }
  $$('.threat-marker').forEach(attachMarkerHandlers);

  /* ------------------ 8) Search interactions -------------------- */
  const pinInput = $('.pin-search');
  const pinBtn = $('.search-btn');
  if (pinBtn && pinInput) {
    pinBtn.addEventListener('click', () => handlePinSearch(pinInput.value.trim()));
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePinSearch(pinInput.value.trim());
      }
    });
  }

  /* --------- 9) Trigger Public / SMS announcements (demo) ------- */
  const [btnPA, btnSMS] = $$('.trigger-btn');
  if (btnPA) {
    btnPA.addEventListener('click', () => {
      openModal('Public Announcement Queued', 'Simulated: PA system will broadcast multilingual alert in coastal village clusters.');
      speakMessage('Public announcement: coastal warning issued. Please move to higher ground.');
    });
  }
  if (btnSMS) {
    btnSMS.addEventListener('click', () => {
      const pin = (pinInput && pinInput.value.trim()) || 'your area';
      openModal('Targeted SMS Alert', `Simulated: Hyper-local SMS alert dispatched for PIN code ${pin}.`);
    });
  }

  /* --------- 10) Multilingual IVR / WhatsApp voice demo ---------- */
  // Click the "Example alert" card to speak a Telugu message (if supported)
  const example = $('.example-alert');
  if (example) {
    example.style.cursor = 'pointer';
    example.title = 'Click to hear a sample Telugu voice alert';
    example.addEventListener('click', () => {
      // Attempt Telugu; fallback to English
      const msg = 'హెచ్చరిక: వచ్చే 30 సెకన్లలో సముద్ర అలల తీవ్రత పెరుగుతోంది. దయచేసి సురక్షిత ప్రాంతానికి వెళ్లండి.';
      speakMessage(msg, 'te-IN');
    });
  }

  function speakMessage(text, langPref) {
    try {
      if (!('speechSynthesis' in window)) return;
      const utter = new SpeechSynthesisUtterance(text);
      const voices = speechSynthesis.getVoices();
      // Pick a voice by lang if available
      const preferred = voices.find(v => v.lang === langPref) ||
                        voices.find(v => v.lang && v.lang.startsWith(langPref?.split('-')[0] || '')) ||
                        voices.find(v => v.lang === 'en-IN') ||
                        voices.find(v => v.lang && v.lang.startsWith('en')) ||
                        null;
      if (preferred) utter.voice = preferred;
      utter.rate = 1;
      speechSynthesis.speak(utter);
    } catch {}
  }
  // Some browsers need a deferred getVoices() population
  if ('speechSynthesis' in window) {
    speechSynthesis.onvoiceschanged = () => {};
  }

  /* ------------------- 11) Contact form UX ---------------------- */
  const contactForm = $('#contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      openModal('Request Received', 'Thanks! Our team will reach out with dashboard access details.');
      contactForm.reset();
    });
  }

  /* ------------------- 12) Mobile menu toggle ------------------- */
  const burger = $('.mobile-menu-toggle');
  const navLinks = $('.nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      const expanded = navLinks.getAttribute('data-expanded') === 'true';
      navLinks.setAttribute('data-expanded', String(!expanded));
      navLinks.style.display = expanded ? 'none' : 'flex';
      navLinks.style.flexDirection = 'column';
      navLinks.style.gap = '0.75rem';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '60px';
      navLinks.style.right = '5vw';
      navLinks.style.background = 'rgba(10,15,26,.95)';
      navLinks.style.padding = '.75rem 1rem';
      navLinks.style.border = '1px solid rgba(255,255,255,.08)';
      navLinks.style.borderRadius = '12px';
      navLinks.style.boxShadow = '0 10px 32px rgba(0,0,0,.35)';
    });
  }
  /* ---------- Coastal Forecast (India) block ---------- */
(function(){
  const fmt = (n)=> (typeof n==='number' ? n.toLocaleString('en-IN') : n);

  // Demo forecast data (coastal-only)
  const COAST_FORECAST = {
    windowDays: 3,
    forecastCount: 6,
    populationAtRisk: 20000000,
    markers: [
      { top: 0.62, left: 0.28, band:'low',  title:'Kerala Backwaters – Low' },
      { top: 0.66, left: 0.33, band:'med',  title:'Mangalore – Medium' },
      { top: 0.72, left: 0.45, band:'med',  title:'Mumbai Coast – Medium' },
      { top: 0.50, left: 0.74, band:'high', title:'Odisha/Sundarbans – High' },
      { top: 0.58, left: 0.68, band:'med',  title:'Chennai Coast – Medium' },
      { top: 0.56, left: 0.60, band:'low',  title:'Puducherry – Low' }
    ],
    history: [
      { id:1, event:'Storm Surge', region:'Sundarbans Delta', when:'Last 24H', sev:'high', status:'Open' },
      { id:2, event:'High Flood Risk', region:'Chennai Coast', when:'48H', sev:'med', status:'Monitoring' },
      { id:3, event:'Coastal Erosion', region:'Kochi', when:'7d', sev:'low', status:'Resolved' }
    ]
  };

  /* 1) Paint headline numbers */
  const elForecast = document.getElementById('cfForecastCount');
  const elPop      = document.getElementById('cfPopulationAtRisk');
  const elWindow   = document.getElementById('cfDaysWindow');
  if (elForecast && elPop && elWindow) {
    elForecast.textContent = fmt(COAST_FORECAST.forecastCount);
    elPop.textContent      = fmt(COAST_FORECAST.populationAtRisk);
    elWindow.textContent   = fmt(COAST_FORECAST.windowDays);
  }

  /* 2) Markers on SVG (normalized positions) */
  const g = document.getElementById('cfMarkers');
  if (g) {
    COAST_FORECAST.markers.forEach(m => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r','6');
      c.setAttribute('cx', String(700 * m.left));
      c.setAttribute('cy', String(800 * m.top));
      c.setAttribute('class', `cf-marker ${m.band}`);
      c.setAttribute('data-info', m.title);
      c.addEventListener('mouseenter', (e)=> {
        const t = document.getElementById('tooltip');
        if (!t) return;
        t.style.display='block';
        t.textContent = m.title;
        t.style.left = e.clientX + 'px';
        t.style.top  = e.clientY + 'px';
      });
      c.addEventListener('mousemove', (e)=> {
        const t = document.getElementById('tooltip');
        if (!t) return;
        t.style.left = e.clientX + 'px';
        t.style.top  = e.clientY + 'px';
      });
      c.addEventListener('mouseleave', ()=> {
        const t = document.getElementById('tooltip');
        if (t) t.style.display='none';
      });
      c.addEventListener('click', ()=> {
        if (window.openModal) window.openModal('Threat Details', m.title + ' (forecast window: ' + COAST_FORECAST.windowDays + ' days)');
      });
      g.appendChild(c);
    });
  }

  /* 3) History table */
  const tbody = document.querySelector('#cfHistoryTable tbody');
  if (tbody) {
    tbody.innerHTML = '';
    COAST_FORECAST.history.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.id}</td>
        <td>${row.event}</td>
        <td>${row.region}</td>
        <td>${row.when}</td>
        <td><span class="cf-badge ${row.sev}">${row.sev.toUpperCase()}</span></td>
        <td>${row.status}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* 4) Make sure NO SQL-injection alerts show inside any section */
  document.querySelectorAll('.alert-item .alert-message').forEach(msg => {
    if (msg.textContent.toLowerCase().includes('sql injection')) {
      const card = msg.closest('.alert-item');
      if (card) card.remove();
    }
  });
})();


  /* ------------------- 13) Hero progressive fade ---------------- */
  // Progressive reveal for elements with .fade-in as they enter viewport
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          entry.target.style.animationDelay = `${Math.random() * 0.3}s`;
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18 });
    $$('.fade-in').forEach(el => io.observe(el));
  } else {
    // No animation
    $$('.fade-in').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });
  }

  /* ------------------- 14) Kick things off ---------------------- */
  window.addEventListener('DOMContentLoaded', animateCounters);
  // Run immediately too (some browsers delay DOMContentLoaded if placed at bottom)
  animateCounters();

})();
