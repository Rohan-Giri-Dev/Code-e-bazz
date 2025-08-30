
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
// ====== Coastal Threat Map (Leaflet) ======
(function () {
  // --- tiny coastal nodes dataset (extend as needed) ---
  const COAST_NODES = [
    { id:"kandla", name:"Kandla / Kutch", state:"Gujarat",        lat:23.05,  lng:70.22, popAtRisk:320000 },
    { id:"mumbai", name:"Mumbai Coast",   state:"Maharashtra",    lat:19.076, lng:72.877, popAtRisk:2500000 },
    { id:"ratnagiri", name:"Ratnagiri",   state:"Maharashtra",    lat:16.991, lng:73.31,  popAtRisk:240000 },
    { id:"goa",    name:"Mormugao",       state:"Goa",            lat:15.389, lng:73.815, popAtRisk:180000 },
    { id:"karwar", name:"Karwar",         state:"Karnataka",      lat:14.813, lng:74.129, popAtRisk:160000 },
    { id:"kochi",  name:"Kochi",          state:"Kerala",         lat:9.931,  lng:76.267, popAtRisk:850000 },
    { id:"tvm",    name:"Thiruvananthapuram", state:"Kerala",     lat:8.524,  lng:76.936, popAtRisk:520000 },
    { id:"tuticorin", name:"Thoothukudi", state:"Tamil Nadu",     lat:8.764,  lng:78.134, popAtRisk:410000 },
    { id:"chennai", name:"Chennai",       state:"Tamil Nadu",     lat:13.0827,lng:80.2707,popAtRisk:2900000 },
    { id:"pdy",    name:"Puducherry",     state:"Puducherry",     lat:11.916, lng:79.812, popAtRisk:240000 },
    { id:"nellore", name:"Nellore",       state:"Andhra Pradesh", lat:14.4426,lng:79.9865,popAtRisk:390000 },
    { id:"vizag",  name:"Visakhapatnam",  state:"Andhra Pradesh", lat:17.6868,lng:83.2185,popAtRisk:1600000 },
    { id:"kakinada", name:"Kakinada",     state:"Andhra Pradesh", lat:16.9891,lng:82.2475,popAtRisk:470000 },
    { id:"gopalpur", name:"Gopalpur",     state:"Odisha",         lat:19.263, lng:84.92,  popAtRisk:120000 },
    { id:"paradip", name:"Paradip",       state:"Odisha",         lat:20.316, lng:86.611, popAtRisk:210000 },
    { id:"digha",  name:"Digha",          state:"West Bengal",    lat:21.626, lng:87.509, popAtRisk:140000 },
    { id:"haldia", name:"Haldia",         state:"West Bengal",    lat:22.066, lng:88.069, popAtRisk:670000 },
    { id:"diamond",name:"Diamond Harbour",state:"West Bengal",    lat:22.191, lng:88.190, popAtRisk:360000 },
    { id:"portblair", name:"Port Blair",  state:"Andaman & Nicobar", lat:11.623, lng:92.726, popAtRisk:140000 }
  ];

  // --- seeded random (so the same place yields stable demo numbers) ---
  function hash(s){let h=0; for(let i=0;i<s.length;i++){h=(h<<5)-h+s.charCodeAt(i); h|=0;} return Math.abs(h);}
  function rng(seed){let x = seed % 2147483647; if (x <= 0) x += 2147483646; return ()=> (x = x * 16807 % 2147483647) / 2147483647; }

  // --- simple "training features" generator (replace with your real model/data) ---
  function getFeaturesForNode(nodeId, dayIdx, r) {
    // dayIdx: 0..6 (today..+6)
    // Return plausible drivers: wind (km/h), tide (m), humidity (%)
    const base =  r()*0.7 + (nodeId.length % 3)*0.15;
    return {
      wind: Math.round(20 + 60*base + dayIdx*0.7),      // 20–100
      tide: +(0.5 + 2.8*base).toFixed(2),               // 0.5–3.3 m
      humidity: Math.round(60 + 40*base),               // 60–100 %
      stormProb: +(0.05 + 0.6*base).toFixed(2)          // 0.05–0.65
    };
  }

  // --- risk model (transparent & tweakable) ---
  function riskScore(features){
    // weights: wind 0.4, tide 0.3, humidity 0.2, stormProb 0.1
    const w = features.wind/100, t = features.tide/3.5, h = features.humidity/100, s = features.stormProb;
    const score = 0.4*w + 0.3*t + 0.2*h + 0.1*s;        // 0–1.0+
    return Math.min(1, score);
  }
  function band(score){ return score >= 0.66 ? "Alert" : score >= 0.4 ? "Watch" : "Safe"; }
  function bandClass(b){ return b==="Alert"?"badge-alert":b==="Watch"?"badge-watch":"badge-safe"; }
  function colorFor(b){ return b==="Alert"?"#ff4d4f":b==="Watch"?"#ffb020":"#2ecc71"; }

  // --- 7-day forecast + synthetic history ---
  function makeForecast(node){
    const seed = hash(node.id);
    const r = rng(seed);
    const days = [];
    for (let i=0;i<7;i++){
      const f = getFeaturesForNode(node.id, i, r);
      const score = riskScore(f);
      const b = band(score);
      days.push({
        day: new Date(Date.now()+ i*24*3600*1000),
        band: b,
        color: colorFor(b),
        drivers: f,
        score: +score.toFixed(2)
      });
    }
    return days;
  }
  function makeHistory(node){
    const seed = hash(node.id+"-history");
    const r = rng(seed);
    const labels = ["Storm surge","Cyclone warning","High tide flooding","Tsunami advisory","Coastal erosion"];
    const notes  = [
      "Wind ↑ & Tide ↑",
      "Humidity ↑, Wind ↑",
      "Tide peak around midnight",
      "Unusual swell patterns",
      "Monsoon + rough sea"
    ];
    const rows = [];
    for (let k=0;k<6;k++){
      const d = new Date(Date.now() - (k+1)*7*24*3600*1000);
      rows.push({
        date: d.toISOString().slice(0,10),
        label: labels[Math.floor(r()*labels.length)],
        note: notes[Math.floor(r()*notes.length)]
      });
    }
    return rows;
  }

  // --- Leaflet map ---
  const map = L.map('crMap', { zoomControl: true, attributionControl: false })
               .setView([20.5937, 78.9629], 5); // India center
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  // --- UI refs ---
  const elPlace   = document.getElementById('crPlace');
  const elStatus  = document.getElementById('crStatus');
  const elWindow  = document.getElementById('crWindow');
  const elNearest = document.getElementById('crNearest');
  const elPop     = document.getElementById('crPop');
  const tbForecast= document.querySelector('#crForecastTable tbody');
  const tbHistory = document.querySelector('#crHistoryTable tbody');

  function km(a,b){ return map.distance([a.lat, a.lng], [b.lat, b.lng]) / 1000; }
  function nearestNode(lat, lng){
    let best = null, dmin = Infinity;
    for (const n of COAST_NODES){
      const d = map.distance([lat,lng],[n.lat,n.lng]);
      if (d < dmin){ dmin = d; best = n; }
    }
    return { node: best, distKm: dmin/1000 };
  }

  function renderSelection(node, clickedLatLng){
    const forecast = makeForecast(node);
    const hist = makeHistory(node);

    // Status = today's band
    const today = forecast[0];
    elPlace.textContent = `${node.name}, ${node.state}`;
    elStatus.textContent = today.band;
    elStatus.className = `badge ${bandClass(today.band)}`;
    elWindow.textContent = "7 days";
    elNearest.textContent = `${node.name}`;
    elPop.textContent = node.popAtRisk.toLocaleString('en-IN');

    // Forecast table
    tbForecast.innerHTML = "";
    forecast.forEach(d=>{
      const dayName = d.day.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${dayName}</td>
        <td><span style="font-weight:700; color:${d.color}">${d.band}</span></td>
        <td>Wind ${d.drivers.wind} km/h · Tide ${d.drivers.tide} m · Humid ${d.drivers.humidity}%</td>
      `;
      tbForecast.appendChild(tr);
    });

    // History table
    tbHistory.innerHTML = "";
    hist.forEach(h=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${h.date}</td><td>${h.label}</td><td>${h.note}</td>`;
      tbHistory.appendChild(tr);
    });

    // If selection came from click, add/refresh a marker ping
    if (clickedLatLng){
      if (window.__crClickMarker) map.removeLayer(window.__crClickMarker);
      window.__crClickMarker = L.circleMarker(clickedLatLng, {
        radius: 7, weight: 2, color: today.color, fillColor: today.color, fillOpacity: 0.4
      }).addTo(map).bindPopup(`<strong>${node.name}</strong><br/>Status: <b style="color:${today.color}">${today.band}</b>`).openPopup();
    }
  }

  // Add coastal nodes as color-coded markers (band = today)
  const markersLayer = L.layerGroup().addTo(map);
  COAST_NODES.forEach(n=>{
    const todayBand = makeForecast(n)[0].band;
    const marker = L.circleMarker([n.lat, n.lng], {
      radius: 6,
      weight: 1.5,
      color: colorFor(todayBand),
      fillColor: colorFor(todayBand),
      fillOpacity: .6
    })
    .addTo(markersLayer)
    .bindTooltip(`${n.name}: ${todayBand}`, { direction:'top' })
    .on('click', () => renderSelection(n, [n.lat, n.lng]));
  });

  // Map click anywhere -> snap to nearest coastal node within 120 km
  map.on('click', (e)=>{
    const { lat, lng } = e.latlng;
    const near = nearestNode(lat, lng);
    if (near && near.distKm <= 120) {
      renderSelection(near.node, e.latlng);
    } else {
      elPlace.textContent = "Outside coastal buffer";
      elStatus.textContent = "—"; elStatus.className = "badge badge-muted";
      elNearest.textContent = "—"; elPop.textContent = "—";
      tbForecast.innerHTML = ""; tbHistory.innerHTML = "";
    }
  });

  // --- PIN code search (Nominatim) ---
  async function locateByPincode(pin){
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=in&q=${encodeURIComponent(pin)}`;
    const res = await fetch(url, { headers: { 'Accept-Language':'en' }});
    const data = await res.json();
    if (!Array.isArray(data) || data.length===0) throw new Error("PIN not found");
    // take the best hit
    const { lat, lon } = data[0];
    const latNum = parseFloat(lat), lonNum = parseFloat(lon);
    map.setView([latNum, lonNum], 9);
    const near = nearestNode(latNum, lonNum);
    if (near && near.distKm <= 120) {
      renderSelection(near.node, [latNum, lonNum]);
    } else {
      elPlace.textContent = "PIN located (inland) — nearest coast >120 km";
      elStatus.textContent = "—"; elStatus.className = "badge badge-muted";
      elNearest.textContent = "—"; elPop.textContent = "—";
      tbForecast.innerHTML = ""; tbHistory.innerHTML = "";
    }
  }

  document.getElementById('crFindBtn').addEventListener('click', async ()=>{
    const pin = (document.getElementById('crPincode').value || "").trim();
    if (pin.length !== 6) { alert("Enter a valid 6-digit PIN code"); return; }
    try { await locateByPincode(pin); } 
    catch(e){ alert("Could not locate that PIN code. Try another."); }
  });

  // Initial focus: zoom to India; preselect Chennai for demo
  const chennai = COAST_NODES.find(n=>n.id==="chennai");
  if (chennai) renderSelection(chennai, [chennai.lat, chennai.lng]);
})();
