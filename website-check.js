/* ah design · Website-Check · Frontend-Engine
   Gehört in die zentrale Slater-Datei. Nutzt das global geladene GSAP – kein eigenes <script src=gsap>.
   Hooks (Custom Attributes):
     [data-wc="check"]   Wrapper der Section (enthält Form + Panel)
     [data-wc="form"]    Formular, data-wc-api="https://…workers.dev" (oder "demo")
     [data-wc="input"]   URL-Feld · [data-wc="form-error"] Fehlertext (optional)
     [data-wc="turnstile"] optional, mit data-sitekey
     [data-wc="result"]  leerer Container unter der Section (Ergebnis wird hier gerendert)
   Panel-Hooks kommen aus panel-embed.html. */
(function boot() {
  // Wartet auf das von Webflow geladene GSAP – lädt es nie selbst.
  if (!window.gsap) {
    if (document.readyState !== 'complete') window.addEventListener('load', boot, { once: true });
    else console.warn('[website-check] GSAP fehlt – in Webflow unter Site Settings → GSAP aktivieren.');
    return;
  }
  if (window.__wcStarted) return;
  window.__wcStarted = true;
  const root = document.querySelector('[data-wc="check"]');
  if (!root) return;
  const gsap = window.gsap;
  const $ = k => root.querySelector(`[data-wc="${k}"]`);
  const form = $('form'), input = $('input'), btn = form && form.querySelector('button, [type=submit]');
  const errEl = $('form-error'), resultEl = document.querySelector('[data-wc="result"]');
  const API = (form && form.dataset.wcApi || '').replace(/\/$/, '');
  const P = {
    steps: [...($('steps')?.children || [])], url: $('url'), wire: $('wire'), beam: $('beam'), img: $('img'),
    annos: $('annos'), notes: $('notes'), noteList: $('note-list'), answer: $('answer'), engine: $('engine'),
    q: $('q'), ans: $('ans'), verdict: $('verdict'), status: $('status'), mode: $('mode'),
  };
  if (!P.wire) return;
  const blocks = () => root.querySelectorAll('.wc-page .wc-b, .wc-img');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const D = s => (reduce ? 0.01 : s);
  const ICON = { ok: '✓', warn: '!', fail: '✕' };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Laufsteuerung: jeder Durchlauf (Demo oder Live) bekommt eine Nummer ----------
  let run = 0;
  const live = new Set();
  const track = t => { live.add(t); return t; };
  function interrupt() {
    run++;
    live.forEach(t => t.kill()); live.clear();
  }
  const play = tl => new Promise(res => { track(tl); tl.eventCallback('onComplete', () => { live.delete(tl); res(); }); });
  const wait = s => play(gsap.timeline().to({}, { duration: D(s) }));
  const typeTo = (el, text, dur) => {
    const o = { n: 0 }; el.textContent = '';
    return gsap.to(o, { n: text.length, duration: D(dur), ease: 'none', onUpdate() { el.textContent = text.slice(0, Math.round(o.n)); } });
  };
  const setStep = i => P.steps.forEach((li, k) => { li.classList.toggle('is-on', k === i); li.classList.toggle('is-done', k < i); });

  function resetPanel(mode) {
    setStep(0);
    P.url.textContent = ''; P.annos.innerHTML = ''; P.noteList.innerHTML = '';
    P.q.textContent = ''; P.ans.innerHTML = ''; P.verdict.innerHTML = ''; P.verdict.className = 'wc-verdict';
    P.img.textContent = 'Inhalt';
    if (P.mode) P.mode.textContent = mode;
    if (P.status) P.status.textContent = 'Gleiche Frage auch an Perplexity';
    gsap.set(['.wc-stage', P.wire].map(x => typeof x === 'string' ? root.querySelector(x) : x), { autoAlpha: 1, scale: 1 });
    gsap.set(P.notes, { autoAlpha: 0, y: 14 });
    gsap.set(P.answer, { autoAlpha: .3 });
    gsap.set(blocks(), { scaleX: 0 });
    gsap.set(P.beam, { opacity: 0 });
  }

  // ---------- Event-Handler: dieselben für Demo-Loop und echten Check ----------
  const H = {
    async start(ev, c) {
      resetPanel(c.live ? 'Live-Check' : 'Beispiel');
      c.domain = ev.domain || ev.url;
      const tl = gsap.timeline();
      tl.add(typeTo(P.url, c.domain, .6));
      tl.to(blocks(), { scaleX: 1, duration: D(.35), stagger: D(.035), ease: 'power2.out' });
      await play(tl);
      c.beam = track(gsap.fromTo(P.beam, { top: '-46px', opacity: 1 }, { top: '100%', duration: D(1.6), ease: 'none', repeat: -1 }));
    },
    async read(ev, c) {
      const pick = ['index', 'ai', 'schema', 'read'];
      const list = pick.map(k => ev.checks.find(x => x.key === k)).filter(Boolean);
      P.annos.innerHTML = list.map(x => `<li class="wc-anno is-${x.status}"><b>${esc(x.label)}</b><small>${ICON[x.status]} ${esc(x.detail)}</small></li>`).join('');
      const items = P.annos.children;
      gsap.set(items, { autoAlpha: 0, x: -10 });
      if (!c.live) await wait(.8);
      await play(gsap.timeline().to(items, { autoAlpha: 1, x: 0, duration: D(.35), stagger: D(.45), ease: 'power2.out' }));
      if (c.beam) c.beam.kill();
      gsap.to(P.beam, { opacity: 0, duration: D(.3) });
      await wait(.6);
    },
    async understood(ev, c) {
      const u = ev.understood || {};
      c.understood = u;
      let fields = u.fields && u.fields.length ? u.fields : [{ label: 'Unternehmen', value: u.name || null }, { label: 'Branche', value: u.branche || null }, { label: 'Ort', value: u.ort || null }];
      c.missing = fields.filter(f => !f.value).map(f => f.label);
      P.noteList.innerHTML = fields.map(f => `<div class="wc-note"><dt>${esc(f.label)}</dt><dd class="${f.value ? '' : 'is-miss'}"></dd></div>`).join('');
      setStep(1);
      const rows = [...P.noteList.children];
      gsap.set(rows, { autoAlpha: 0 });
      const tl = gsap.timeline();
      tl.to(P.wire, { autoAlpha: 0, scale: .97, duration: D(.4) });
      tl.to(P.notes, { autoAlpha: 1, y: 0, duration: D(.4) }, '<0.15');
      rows.forEach((r, i) => {
        const dd = r.querySelector('dd'), f = fields[i];
        tl.to(r, { autoAlpha: 1, duration: D(.2) });
        if (f.value) tl.add(typeTo(dd, String(f.value), .45));
        else { tl.call(() => { dd.textContent = 'nicht gefunden'; }); tl.fromTo(dd, { opacity: 0 }, { opacity: 1, duration: D(.12), repeat: 4, yoyo: true }); }
      });
      await play(tl);
      await wait(.4);
    },
    async question(ev, c) {
      if (c.panelEngine) return;
      c.panelEngine = ev.engine;
      setStep(2);
      P.engine.textContent = ev.label;
      const tl = gsap.timeline();
      tl.to(P.answer, { autoAlpha: 1, duration: D(.3) });
      tl.add(typeTo(P.q, ev.question, .9));
      tl.call(() => { P.ans.innerHTML = `<span class="wc-dots">${esc(ev.label)} sucht</span>`; });
      await play(tl);
    },
    async answer(ev, c) {
      c.answers.push(ev);
      if (ev.engine !== c.panelEngine) return;
      const comp = (ev.competitors || []).slice(0, 3);
      const words = comp.length
        ? [`${ev.label} empfiehlt`, ...comp.flatMap((n, i) => [{ c: n }, i < comp.length - 2 ? ',' : i === comp.length - 2 ? 'und' : '.'])]
        : [ev.text.length > 170 ? ev.text.slice(0, 170).replace(/\s+\S*$/, '') + ' …' : ev.text];
      P.ans.innerHTML = words.map(w => typeof w === 'string' ? `<span class="w">${esc(w)}</span>` : `<span class="w wc-chip">${esc(w.c)}</span>`).join(' ').replace(/ <span class="w">([.,])/g, '<span class="w">$1');
      if (ev.mentioned) {
        P.verdict.className = 'wc-verdict is-good';
        P.verdict.innerHTML = `<b>Sie werden genannt.</b> ${esc(ev.label)} kennt Ihr Unternehmen für diese Frage.`;
      } else {
        P.verdict.innerHTML = `<b>Sie werden nicht genannt.</b> ` + (c.missing && c.missing.length
          ? `Die KI fand auf Ihrer Seite nichts zu ${esc(c.missing.slice(0, 3).join(', '))}.`
          : `Stattdessen empfiehlt ${esc(ev.label)} andere Anbieter.`);
      }
      const tl = gsap.timeline();
      tl.fromTo(P.ans.querySelectorAll('.w'), { opacity: .08 }, { opacity: 1, duration: D(.3), stagger: D(.1) });
      tl.fromTo(P.verdict, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: D(.45), ease: 'power2.out' }, '+=0.2');
      await play(tl);
    },
    async speed() {},
    async score(ev, c) { c.checks = ev.checks; c.score = ev.score; c.grade = ev.grade; },
    async warning(ev, c) { c.warnings.push(ev.message); },
    async done(ev, c) {
      if (!c.panelEngine) {
        setStep(2); gsap.set(P.answer, { autoAlpha: 1 });
        P.verdict.innerHTML = '<b>KI-Abfrage nicht möglich.</b> Die technische Prüfung ist trotzdem vollständig.';
      }
      setStep(3);
      if (P.status) P.status.textContent = `Fertig · ${c.answers.length} KI-Suche${c.answers.length === 1 ? '' : 'n'} geprüft`;
      if (c.live) renderResult(ev, c);
    },
    async error(ev, c) {
      if (c.beam) c.beam.kill();
      gsap.set(P.beam, { opacity: 0 });
      setStep(-1);
      gsap.set(P.answer, { autoAlpha: 1 });
      P.verdict.className = 'wc-verdict';
      P.verdict.innerHTML = `<b>Check nicht möglich.</b> ${esc(ev.message)}`;
      if (errEl) errEl.textContent = ev.message;
    },
  };
  const handle = (ev, c) => (H[ev.type] ? H[ev.type](ev, c) : Promise.resolve());

  // ---------- Ergebnis ----------
  function renderResult(done, c) {
    if (!resultEl) return;
    const mentioned = c.answers.filter(a => a.mentioned).length;
    const fieldList = (c.understood?.fields || []);
    const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
    resultEl.innerHTML = `
      <div class="wc-r-head">
        <div class="wc-ring"><svg viewBox="0 0 80 80"><circle class="track" cx="40" cy="40" r="34"/><circle class="arc" cx="40" cy="40" r="34"/></svg>
          <div class="num"><b>0</b><small>von 100</small></div></div>
        <div><span class="wc-eyebrow">Ergebnis für ${esc(c.domain)}</span>
          <h2>${esc(done.grade)}</h2>
          <p>${c.answers.length ? `In ${mentioned} von ${c.answers.length} KI-Suchen werden Sie genannt. ` : ''}Ich habe ${done.fixCount} Verbesserung${done.fixCount === 1 ? '' : 'en'} gefunden, sortiert nach Wirkung.</p></div>
      </div>
      <div class="wc-grid">
        <div class="wc-block"><h3>Technik</h3><ul class="wc-list">${(c.checks || []).map(x =>
          `<li class="is-${x.status}"><span class="ic">${ICON[x.status]}</span><span>${esc(x.label)}</span><small>${esc(x.detail)}</small></li>`).join('')}</ul></div>
        <div class="wc-block"><h3>Was die KI über Sie weiß</h3><ul class="wc-list">${fieldList.map(f =>
          `<li class="${f.value ? 'is-ok' : 'is-fail is-miss'}"><span class="ic">${f.value ? '✓' : '✕'}</span><span>${esc(f.label)}</span><small>${esc(f.value || 'nicht gefunden')}</small></li>`).join('')}</ul></div>
      </div>
      ${c.answers.length ? `<div class="wc-block"><h3>Die echten KI-Antworten</h3>
        <div class="wc-engines">${c.answers.map((a, i) => `
          <article class="wc-engine">
            <header><b>${esc(a.label)}</b><span class="wc-badge ${a.mentioned ? 'is-yes' : 'is-no'}">${a.mentioned ? 'Genannt' : 'Nicht genannt'}</span></header>
            <div class="q">„${esc(a.question)}"</div>
            ${a.competitors?.length ? `<div class="wc-chips">${a.competitors.map(n => `<span class="wc-chip">${esc(n)}</span>`).join('')}</div>` : ''}
            <p class="txt" id="wc-txt-${i}">${esc(a.text)}</p>
            <button type="button" class="wc-more" aria-controls="wc-txt-${i}" aria-expanded="false">Ganze Antwort lesen</button>
            ${a.sources?.length ? `<div class="wc-sources">Quellen: ${a.sources.slice(0, 5).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(host(s.url))}</a>`).join(' · ')}</div>` : ''}
          </article>`).join('')}</div>
        <p class="wc-warnings" style="list-style:none;padding:0;margin-top:10px">KI-Modelle antworten nicht jedes Mal gleich. Das ist eine Momentaufnahme.</p></div>` : ''}
      <div class="wc-gate">
        <div><h3>Ihre ${done.fixCount} Fixes, nach Wirkung sortiert</h3>
          <p>Den vollständigen Report mit allen Schritten und den KI-Antworten schicke ich Ihnen per E-Mail. Vieles davon können Sie selbst umsetzen.</p>
          ${done.topFix ? `<div class="wc-top-fix"><small>Wichtigster Fix</small>${esc(done.topFix)}</div>` : ''}</div>
        <form data-wc="report" novalidate>
          <input type="email" id="wc-email" name="email" placeholder="ihre@email.at" autocomplete="email" required aria-label="E-Mail-Adresse">
          <label class="wc-consent"><input type="checkbox" id="wc-consent" required>
            <span>Ich möchte den Report per E-Mail erhalten. ah design darf mich dazu kontaktieren. <a href="/datenschutz" target="_blank">Datenschutz</a></span></label>
          <button type="submit">Report senden</button>
          <div class="msg" role="status"></div>
        </form>
      </div>
      ${c.warnings.length ? `<ul class="wc-warnings">${c.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      <div class="wc-cta"><span>Lieber gleich darüber sprechen?</span><a href="/anfrage">Projekt anfragen →</a><a href="#" data-wc="again">Andere Website prüfen</a></div>`;
    resultEl.hidden = false;

    const arc = resultEl.querySelector('.arc'), num = resultEl.querySelector('.wc-ring b');
    arc.style.stroke = done.score >= 80 ? 'var(--wc-ok)' : done.score >= 55 ? 'var(--wc-warn)' : 'var(--wc-accent)';
    const o = { v: 0 };
    gsap.to(o, { v: done.score, duration: D(1.4), ease: 'power2.out', delay: D(.3), onUpdate() { num.textContent = Math.round(o.v); arc.style.strokeDashoffset = 213.6 * (1 - o.v / 100); } });
    gsap.from(resultEl.children, { autoAlpha: 0, y: 20, duration: D(.5), stagger: D(.08), ease: 'power2.out' });
    resultEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });

    resultEl.querySelectorAll('.wc-more').forEach(b => b.addEventListener('click', () => {
      const t = document.getElementById(b.getAttribute('aria-controls'));
      const open = t.classList.toggle('is-open');
      b.setAttribute('aria-expanded', open); b.textContent = open ? 'Weniger anzeigen' : 'Ganze Antwort lesen';
    }));
    resultEl.querySelector('[data-wc="again"]').addEventListener('click', e => {
      e.preventDefault(); input.value = ''; input.focus({ preventScroll: true });
      root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
    const rf = resultEl.querySelector('[data-wc="report"]');
    rf.addEventListener('submit', async e => {
      e.preventDefault();
      const msg = rf.querySelector('.msg'), b = rf.querySelector('button');
      const email = rf.querySelector('[name=email]').value.trim(), consent = rf.querySelector('#wc-consent').checked;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'; return; }
      if (!consent) { msg.textContent = 'Bitte bestätigen Sie, dass Sie den Report erhalten möchten.'; return; }
      b.disabled = true; msg.textContent = 'Wird gesendet …';
      try {
        const r = API === 'demo' ? { ok: true } : await fetch(API + '/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: done.id, email, consent }) }).then(async r => r.ok ? r.json() : Promise.reject(new Error((await r.json().catch(() => ({}))).error || 'Senden fehlgeschlagen.')));
        if (r.ok) { rf.innerHTML = `<p style="font-size:17px;margin:0"><b>Report ist unterwegs.</b><br>Schauen Sie in Ihr Postfach (${esc(email)}). Falls nichts ankommt, prüfen Sie bitte den Spam-Ordner.</p>`; }
        if (window.dataLayer) window.dataLayer.push({ event: 'website_check_report', score: done.score });
      } catch (err) { msg.textContent = err.message; b.disabled = false; }
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

  // ---------- Echter Check ----------
  async function startCheck(raw) {
    interrupt();
    const my = run;
    const c = { live: true, answers: [], warnings: [] };
    if (errEl) errEl.textContent = '';
    if (resultEl) { resultEl.hidden = true; resultEl.innerHTML = ''; }
    btn && (btn.disabled = true);
    let queue = Promise.resolve(), finished = false;
    const push = ev => { if (ev.type === 'done' || ev.type === 'error') finished = true; queue = queue.then(() => my === run && handle(ev, c)); };
    try {
      for await (const ev of stream(raw, tsToken())) { if (my !== run) return; push(ev); }
      if (!finished) push({ type: 'error', message: 'Die Verbindung wurde unterbrochen. Bitte versuchen Sie es noch einmal.' });
    } catch (e) {
      if (!finished) push({ type: 'error', message: e.message || 'Der Check ist fehlgeschlagen.' });
    }
    await queue;
    btn && (btn.disabled = false);
    if (tsId !== null && window.turnstile) window.turnstile.reset(tsId);
  }

  form && form.addEventListener('submit', e => {
    e.preventDefault();
    const v = (input.value || '').trim();
    if (!v || !/\./.test(v)) { if (errEl) errEl.textContent = 'Bitte geben Sie eine Website-Adresse ein, z. B. ihre-firma.at'; input.focus(); return; }
    if (window.dataLayer) window.dataLayer.push({ event: 'website_check_start' });
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
      for (const ev of sceneEvents(SCENES[i])) { if (my !== run) return; await handle(ev, c); if (ev.type === 'start') await wait(.9); }
      if (my !== run) return;
      setStep(3);
      await wait(3.2);
      if (my !== run) return;
      await play(gsap.timeline().to([root.querySelector('.wc-stage'), P.answer], { autoAlpha: 0, duration: D(.45) }));
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
    const all = [...checks, A('speed', 'Ladezeit & Handy', 'warn', 'Mobil 58/100 · LCP 3,4 s')];
    yield { type: 'speed', check: all.at(-1) };
    yield { type: 'score', score: 47, grade: 'Schwach sichtbar', checks: all };
    yield { type: 'done', id: 'demo', score: 47, grade: 'Schwach sichtbar', fixCount: 7, topFix: 'KI-Suche in der robots.txt erlauben' };
  }

  // Start: Demo-Loop, sobald das Panel sichtbar ist
  resetPanel('Beispiel');
  const io = 'IntersectionObserver' in window && new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); initTurnstile(); idle(); }
  }, { threshold: .25 });
  io ? io.observe(P.wire) : idle();
  window.addEventListener('load', initTurnstile);
})();
