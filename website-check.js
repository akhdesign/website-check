/* ah design · Website-Check · Frontend-Engine v2.3 (Lumos)
   Hooks (Custom Attributes):
     [data-wc="check"]      Section-Wrapper (Root, alles darin)
     [data-wc="form"]       <form>, data-wc-api="https://…workers.dev" (oder "demo")
     [data-wc="input"]      URL-Feld · [data-wc="form-error"] Fehlertext
     [data-wc="result"]     leerer Container für das Ergebnis
     [data-wc="templates"]  versteckte Vorlagen mit [data-tpl="…"]
     [data-wc="progress"]   Ladebalken (is-active = sichtbar) mit progress-bar / progress-status / progress-time
     [data-wc="ready"]      fixe Pille „Ihr Ergebnis ist fertig ↓“ (is-active = sichtbar) */
(function boot() {
  if (!window.gsap) {
    if (document.readyState !== 'complete') window.addEventListener('load', boot, { once: true });
    else console.warn('[website-check] GSAP fehlt – in Webflow unter Site Settings → GSAP aktivieren.');
    return;
  }
  if (window.__wcStarted) return;
  const root = document.querySelector('[data-wc="check"]');
  if (!root) return;
  window.__wcStarted = true;
  const gsap = window.gsap;

  const $ = (k, scope) => (scope || root).querySelector(`[data-wc="${k}"]`);
  const tplRoot = $('templates');
  const tpl = name => {
    const t = tplRoot && tplRoot.querySelector(`[data-tpl="${name}"]`);
    if (!t) throw new Error(`[website-check] Template "${name}" fehlt`);
    const c = t.cloneNode(true);
    c.removeAttribute('data-tpl');
    return c;
  };
  const text = (el, v) => { if (el) el.textContent = v == null ? '' : String(v); return el; };
  const clear = el => { while (el && el.firstChild) el.removeChild(el.firstChild); };
  // Behält nur die Variante mit der passenden Combo-Klasse (z. B. is-ok) und entfernt die anderen
  const keepVariant = (parent, cls, variants, want) => parent.querySelectorAll(`.${cls}`).forEach(el => {
    const match = variants.find(v => el.classList.contains(v)) || '';
    if (match !== want) el.remove();
  });

  const form = $('form'), input = $('input'), btn = form && form.querySelector('[type="submit"]');
  const errEl = $('form-error'), resultEl = $('result');
  const API = (form && form.dataset.wcApi || '').replace(/\/$/, '');
  const P = {
    steps: [...($('steps')?.children || [])], url: $('url'), stage: $('stage'), wire: $('wire'), beam: $('beam'), img: $('img'),
    annos: $('annos'), notes: $('notes'), noteList: $('note-list'), answer: $('answer'), engine: $('engine'),
    q: $('q'), ans: $('ans'), verdict: $('verdict'), status: $('status'), mode: $('mode'),
  };
  if (!P.wire || !tplRoot) return;
  const blocks = () => root.querySelectorAll('[data-wc="block"], [data-wc="img"]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = s => (reduce ? 0.01 : s);
  const STATUS = ['is-ok', 'is-warn', 'is-fail'];
  const ICON = { ok: '✓', warn: '!', fail: '✕' };
  const scrollTo = el => {
    if (window.lenis && typeof window.lenis.scrollTo === 'function') window.lenis.scrollTo(el, { offset: -120, immediate: reduce });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };
  const setBusy = (b, busy) => { if (!b) return; b.disabled = busy; b.setAttribute('aria-busy', busy ? 'true' : 'false'); gsap.to(b, { opacity: busy ? 0.55 : 1, duration: 0.2 }); };

  // ---------- Laufsteuerung ----------
  let run = 0;
  const live = new Set();
  const track = t => { live.add(t); return t; };
  function interrupt() { run++; live.forEach(t => t.kill()); live.clear(); }
  const play = tl => new Promise(res => { track(tl); tl.eventCallback('onComplete', () => { live.delete(tl); res(); }); });
  const wait = s => play(gsap.timeline().to({}, { duration: D(s) }));
  const typeTo = (el, str, dur) => {
    const o = { n: 0 }; el.textContent = '';
    return gsap.to(o, { n: str.length, duration: D(dur), ease: 'none', onUpdate() { el.textContent = str.slice(0, Math.round(o.n)); } });
  };
  // Fortschrittsbalken: alle Schritte bis i sind aktiv
  const setStep = i => P.steps.forEach((s, k) => s.classList.toggle('is-active', k <= i));

  function verdict(good, title, body) {
    clear(P.verdict);
    const v = tpl(good ? 'verdict-good' : 'verdict');
    text(v.querySelector('.check_verdict_title'), title);
    text(v.querySelector('.check_verdict_text'), body);
    P.verdict.appendChild(v);
    return v;
  }

  function resetPanel(mode) {
    setStep(0);
    text(P.url, ''); clear(P.annos); clear(P.noteList); text(P.q, ''); clear(P.ans); clear(P.verdict);
    text(P.img, 'Inhalt'); text(P.mode, mode); text(P.status, 'Gleiche Frage auch an Perplexity');
    gsap.set(P.wire, { clearProps: 'display' });
    gsap.set([P.stage, P.wire], { autoAlpha: 1, scale: 1 });
    gsap.set(P.notes, { autoAlpha: 0, y: 14 });
    gsap.set(P.answer, { autoAlpha: 0.3 });
    gsap.set(blocks(), { scaleX: 0 });
    gsap.set(P.beam, { opacity: 0 });
  }

  // ---------- Event-Handler (Demo-Loop und echter Check) ----------
  const H = {
    async start(ev, c) {
      resetPanel(c.live ? 'Live-Check' : 'Beispiel');
      c.domain = ev.domain || ev.url;
      const tl = gsap.timeline();
      tl.add(typeTo(P.url, c.domain, 0.6));
      tl.to(blocks(), { scaleX: 1, duration: D(0.35), stagger: D(0.035), ease: 'power2.out' });
      await play(tl);
      c.beam = track(gsap.fromTo(P.beam, { top: '-2.875rem', opacity: 1 }, { top: '100%', duration: D(1.6), ease: 'none', repeat: -1 }));
    },
    async read(ev, c) {
      const list = ['index', 'ai', 'schema', 'read'].map(k => ev.checks.find(x => x.key === k)).filter(Boolean);
      list.forEach(x => {
        const a = tpl('anno');
        text(a.querySelector('.check_anno_title'), x.label);
        keepVariant(a, 'check_anno_status', STATUS, 'is-' + x.status);
        text(a.querySelector('.check_anno_status'), `${ICON[x.status] || ''} ${x.detail || ''}`.trim());
        P.annos.appendChild(a);
      });
      const items = [...P.annos.children];
      gsap.set(items, { autoAlpha: 0, x: -10 });
      if (!c.live) await wait(0.8);
      await play(gsap.timeline().to(items, { autoAlpha: 1, x: 0, duration: D(0.35), stagger: D(0.45), ease: 'power2.out' }));
      if (c.beam) c.beam.kill();
      gsap.to(P.beam, { opacity: 0, duration: D(0.3) });
      await wait(0.6);
    },
    async understood(ev, c) {
      const u = ev.understood || {};
      c.understood = u;
      const fields = u.fields && u.fields.length ? u.fields
        : [{ label: 'Unternehmen', value: u.name || null }, { label: 'Branche', value: u.branche || null }, { label: 'Ort', value: u.ort || null }];
      c.missing = fields.filter(f => !f.value).map(f => f.label);
      const rows = fields.map(f => {
        const r = tpl('note');
        text(r.querySelector('.check_note_label'), f.label);
        (f.value ? r.querySelector('.check_note_miss') : r.querySelector('.check_note_value')).remove();
        P.noteList.appendChild(r);
        return { r, f, out: r.querySelector(f.value ? '.check_note_value' : '.check_note_miss') };
      });
      setStep(1);
      gsap.set(rows.map(x => x.r), { autoAlpha: 0 });
      const tl = gsap.timeline();
      tl.to(P.wire, { autoAlpha: 0, scale: 0.97, duration: D(0.4) });
      tl.set(P.wire, { display: 'none' }); // kein leerer Platz unter den Notizen (v. a. am Handy)
      tl.to(P.notes, { autoAlpha: 1, y: 0, duration: D(0.4) }, '<0.15');
      rows.forEach(({ r, f, out }) => {
        tl.to(r, { autoAlpha: 1, duration: D(0.2) });
        if (f.value) tl.add(typeTo(out, String(f.value), 0.45));
        else { tl.call(() => text(out, 'nicht gefunden')); tl.fromTo(out, { opacity: 0 }, { opacity: 1, duration: D(0.12), repeat: 4, yoyo: true }); }
      });
      await play(tl);
      await wait(0.4);
    },
    async question(ev, c) {
      if (c.panelEngine) return;
      c.panelEngine = ev.engine;
      setStep(2);
      text(P.engine, ev.label);
      const tl = gsap.timeline();
      tl.to(P.answer, { autoAlpha: 1, duration: D(0.3) });
      tl.add(typeTo(P.q, ev.question, 0.9));
      tl.call(() => {
        clear(P.ans);
        const w = tpl('words').querySelector('.check_answer_word');
        text(w, `${ev.label} sucht …`);
        P.ans.appendChild(w);
        c.pulse = track(gsap.fromTo(w, { opacity: 1 }, { opacity: 0.35, duration: D(0.6), repeat: -1, yoyo: true }));
      });
      await play(tl);
    },
    async answer(ev, c) {
      c.answers.push(ev);
      if (ev.engine !== c.panelEngine) return;
      if (c.pulse) c.pulse.kill();
      clear(P.ans);
      const words = tpl('words');
      const wordT = words.querySelector('.check_answer_word:not(.is-punct)'), chipT = words.querySelector('.check_answer_chip');
      const punctT = words.querySelector('.check_answer_word.is-punct') || wordT;
      const add = (t, str) => { const el = t.cloneNode(true); text(el, str); P.ans.appendChild(el); return el; };
      const comp = (ev.competitors || []).slice(0, 3);
      if (comp.length) {
        add(wordT, `${ev.label} empfiehlt`);
        comp.forEach((n, i) => {
          add(chipT, n);
          if (i < comp.length - 2) add(punctT, ',');
          else if (i === comp.length - 2) add(wordT, 'und');
          else add(punctT, '.');
        });
      } else {
        add(wordT, ev.text.length > 170 ? ev.text.slice(0, 170).replace(/\s+\S*$/, '') + ' …' : ev.text);
      }
      const v = ev.mentioned
        ? verdict(true, 'Sie werden genannt.', `${ev.label} kennt Ihr Unternehmen für diese Frage.`)
        : verdict(false, 'Sie werden nicht genannt.', c.missing && c.missing.length
          ? `Die KI fand auf Ihrer Seite nichts zu ${c.missing.slice(0, 3).join(', ')}.`
          : `Stattdessen empfiehlt ${ev.label} andere Anbieter.`);
      const tl = gsap.timeline();
      tl.fromTo([...P.ans.children], { opacity: 0.08 }, { opacity: 1, duration: D(0.3), stagger: D(0.1) });
      tl.fromTo(v, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: D(0.45), ease: 'power2.out' }, '+=0.2');
      await play(tl);
    },
    async speed() {},
    async score(ev, c) { c.checks = ev.checks; c.score = ev.score; c.grade = ev.grade; },
    async warning(ev, c) { c.warnings.push(ev.message); },
    async done(ev, c) {
      if (c.pulse) c.pulse.kill();
      if (!c.panelEngine) {
        setStep(2); gsap.set(P.answer, { autoAlpha: 1 });
        verdict(false, 'KI-Abfrage nicht möglich.', 'Die technische Prüfung ist trotzdem vollständig.');
      }
      setStep(2);
      text(P.status, `Fertig · ${c.answers.length} KI-Suche${c.answers.length === 1 ? '' : 'n'} geprüft`);
      if (c.live) renderResult(ev, c);
    },
    async error(ev, c) {
      if (c.beam) c.beam.kill();
      if (c.pulse) c.pulse.kill();
      gsap.set(P.beam, { opacity: 0 });
      setStep(-1);
      gsap.set(P.answer, { autoAlpha: 1 });
      verdict(false, 'Check nicht möglich.', ev.message);
      text(errEl, ev.message);
    },
  };
  const handle = (ev, c) => (H[ev.type] ? H[ev.type](ev, c) : Promise.resolve());

  // ---------- Ergebnis ----------
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  function listItem(status, label, detail, miss) {
    const it = tpl('item');
    keepVariant(it, 'check_item_icon', STATUS, 'is-' + status);
    keepVariant(it, 'check_item_detail', ['is-miss'], miss ? 'is-miss' : '');
    text(it.querySelector('.check_item_label'), label);
    text(it.querySelector('.check_item_detail'), detail);
    return it;
  }

  function renderResult(done, c) {
    if (!resultEl) return;
    clear(resultEl);
    const r = tpl('result');
    const mentioned = c.answers.filter(a => a.mentioned).length;

    text($('r-domain', r), `Ergebnis für ${c.domain}`);
    text($('r-grade', r), done.grade);
    text($('r-summary', r), (c.answers.length ? `In ${mentioned} von ${c.answers.length} KI-Suchen werden Sie genannt. ` : '')
      + `Ich habe ${done.fixCount} Verbesserung${done.fixCount === 1 ? '' : 'en'} gefunden, sortiert nach Wirkung.`);

    const checksEl = $('r-checks', r);
    (c.checks || []).forEach(x => checksEl.appendChild(listItem(x.status, x.label, x.detail, false)));
    const fieldsEl = $('r-fields', r);
    (c.understood?.fields || []).forEach(f => fieldsEl.appendChild(listItem(f.value ? 'ok' : 'fail', f.label, f.value || 'nicht gefunden', !f.value)));

    const enginesWrap = $('r-engines-wrap', r), enginesEl = $('r-engines', r);
    if (!c.answers.length) enginesWrap.remove();
    c.answers.forEach(a => {
      const e = tpl('engine');
      text(e.querySelector('.check_engine_name'), a.label);
      keepVariant(e, 'check_engine_badge', ['is-yes'], a.mentioned ? 'is-yes' : '');
      text(e.querySelector('.check_engine_question'), `„${a.question}“`);
      const chips = e.querySelector('.check_chips_list');
      if (a.competitors?.length) a.competitors.forEach(n => chips.appendChild(text(tpl('chip'), n)));
      else chips.remove();
      const t = e.querySelector('.check_engine_copy') || e.querySelector('.check_engine_text');
      text(t, a.text);
      const more = e.querySelector('.check_engine_more'), moreText = e.querySelector('.check_engine_more_text');
      more.addEventListener('click', () => {
        const open = !t.classList.contains('is-active');
        t.classList.toggle('is-active', open);
        more.setAttribute('aria-expanded', String(open));
        text(moreText, open ? 'Weniger anzeigen' : 'Ganze Antwort lesen');
      });
      const src = e.querySelector('.check_sources_list');
      if (a.sources?.length) {
        src.appendChild(text(tpl('warning'), 'Quellen:'));
        a.sources.slice(0, 5).forEach(s => { const l = tpl('source'); l.href = s.url; l.target = '_blank'; l.rel = 'noopener nofollow'; text(l, host(s.url)); src.appendChild(l); });
      } else src.remove();
      enginesEl.appendChild(e);
    });

    text($('r-fixcount', r), `Ihre ${done.fixCount} Fixes, nach Wirkung sortiert`);
    if (done.topFix) text($('r-topfix', r), done.topFix); else $('r-topfix-wrap', r).remove();

    const warnEl = $('r-warnings', r);
    if (c.warnings.length) c.warnings.forEach(w => warnEl.appendChild(text(tpl('warning'), w)));
    else warnEl.remove();

    resultEl.appendChild(r);

    // Score-Ring
    const arc = $('r-arc', r), num = $('r-score', r);
    const o = { v: 0 };
    gsap.to(o, { v: done.score, duration: D(1.4), ease: 'power2.out', delay: D(0.3), onUpdate() { text(num, Math.round(o.v)); arc.style.strokeDashoffset = 213.6 * (1 - o.v / 100); } });
    gsap.from(r.children, { autoAlpha: 0, y: 20, duration: D(0.5), stagger: D(0.08), ease: 'power2.out' });

    $('again', r).addEventListener('click', e => {
      e.preventDefault(); leaveDoneMode(); hideReady(); input.value = ''; input.focus({ preventScroll: true }); scrollTo(root);
    });

    const rf = $('report', r), msg = $('r-msg', r), rb = rf.querySelector('[type="submit"]');
    rf.addEventListener('submit', async e => {
      e.preventDefault(); e.stopPropagation();
      const email = rf.querySelector('[name="email"]').value.trim(), consent = rf.querySelector('[name="consent"]').checked;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { text(msg, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'); return; }
      if (!consent) { text(msg, 'Bitte bestätigen Sie, dass Sie den Report erhalten möchten.'); return; }
      setBusy(rb, true); text(msg, 'Wird gesendet …');
      try {
        const res = API === 'demo' ? { ok: true } : await fetch(API + '/report', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: done.id, email, consent }),
        }).then(async x => x.ok ? x.json() : Promise.reject(new Error((await x.json().catch(() => ({}))).error || 'Senden fehlgeschlagen.')));
        if (res.ok) {
          const ok = tpl('success');
          text(ok, `Der Report ist unterwegs. Schauen Sie in Ihr Postfach (${email}). Falls nichts ankommt, prüfen Sie bitte den Spam-Ordner.`);
          rf.replaceWith(ok);
          if (window.dataLayer) window.dataLayer.push({ event: 'website_check_report', score: done.score });
        }
      } catch (err) { text(msg, err.message); setBusy(rb, false); }
    });
  }

  // ---------- Stream vom Worker ----------
  async function* stream(url, token) {
    if (API === 'demo') { yield* demoStream(url); return; }
    const res = await fetch(API + '/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, turnstile: token }) });
    if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || 'Der Check konnte nicht gestartet werden.');
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line) yield JSON.parse(line);
      }
    }
    if (buf.trim()) yield JSON.parse(buf);
  }

  // ---------- Turnstile (optional) ----------
  let tsId = null;
  const tsEl = $('turnstile');
  function initTurnstile() {
    if (tsEl && window.turnstile && tsId === null) tsId = window.turnstile.render(tsEl, { sitekey: tsEl.dataset.sitekey, size: 'flexible', appearance: 'interaction-only' });
  }
  const tsToken = () => (tsId !== null && window.turnstile ? window.turnstile.getResponse(tsId) : undefined);

  // ---------- Fortschritt: Balken, Countdown, Button-Text, Fertig-Pille ----------
  const prog = $('progress'), progBar = $('progress-bar'), progStatus = $('progress-status'), progTime = $('progress-time');
  const ready = $('ready') || document.querySelector('[data-wc="ready"]'); // Pille sitzt evtl. außerhalb der Section
  const btnText = btn && (btn.closest('.button_main_wrap') || form).querySelector('.button_main_text');
  const btnOrig = btnText ? [...btnText.childNodes].map(n => n.cloneNode(true)) : [];
  const ESTIMATE = 50; // Sekunden, typische Dauer eines Live-Checks
  const PHASE = {
    start: [0.08, 'Lese Ihre Seite …'],
    read: [0.3, 'KI versteht Ihre Seite …'],
    understood: [0.42, 'Frage ChatGPT & Perplexity …'],
    question: [0.45, 'Frage ChatGPT & Perplexity …'],
    answer: [0.7, 'Messe Ladezeit …'],
    speed: [0.92, 'Werte aus …'],
    score: [0.96, 'Werte aus …'],
  };
  const P2 = { floor: 0, t0: 0, timer: null, scrolled: false, doneMode: false };
  const setLabel = str => { if (!btnText) return; clear(btnText); btnText.textContent = str; };
  const restoreLabel = () => { if (!btnText || !btnOrig.length) return; clear(btnText); btnOrig.forEach(n => btnText.appendChild(n.cloneNode(true))); };
  const setBar = f => { if (progBar) gsap.to(progBar, { scaleX: Math.min(1, f), duration: D(0.6), ease: 'power2.out', overwrite: true }); };
  const markScrolled = () => { P2.scrolled = true; };
  const SCROLL_EVENTS = ['wheel', 'touchmove', 'keydown'];
  function tick() {
    const el = (Date.now() - P2.t0) / 1000, left = Math.round(ESTIMATE - el);
    text(progTime, left > 3 ? `noch ca. ${left} s` : 'gleich fertig …');
    setBar(Math.max(P2.floor, Math.min(0.9, el / (ESTIMATE + 8))));
  }
  function progressStart() {
    hideReady();
    P2.doneMode = false; P2.floor = 0; P2.t0 = Date.now(); P2.scrolled = false;
    if (progBar) gsap.set(progBar, { scaleX: 0 });
    text(progStatus, PHASE.start[1]); text(progTime, `noch ca. ${ESTIMATE} s`);
    if (prog) prog.classList.add('is-active');
    setLabel(PHASE.start[1]);
    clearInterval(P2.timer); P2.timer = setInterval(tick, 1000);
    // Erst nach dem Start-Scroll zählen, damit unser eigenes Scrollen nicht mitzählt
    setTimeout(() => SCROLL_EVENTS.forEach(t => window.addEventListener(t, markScrolled, { passive: true })), 1200);
  }
  function progressEvent(ev) {
    const ph = PHASE[ev.type];
    if (!ph) return;
    P2.floor = Math.max(P2.floor, ph[0]);
    text(progStatus, ph[1]); setLabel(ph[1]); setBar(Math.max(P2.floor, Math.min(0.9, (Date.now() - P2.t0) / 1000 / (ESTIMATE + 8))));
  }
  function progressStop() {
    clearInterval(P2.timer); P2.timer = null;
    SCROLL_EVENTS.forEach(t => window.removeEventListener(t, markScrolled));
  }
  function progressFail() {
    progressStop();
    if (prog) prog.classList.remove('is-active');
    restoreLabel();
  }
  const inView = el => { const b = el.getBoundingClientRect(); return b.top < window.innerHeight * 0.8 && b.bottom > 0; };
  function hideReady() { if (ready) ready.classList.remove('is-active'); }
  function goToResult() { hideReady(); const r = resultEl && resultEl.firstElementChild; if (r) scrollTo(r); }
  function progressDone() {
    progressStop();
    setBar(1); text(progStatus, 'Fertig ✓'); text(progTime, '');
    setLabel('Fertig ✓ Ergebnis ansehen ↓');
    P2.doneMode = true;
    const r = resultEl && resultEl.firstElementChild;
    if (!r) return;
    if (!P2.scrolled) setTimeout(goToResult, reduce ? 0 : 350);
    else if (!inView(r) && ready) ready.classList.add('is-active');
    setTimeout(() => { if (prog) prog.classList.remove('is-active'); }, reduce ? 0 : 2500);
  }
  function leaveDoneMode() { if (!P2.doneMode) return; P2.doneMode = false; restoreLabel(); }
  if (ready) ready.addEventListener('click', e => { e.preventDefault(); goToResult(); });
  // Pille ausblenden, sobald das Ergebnis selbst im Bild ist
  window.addEventListener('scroll', () => {
    if (ready && ready.classList.contains('is-active') && resultEl?.firstElementChild && inView(resultEl.firstElementChild)) hideReady();
  }, { passive: true });
  input && input.addEventListener('input', leaveDoneMode);

  // ---------- Echter Check ----------
  async function startCheck(raw) {
    interrupt();
    const my = run;
    const c = { live: true, answers: [], warnings: [] };
    text(errEl, '');
    clear(resultEl);
    setBusy(btn, true);
    progressStart();
    let queue = Promise.resolve(), finished = false, failed = false;
    const push = ev => {
      if (ev.type === 'done' || ev.type === 'error') finished = true;
      if (ev.type === 'error') failed = true;
      if (my === run) progressEvent(ev);
      queue = queue.then(() => my === run && handle(ev, c));
    };
    try {
      for await (const ev of stream(raw, tsToken())) { if (my !== run) { progressStop(); return; } push(ev); }
      if (!finished) push({ type: 'error', message: 'Die Verbindung wurde unterbrochen. Bitte versuchen Sie es noch einmal.' });
    } catch (e) {
      if (!finished) push({ type: 'error', message: e.message || 'Der Check ist fehlgeschlagen.' });
    }
    await queue;
    setBusy(btn, false);
    if (my !== run) return;
    if (failed) progressFail(); else progressDone();
    if (tsId !== null && window.turnstile) window.turnstile.reset(tsId);
  }

  form && form.addEventListener('submit', e => {
    e.preventDefault(); e.stopPropagation();
    if (P2.doneMode) { leaveDoneMode(); goToResult(); return; }
    const v = (input.value || '').trim();
    if (!v || !/\./.test(v)) { text(errEl, 'Bitte geben Sie eine Website-Adresse ein, z. B. ihre-firma.at'); input.focus(); return; }
    if (window.dataLayer) window.dataLayer.push({ event: 'website_check_start' });
    scrollTo(P.steps[0]?.parentElement || root);
    startCheck(v);
  });

  // ---------- Demo-Loop im Leerlauf ----------
  const A = (s, l, st, d) => ({ key: s, label: l, status: st, detail: d });
  const SCENES = [
    { domain: 'ihr-restaurant.at',
      checks: [A('index', 'Für Google erreichbar', 'ok', 'indexierbar'), A('ai', 'Öffnungszeiten', 'fail', 'nur als Bild'), A('schema', 'Speisekarte', 'fail', 'PDF, nicht lesbar'), A('read', 'Adresse', 'ok', 'im Footer')],
      fields: [['Branche', 'Restaurant'], ['Ort', 'Wien 1080'], ['Öffnungszeiten', null], ['Küche', null], ['Reservierung', null]],
      q: 'Wo kann ich in der Josefstadt gut essen gehen?' },
    { domain: 'ihre-praxis.at',
      checks: [A('index', 'Für Google erreichbar', 'ok', 'indexierbar'), A('ai', 'Leistungen', 'warn', 'nur Stichworte'), A('schema', 'Strukturierte Daten', 'fail', 'fehlen'), A('read', 'Kontakt', 'ok', 'Telefon & Adresse')],
      fields: [['Branche', 'Zahnarztpraxis'], ['Ort', 'Wien'], ['Behandlungen', null], ['Kasse / Wahlarzt', null], ['Neue Patienten', null]],
      q: 'Welcher Zahnarzt in Wien nimmt neue Patienten auf?' },
    { domain: 'ihre-kanzlei.at',
      checks: [A('index', 'Für Google erreichbar', 'ok', 'indexierbar'), A('ai', 'Rechtsgebiete', 'warn', 'zu allgemein'), A('schema', 'Team', 'ok', 'mit Namen'), A('read', 'Strukturierte Daten', 'fail', 'fehlen')],
      fields: [['Branche', 'Rechtsanwalt'], ['Ort', 'Wien 1010'], ['Spezialgebiet', null], ['Für wen', null], ['Sprachen', null]],
      q: 'Welche Kanzlei in Wien ist auf Arbeitsrecht spezialisiert?' },
  ];
  const sceneEvents = s => [
    { type: 'start', domain: s.domain },
    { type: 'read', checks: s.checks },
    { type: 'understood', understood: { fields: s.fields.map(([label, value]) => ({ label, value })) } },
    { type: 'question', engine: 'chatgpt', label: 'ChatGPT', question: s.q },
    { type: 'answer', engine: 'chatgpt', label: 'ChatGPT', question: s.q, text: '', mentioned: false, competitors: ['Mitbewerber A', 'Mitbewerber B', 'Mitbewerber C'] },
  ];
  async function idle() {
    interrupt();
    const my = run;
    for (let i = 0; my === run; i = (i + 1) % SCENES.length) {
      const c = { live: false, answers: [], warnings: [] };
      for (const ev of sceneEvents(SCENES[i])) { if (my !== run) return; await handle(ev, c); if (ev.type === 'start') await wait(0.9); }
      if (my !== run) return;
      await wait(3.2);
      if (my !== run) return;
      await play(gsap.timeline().to([P.stage, P.answer], { autoAlpha: 0, duration: D(0.45) }));
    }
  }

  // Demo-Stream (data-wc-api="demo") für Vorschau ohne Worker
  async function* demoStream(url) {
    const domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    const sleep = ms => new Promise(r => setTimeout(r, reduce ? 10 : ms));
    const checks = [A('index', 'Für Google erreichbar', 'ok', 'indexierbar'), A('ai', 'Zugang für KI-Suche', 'warn', 'gesperrt: OAI-SearchBot'), A('meta', 'Titel & Beschreibung', 'ok', 'vorhanden'),
      A('schema', 'Strukturierte Daten', 'fail', 'fehlen'), A('read', 'Lesbar für KI', 'warn', '1 PDF-Link, wenig Text'), A('llms', 'llms.txt', 'warn', 'fehlt')];
    const q = 'Wo kann ich in Wien 1080 gut essen gehen?';
    yield { type: 'start', id: 'demo', domain };
    await sleep(1800); yield { type: 'read', checks };
    await sleep(1600); yield { type: 'understood', understood: { name: domain, fields: [{ label: 'Branche', value: 'Restaurant' }, { label: 'Ort', value: 'Wien 1080' }, { label: 'Öffnungszeiten', value: null }, { label: 'Küche', value: 'Wiener Küche' }, { label: 'Reservierung', value: null }] } };
    yield { type: 'question', engine: 'chatgpt', label: 'ChatGPT', question: q };
    yield { type: 'question', engine: 'perplexity', label: 'Perplexity', question: q };
    await sleep(3500);
    yield { type: 'answer', engine: 'chatgpt', label: 'ChatGPT', question: q, mentioned: false, competitors: ['Gasthaus A', 'Bistro B', 'Weinbar C'],
      text: 'In der Josefstadt gibt es einige gute Adressen: Gasthaus A ist bekannt für klassische Wiener Küche, Bistro B hat einen schönen Schanigarten und Weinbar C eine große Auswahl an österreichischen Weinen. Reservieren ist am Wochenende empfehlenswert.\n\n(Beispielantwort im Demo-Modus)',
      sources: [{ url: 'https://www.falstaff.com/', title: '' }, { url: 'https://www.wien.info/', title: '' }] };
    yield { type: 'answer', engine: 'perplexity', label: 'Perplexity', question: q, mentioned: true, competitors: ['Gasthaus A', domain],
      text: `Gut bewertet sind Gasthaus A und ${domain}, das für saisonale Küche gelobt wird.\n\n(Beispielantwort im Demo-Modus)`, sources: [{ url: 'https://' + domain, title: '' }] };
    await sleep(600);
    const all = [...checks, A('speed', 'Ladezeit Handy & Desktop', 'warn', 'Handy 58 · Desktop 89 · LCP 3,4 s')];
    yield { type: 'speed', check: all.at(-1) };
    yield { type: 'score', score: 47, grade: 'Schwach sichtbar', checks: all };
    yield { type: 'done', id: 'demo', score: 47, grade: 'Schwach sichtbar', fixCount: 7, topFix: 'KI-Suche in der robots.txt erlauben' };
  }

  // Start: Demo-Loop, sobald das Panel sichtbar ist
  resetPanel('Beispiel');
  const io = 'IntersectionObserver' in window && new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); initTurnstile(); idle(); }
  }, { threshold: 0.25 });
  io ? io.observe(P.wire) : idle();
  window.addEventListener('load', initTurnstile);
})();
