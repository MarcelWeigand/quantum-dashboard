'use strict';
/* Quantum Daily front end: renders the four pages from data/data.json.
   All text that comes from feeds or Claude goes through esc(); links go through safeUrl(). */

const SEG = {
  hw:  { label: 'Hardware',         color: '#7fd1c7' },
  ec:  { label: 'Error correction', color: '#e0b46a' },
  sw:  { label: 'Software',         color: '#a99bf0' },
  nw:  { label: 'Networking',       color: '#8fb8ff' },
  sec: { label: 'Security',         color: '#f08fb0' },
  sen: { label: 'Sensing',          color: '#b6d968' },
  en:  { label: 'Enabling tech',    color: '#c9a98a' },
};
const UP = '#6fd3a0', DOWN = '#f08a6b', NEUTRAL = '#c9ced6', SCI = '#7fd1c7', STK = '#e0b46a';
const ROUTE_COLOR = { 'IPO planned': '#7fd1c7', 'SPAC merger': '#e0b46a', 'Private': '#9aa3ae', 'Newly listed': '#6fd3a0' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NAV = [
  ['index.html', 'Overview', 'overview'],
  ['markets.html', 'Markets', 'markets'],
  ['sentiment.html', 'Sentiment', 'sentiment'],
  ['industry.html', 'Industry map', 'industry'],
];

/* ------------------------------------------------------------ helpers */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const fmtPrice = (p) => (num(p) ? '$' + p.toFixed(2) : '—');
const fmtPct = (v) => (num(v) ? (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%' : '—');
const sign = (v) => (num(v) ? (v >= 0 ? '+' : '−') + Math.abs(v) : '—');
const arrow = (v) => (v >= 0 ? '▲' : '▼');
const dirColor = (v) => (v >= 0 ? UP : DOWN);
const band = (v) => (!num(v) ? { label: 'No data yet', color: NEUTRAL } : v >= 25 ? { label: 'Positive', color: UP } : v <= -25 ? { label: 'Negative', color: DOWN } : { label: 'Neutral', color: NEUTRAL });
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
const fmtLong = (ymd) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtStamp = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
const monthName = (key) => { const [y, m] = key.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; };

function monthKeys(endKey, n) {
  let [y, m] = endKey.split('-').map(Number);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.unshift(y + '-' + String(m).padStart(2, '0'));
    if (--m === 0) { m = 12; y--; }
  }
  return out;
}

function spark(vals, w, h, color, opts = {}) {
  vals = (vals || []).filter(num);
  const size = opts.fluid ? `width="100%" height="${h}" preserveAspectRatio="none"` : `width="${w}" height="${h}"`;
  if (vals.length < 2) return `<svg ${size} viewBox="0 0 ${w} ${h}" aria-hidden="true"></svg>`;
  const min = Math.min(...vals), max = Math.max(...vals), r = (max - min) || 1;
  const pts = vals.map((v, i) => `${(i * w / (vals.length - 1)).toFixed(1)},${(h - 3 - ((v - min) / r) * (h - 6)).toFixed(1)}`).join(' ');
  const area = opts.area ? `<polygon points="${pts} ${w},${h} 0,${h}" fill="${color}" fill-opacity="0.12"/>` : '';
  return `<svg ${size} viewBox="0 0 ${w} ${h}" aria-hidden="true">${area}<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}

const chip = (label, color, fill) => `<span class="chip"><span class="dot" style="border-color:${color};background:${fill}"></span>${esc(label)}</span>`;
const chipsFor = (o, withPartial = true) =>
  (o.core || []).filter((k) => SEG[k]).map((k) => chip(SEG[k].label, SEG[k].color, SEG[k].color)).join('') +
  (withPartial ? (o.part || []).filter((k) => SEG[k]).map((k) => chip(SEG[k].label, SEG[k].color, 'transparent')).join('') : '');
const tagChip = (k) => (SEG[k] ? chip(SEG[k].label, SEG[k].color, SEG[k].color) : '');
const link = (url, cls, text) => (safeUrl(url) ? `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>` : `<span class="${cls}">${esc(text)}</span>`);

/* ------------------------------------------------------------ shell */

function masthead(active, d) {
  const asOf = d.etf && d.etf.asOf ? ` · Prices as of ${esc(fmtDay(d.etf.asOf))}` : '';
  const nav = NAV.map(([href, label, key]) => `<a href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<header class="masthead">
    <div class="masthead-top">
      <div class="brand">
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="17" fill="none" stroke="#7fd1c7" stroke-width="1.5"/>
          <ellipse cx="20" cy="20" rx="17" ry="6.5" fill="none" stroke="#7fd1c7" stroke-width="1.5" transform="rotate(60 20 20)"/>
          <ellipse cx="20" cy="20" rx="17" ry="6.5" fill="none" stroke="#7fd1c7" stroke-width="1.5" transform="rotate(-60 20 20)"/>
          <circle cx="20" cy="20" r="2.6" fill="#7fd1c7"/>
        </svg>
        <div class="brand-name">Quantum Daily</div>
      </div>
      <div class="meta"><span>${esc(fmtLong(d.date))}</span><span>Updated ${esc(fmtStamp(d.generatedAt))}${asOf}</span></div>
    </div>
    <nav class="nav" aria-label="Sections">${nav}</nav>
  </header>`;
}

function shell(active, d, inner, footerRight) {
  const notes = (d.warnings || []).length ? `<div class="notice">Data notes: ${esc(d.warnings.join(' · '))}</div>` : '';
  return `<div class="page">${masthead(active, d)}${inner}${notes}
    <footer class="footer"><span>Summaries are generated by Claude and may contain errors; always check the linked source.</span><span>${esc(footerRight || 'Market data is delayed and for information only, not investment advice.')}</span></footer>
  </div>`;
}

const intro = (eyebrow, title, text) => `<div class="grid g12" style="align-items:end">
  <div class="col gap14 s7"><div class="eyebrow">${esc(eyebrow)}</div><h1 class="h1">${esc(title)}</h1></div>
  <div class="lead s5">${esc(text)}</div></div>`;

/* ------------------------------------------------------------ shared pieces */

function priceCells(s) {
  const stale = s.stale ? ' <span class="stale">delayed</span>' : '';
  return `<span class="price right">${fmtPrice(s.price)}${stale}</span>
    <span class="chg right" style="color:${num(s.chgPct) ? dirColor(s.chgPct) : 'var(--muted)'}">${num(s.chgPct) ? arrow(s.chgPct) + ' ' : ''}${fmtPct(s.chgPct)}</span>
    <div class="spark-cell">${spark(s.series, 120, 36, num(s.chgPct) ? dirColor(s.chgPct) : NEUTRAL)}</div>`;
}

function sentInfo(d, key) {
  const m = (d.sentiment && d.sentiment.monthly) || [];
  const cur = m[m.length - 1], prev = m[m.length - 2];
  const v = cur ? cur[key] : null, p = prev ? prev[key] : null;
  const today = (d.sentiment && d.sentiment.today) || {};
  const reason = cur ? (key === 'science' ? cur.reasonScience : cur.reasonStock) : '';
  const todayReason = key === 'science' ? today.reasonScience : today.reasonStock;
  return {
    v, delta: num(v) && num(p) ? v - p : null, series: m.map((r) => r[key]), month: cur ? cur.month : null,
    reason: reason || todayReason || '',
    articles: cur ? (key === 'science' ? cur.articlesScience : cur.articlesStock) : 0,
  };
}

function fixedSpark(series, w, h, color) {
  const pts = [];
  series.forEach((v, i) => { if (num(v)) pts.push(`${(series.length > 1 ? i * w / (series.length - 1) : w / 2).toFixed(1)},${(h / 2 - (v / 100) * (h / 2 - 3)).toFixed(1)}`); });
  if (pts.length < 2) return `<span class="small" style="max-width:180px;text-align:right">Trend builds up as the daily job collects data</span>`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="#2f3846" stroke-dasharray="3 4"/><polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function deltaHtml(delta) {
  return delta == null
    ? '<span class="stale">first month of data</span>'
    : `<span class="mono" style="font-size:13px;color:${dirColor(delta)}">${arrow(delta)} ${sign(delta)} vs last month</span>`;
}

function sentStripTile(title, key, color, d) {
  const i = sentInfo(d, key), b = band(i.v);
  return `<div class="card col gap14 s5">
    <div class="row between stat-label"><span>${esc(title)}</span><span class="mono">${i.month ? esc(monthName(i.month)) : ''}</span></div>
    <div class="row between gap24">
      <div class="row baseline gap14">
        <span style="font-family:var(--serif);font-size:56px;line-height:1">${sign(i.v)}</span>
        <div class="col" style="gap:4px"><span style="font-size:15px;font-weight:500;color:${b.color}">${b.label}</span>${deltaHtml(i.delta)}</div>
      </div>
      ${fixedSpark(i.series, 220, 48, color)}
    </div>
    <div class="body">${esc(i.reason)}</div>
  </div>`;
}

/* ------------------------------------------------------------ overview */

function lattice() {
  const dots = [], lines = [];
  const cols = 11, rows = 4, gx = 56, gy = 46, ox = 20, oy = 26;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = ox + c * gx + (r % 2 ? gx / 2 : 0), cy = oy + r * gy, hot = (r * 7 + c * 3) % 5 === 0;
      dots.push(`<circle cx="${cx}" cy="${cy}" r="${hot ? 6 : 4}" fill="#7fd1c7" fill-opacity="${hot ? 0.95 : 0.5}"/>`);
      if (c < cols - 1) lines.push(`<line x1="${cx}" y1="${cy}" x2="${cx + gx}" y2="${cy}"/>`);
      if (r < rows - 1) {
        lines.push(`<line x1="${cx}" y1="${cy}" x2="${cx + (r % 2 ? gx / 2 : -gx / 2)}" y2="${cy + gy}"/>`);
        lines.push(`<line x1="${cx}" y1="${cy}" x2="${cx + (r % 2 ? -gx / 2 : gx / 2)}" y2="${cy + gy}"/>`);
      }
    }
  }
  return `<svg width="100%" height="200" viewBox="0 0 640 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g stroke="#7fd1c7" stroke-opacity="0.28" stroke-width="1.2">${lines.join('')}</g>${dots.join('')}</svg>`;
}

function renderOverview(d) {
  const priced = d.stocks.filter((s) => num(s.chgPct)).sort((a, b) => b.chgPct - a.chgPct);
  const best = priced[0], worst = priced[priced.length - 1];
  const est = d.stocks.filter((s) => s.group === 'established');
  const etf = d.etf || {};
  const kpiMover = (label, s) => `<div class="card col gap10"><div class="stat-label">${label}</div>
    ${s ? `<div class="stat-big">${esc(s.sym)}</div><div class="mono" style="font-size:18px;color:${dirColor(s.chgPct)}">${arrow(s.chgPct)} ${fmtPct(s.chgPct)}</div><div class="stat-label">${esc(s.name)}</div>` : '<div class="stat-big">—</div>'}</div>`;
  const arxiv = d.arxiv && d.arxiv.total ? d.arxiv : null;

  const brief = d.brief && d.brief.headline
    ? `<div class="col gap14 s8"><div class="eyebrow">Today in quantum</div><h1 class="h1">${esc(d.brief.headline)}</h1></div><div class="lead s4">${esc(d.brief.summary)}</div>`
    : `<div class="col gap14 s8"><div class="eyebrow">Today in quantum</div><h1 class="h1">The first daily brief is on its way.</h1></div><div class="lead s4">It appears after the next scheduled update.</div>`;

  const watch = est.map((s) => `<div class="trow t-watch">
      <div class="col gap8"><div class="row baseline gap10"><span class="sym">${esc(s.sym)}</span><span class="small">${esc(s.name)} · ${esc(s.approach)}</span></div>
        <div class="row wrap gap6">${chipsFor(s, false)}</div></div>${priceCells(s)}</div>`).join('');

  const news = (d.marketNews || []).map((n) => `<div class="news">
      <div class="row between"><span class="mono small" style="font-size:12px">${esc(n.source)}${n.published ? ' · ' + esc(fmtDay(n.published)) : ''}</span><span class="tag">${esc(n.ticker)}</span></div>
      ${link(n.url, 'news-title', n.title)}<div class="body">${esc(n.summary)}</div></div>`).join('') || '<div class="empty">No market stories yet.</div>';

  const f = d.science && d.science.featured;
  const cards = ((d.science && d.science.items) || []).map((p) => `<div class="card col gap10">
      <span style="align-self:flex-start">${tagChip(p.tag)}</span>${link(p.url, 'item-title', p.title)}
      <div class="body">${esc(p.summary)}</div><div class="mono small auto-top" style="font-size:12px">${esc(p.source)}${p.published ? ' · ' + esc(fmtDay(p.published)) : ''}</div></div>`).join('');
  const science = f || cards ? `<section class="col gap20">
      <div class="card-head" style="margin:0"><h2 class="h2-lg">Science &amp; research</h2><span class="small">Sources: arXiv, Phys.org, The Quantum Insider</span></div>
      <div class="grid g12">
        ${f ? `<div class="s6" style="background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column">
          <div class="feat-art">${lattice()}</div>
          <div class="col gap12" style="padding:24px 28px 28px">
            <div class="row gap12 mono small" style="font-size:12px"><span style="color:var(--accent);text-transform:uppercase;letter-spacing:.12em">Featured</span><span>${esc(f.source)}${f.published ? ' · ' + esc(fmtDay(f.published)) : ''}</span></div>
            ${link(f.url, 'feat-title', f.title)}<div class="body-lg">${esc(f.summary)}</div><span style="align-self:flex-start">${tagChip(f.tag)}</span></div></div>` : ''}
        <div class="s6 grid g2" style="align-content:start">${cards}</div>
      </div></section>` : '';

  return shell('overview', d, `
    <div class="grid g12" style="align-items:end">${brief}</div>
    <div class="grid g4">
      <div class="card col gap10"><div class="row between stat-label"><span>${esc(etf.sym || 'QTUM')} · Quantum ETF</span><span class="mono">30 days</span></div>
        <div class="row baseline gap12"><span class="stat-num">${fmtPrice(etf.price)}</span><span class="mono" style="font-size:15px;color:${num(etf.chgPct) ? dirColor(etf.chgPct) : 'var(--muted)'}">${num(etf.chgPct) ? arrow(etf.chgPct) + ' ' : ''}${fmtPct(etf.chgPct)}</span></div>
        ${spark(etf.series, 300, 56, num(etf.chgPct) ? dirColor(etf.chgPct) : NEUTRAL, { fluid: true, area: true })}</div>
      ${kpiMover('Biggest gainer (last close)', best)}${kpiMover('Biggest decliner (last close)', worst)}
      <div class="card col gap10"><div class="stat-label">New on arXiv quant-ph</div><div class="stat-big">${arxiv ? arxiv.total : '—'}</div>
        <div class="stat-label" style="line-height:1.5">${arxiv ? `papers in the latest daily listing, ${arxiv.picked} picked as worth reading.` : 'arXiv publishes no listing at weekends.'}</div></div>
    </div>
    <div class="grid g12">
      ${sentStripTile('Science & technology sentiment', 'science', SCI, d)}${sentStripTile('Stock market sentiment', 'stock', STK, d)}
      <div class="card-dashed col between s2 gap12"><div class="body">12-month trend, reasons and how the score is calculated.</div><a class="link-arrow" href="sentiment.html">Open sentiment →</a></div>
    </div>
    <div class="grid g12">
      <section class="card-lg s7 col" style="padding-bottom:8px">
        <div class="card-head"><h2 class="h2">Watchlist</h2><span class="small">Prices delayed · not financial advice</span></div>
        <div class="scroll-x"><div class="trow thead t-watch"><span>Company · focus</span><span class="right">Price</span><span class="right">1 day</span><span class="right">30 days</span></div>${watch}</div>
        <div class="row between wrap gap12" style="padding:18px 0"><span class="body">Smaller listed companies and upcoming listings</span><a class="link-arrow" href="markets.html">Open Markets →</a></div>
      </section>
      <section class="card-lg s5 col" style="padding-bottom:12px">
        <div class="card-head"><h2 class="h2">Market news</h2><span class="small">Top stories today</span></div>${news}
      </section>
    </div>
    ${science}`);
}

/* ------------------------------------------------------------ markets */

const marketsState = { filter: 'all' };

function renderMarkets(d) {
  const f = marketsState.filter;
  const match = (o) => f === 'all' || (o.core || []).includes(f) || (o.part || []).includes(f);
  const filters = [['all', 'All', null]].concat(Object.keys(SEG).map((k) => [k, SEG[k].label, SEG[k].color]))
    .map(([k, label, color]) => `<button type="button" class="pill" data-filter="${k}" aria-pressed="${f === k}">${color ? `<span class="dot" style="border-color:${color};background:${color};width:9px;height:9px"></span>` : ''}${esc(label)}</button>`).join('');
  const count = (n) => n + (n === 1 ? ' company' : ' companies');

  const table = (rows, title, sub, none) => `<section class="card-lg col" style="padding-bottom:8px">
      <div class="card-head"><h2 class="h2">${title}</h2><span class="small">${count(rows.length)} · ${sub}</span></div>
      <div class="scroll-x"><div class="trow thead t-stocks"><span>Company</span><span>Focus</span><span class="right">Price</span><span class="right">1 day</span><span class="right">30 days</span></div>
      ${rows.map((s) => `<div class="trow t-stocks"><div class="col" style="gap:2px"><span class="sym">${esc(s.sym)}</span><span class="small">${esc(s.name)} · ${esc(s.approach)}</span></div>
        <div class="row wrap gap6">${chipsFor(s)}</div>${priceCells(s)}</div>`).join('')}</div>
      ${rows.length ? '' : `<div class="empty">${none}</div>`}</section>`;

  const est = d.stocks.filter((s) => s.group === 'established' && match(s));
  const emg = d.stocks.filter((s) => s.group === 'emerging' && match(s));
  const upc = (d.upcoming || []).filter(match);
  const cards = upc.map((u) => {
    const c = ROUTE_COLOR[u.route] || '#9aa3ae';
    const src = safeUrl(u.source) ? ` · <a href="${esc(u.source)}" target="_blank" rel="noopener noreferrer">source</a>` : '';
    return `<div class="card col gap14">
      <div class="row between gap12" style="align-items:flex-start"><div class="col" style="gap:4px"><span style="font-family:var(--serif);font-size:30px;line-height:1.1">${esc(u.name)}</span><span class="small">${esc(u.note)}</span></div>
        <span class="route" style="border-color:${c};color:${c}">${esc(u.route)}</span></div>
      <div class="soft" style="font-size:14px;line-height:1.5">${esc(u.status)}</div>
      <div class="row wrap gap6">${chipsFor(u)}</div>
      <div class="grid g2 auto-top mono small" style="gap:12px;border-top:1px solid var(--line);padding-top:14px;font-size:12px">
        <span>Expected listing<br><span style="color:var(--text)">${esc(u.expectedListing || 'TBD')}</span></span>
        <span>Latest funding<br><span style="color:var(--text)">${esc(u.latestFunding || 'unknown')}</span></span>
        <span style="grid-column:span 2">Status checked <span style="color:var(--text)">${esc(u.checked || 'not yet')}</span>${src}</span></div></div>`;
  }).join('');

  return shell('markets', d, `
    <div class="col gap20">
      ${intro('Markets', 'Who is listed, who is small, and who is next', 'Each company is tagged with the parts of the industry it works in. Filled dots mark a core focus, hollow dots mark secondary activity. Pick an area to filter every list on this page.')}
      <div class="row wrap gap10" role="group" aria-label="Filter by focus area"><span class="label-mono" style="margin-right:6px">Focus area</span>${filters}</div>
    </div>
    ${table(est, 'Established', 'the main names in the industry', 'No established companies match this focus area.')}
    ${table(emg, 'Emerging &amp; smaller listed', 'newer or smaller companies, higher risk and volatility', 'No smaller listed companies match this focus area.')}
    <section class="col gap20">
      <div class="card-head" style="margin:0"><h2 class="h2-lg">Upcoming &amp; going public</h2><span class="small">${count(upc.length)} · status refreshed daily from filings and news</span></div>
      <div class="grid g3">${cards}</div>${upc.length ? '' : '<div class="empty" style="padding:8px 0">No upcoming listings match this focus area.</div>'}
    </section>`, 'Market data is delayed and for information only, not investment advice. Smaller and newly listed stocks can be very volatile.');
}

/* ------------------------------------------------------------ sentiment */

function renderSentiment(d) {
  const monthly = (d.sentiment && d.sentiment.monthly) || [];
  const method = (d.sentiment && d.sentiment.method) || { headlineWeight: 0.7, momentumWeight: 0.3 };
  const sci = sentInfo(d, 'science'), stk = sentInfo(d, 'stock');
  const gap = num(sci.v) && num(stk.v) ? sci.v - stk.v : null;
  const monthLabel = sci.month ? monthName(sci.month) : '';

  const tile = (title, i, color) => { const b = band(i.v); return `<div class="card col gap12">
      <div class="row between stat-label"><span class="row gap8"><span class="swatch" style="background:${color}"></span>${esc(title)}</span><span class="mono">${esc(monthLabel)}</span></div>
      <div class="row baseline gap14"><span style="font-family:var(--serif);font-size:64px;line-height:1">${sign(i.v)}</span>
        <div class="col" style="gap:4px"><span style="font-size:16px;font-weight:500;color:${b.color}">${b.label}</span>${deltaHtml(i.delta)}</div></div>
      <div class="body">${title === 'Science & technology' ? 'How the technology itself is progressing, from research results and roadmaps.' : 'How investors and financial news feel about quantum companies.'}</div></div>`; };
  const gapTile = `<div class="card col gap12"><div class="row between stat-label"><span>Gap: science minus stocks</span><span class="mono">${esc(monthLabel)}</span></div>
      <div class="row baseline gap14"><span style="font-family:var(--serif);font-size:64px;line-height:1">${sign(gap)}</span>
        <span style="font-size:16px;font-weight:500;color:${NEUTRAL}">${gap == null ? 'No data yet' : gap >= 0 ? 'Science ahead' : 'Stocks ahead'}</span></div>
      <div class="body">A wide gap means the lab and the market are telling different stories.</div></div>`;

  // chart: last 12 months ending at the latest month with data
  const endKey = monthly.length ? monthly[monthly.length - 1].month : d.date.slice(0, 7);
  const keys = monthKeys(endKey, 12), byKey = Object.fromEntries(monthly.map((m) => [m.month, m]));
  const X0 = 48, X1 = 740, Y0 = 16, YH = 280;
  const px = (i) => X0 + i * ((X1 - X0) / 11), py = (v) => Y0 + ((100 - v) / 200) * YH;
  const grid = [100, 50, 0, -50, -100].map((v) => `<line x1="48" y1="${py(v)}" x2="740" y2="${py(v)}" stroke="${v === 0 ? '#4a5462' : '#262d38'}"/><text x="40" y="${py(v) + 4}" fill="#9aa3ae" font-size="12" text-anchor="end" font-family="IBM Plex Mono, monospace">${v === 0 ? '0' : sign(v)}</text>`).join('');
  const xl = keys.map((k, i) => { const mm = Number(k.slice(5)); return `<text x="${px(i)}" y="322" fill="#9aa3ae" font-size="12" text-anchor="middle" font-family="IBM Plex Mono, monospace">${MONTHS[mm - 1]}${i === 0 || mm === 1 ? ' ' + k.slice(2, 4) : ''}</text>`; }).join('');
  const series = (key, color, label) => {
    const pts = [];
    keys.forEach((k, i) => { const v = byKey[k] && byKey[k][key]; if (num(v)) pts.push({ x: px(i), y: py(v), v }); });
    if (!pts.length) return '';
    const last = pts[pts.length - 1];
    return `${pts.length > 1 ? `<polyline points="${pts.map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
      ${pts.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="${i === pts.length - 1 ? 5.5 : 3.5}" fill="${color}" stroke="#151a22" stroke-width="1.5"/>`).join('')}
      <text x="${Math.min(last.x + 14, 754)}" y="${last.y + 4}" fill="${color}" font-size="12" font-family="IBM Plex Mono, monospace">${label} ${sign(last.v)}</text>`;
  };
  const chart = `<svg width="100%" viewBox="0 0 860 340" role="img" aria-label="Line chart of monthly science and stock sentiment over the last 12 months">
      <rect x="48" y="16" width="692" height="140" fill="#6fd3a0" fill-opacity="0.04"/><rect x="48" y="156" width="692" height="140" fill="#f08a6b" fill-opacity="0.05"/>
      ${grid}<text x="56" y="32" fill="#9aa3ae" font-size="11" font-family="IBM Plex Mono, monospace" letter-spacing="1.5">POSITIVE</text><text x="56" y="288" fill="#9aa3ae" font-size="11" font-family="IBM Plex Mono, monospace" letter-spacing="1.5">NEGATIVE</text>
      ${xl}${series('stock', STK, 'Stocks')}${series('science', SCI, 'Science')}</svg>`;

  const lens = (name, color, i) => { const b = band(i.v); return `<div class="col gap8" style="border-top:1px solid var(--line);padding-top:18px">
      <div class="row between baseline"><span class="row gap8" style="font-size:14px;font-weight:500"><span class="swatch" style="background:${color}"></span>${name}</span><span class="mono" style="font-size:14px;color:${b.color}">${sign(i.v)} · ${b.label}</span></div>
      <div class="soft" style="font-size:15px;line-height:1.55">${esc(i.reason) || 'No reason recorded yet.'}</div>
      <div class="mono small" style="font-size:12px">Based on ${i.articles || 0} articles this month</div></div>`; };

  const steps = [
    ['01', 'Collect', 'Every day the job gathers headlines and abstracts: science feeds for the technology lens, financial news for the stock lens.'],
    ['02', 'Classify', 'Claude labels each item positive (+1), neutral (0) or negative (−1), with a confidence level.'],
    ['03', 'Daily score', 'The confidence-weighted average label times 100, giving a score from −100 to +100.'],
    ['04', 'Monthly score', 'The average of the daily scores, weighted by article count. The most common reasons become the summary sentence.'],
  ].map(([n, t, b]) => `<div class="col gap10"><span class="mono" style="font-size:13px;color:var(--accent)">${n}</span><div style="font-size:17px;font-weight:500">${t}</div><div class="body" style="line-height:1.55">${b}</div></div>`).join('');

  const barW = (v) => Math.round(Math.abs(v) / 100 * 56);
  const cell = (v) => num(v) ? `<div class="row gap10"><span class="mono" style="width:44px;font-size:14px;color:${band(v).color}">${sign(v)}</span><span style="display:block;height:6px;border-radius:3px;background:${band(v).color};width:${barW(v)}px"></span></div>` : '<span class="small">—</span>';
  const log = monthly.slice().reverse().map((r) => `<div class="trow t-log"><span class="mono" style="font-size:14px">${esc(monthName(r.month))}</span>${cell(r.science)}${cell(r.stock)}
      <span class="body" style="line-height:1.45">${esc(r.reasonScience)}</span><span class="body" style="line-height:1.45">${esc(r.reasonStock)}</span></div>`).join('');

  return shell('sentiment', d, `
    ${intro('Industry sentiment', 'Is the mood in quantum getting better or worse?', 'Two lenses on one industry. Science sentiment tracks how the technology is progressing. Stock sentiment tracks how markets feel about it. They often disagree, so they are scored separately.')}
    <div class="grid g3">${tile('Science & technology', sci, SCI)}${tile('Stock market', stk, STK)}${gapTile}</div>
    <div class="grid g12">
      <section class="card-lg col gap14 s8" style="padding-bottom:20px">
        <div class="card-head" style="margin:0"><h2 class="h2">12-month trend</h2>
          <div class="row gap24 soft" style="font-size:13px"><span class="row gap8"><span class="swatch" style="background:${SCI};width:20px"></span>Science &amp; technology</span><span class="row gap8"><span class="swatch" style="background:${STK};width:20px"></span>Stock market</span></div></div>
        ${chart}
        <div class="small">Monthly average of daily scores, from −100 (very negative) to +100 (very positive). History builds up one day at a time, starting from the first run.</div>
      </section>
      <section class="card-lg col gap20 s4"><div class="card-head" style="margin:0"><h2 class="h2">Why this month</h2><span class="mono small">${esc(monthLabel)}</span></div>
        ${lens('Science &amp; technology', SCI, sci)}${lens('Stock market', STK, stk)}</section>
    </div>
    <section class="card-lg col gap24">
      <div class="card-head" style="margin:0"><h2 class="h2">How the score is calculated</h2><span class="small">Weights can be tuned later</span></div>
      <div class="grid g4">${steps}</div>
      <div class="grid g2">
        <div class="card-flat col gap8"><span class="row gap8" style="font-size:14px;font-weight:500"><span class="swatch" style="background:${SCI}"></span>Science &amp; technology lens</span>
          <div class="body" style="line-height:1.55">Reads arXiv quant-ph, Phys.org and The Quantum Insider. Milestones, peer-reviewed results and roadmap progress count as positive; setbacks, failed replications and retractions count as negative.</div></div>
        <div class="card-flat col gap8"><span class="row gap8" style="font-size:14px;font-weight:500"><span class="swatch" style="background:${STK}"></span>Stock market lens</span>
          <div class="body" style="line-height:1.55">Reads financial news on quantum companies: earnings, contracts, funding and analyst calls. The score blends ${Math.round(method.headlineWeight * 100)}% headline sentiment with ${Math.round(method.momentumWeight * 100)}% price momentum, measured as the 30-day change of the QTUM ETF.</div></div>
      </div>
      <div class="small" style="line-height:1.5">The score is an AI-assisted estimate, not a measurement. Months with few articles are noisy, so every month shows how many articles it is based on.</div>
    </section>
    <section class="card-lg col" style="padding-bottom:8px"><div class="card-head"><h2 class="h2">Monthly log</h2><span class="small">Latest first</span></div>
      <div class="scroll-x"><div class="trow thead t-log"><span>Month</span><span>Science</span><span>Stocks</span><span>Reason: science</span><span>Reason: stocks</span></div>${log || '<div class="empty">The first month appears after the first daily run.</div>'}</div></section>`,
  'Sentiment is for information only, not investment advice.');
}

/* ------------------------------------------------------------ industry map */

const SEG_TEXT = {
  hw: ['The physical quantum processors. Qubits can be built from superconducting circuits, trapped ions, neutral atoms or photons, each with different strengths.', 'Everything else depends on it. Today’s machines are still small and error-prone.'],
  ec: ['Qubits are fragile and make mistakes. Error correction combines many physical qubits into one reliable “logical” qubit.', 'Widely seen as the main gate to large, useful quantum computers.'],
  sw: ['Programming tools, cloud access and the algorithms that decide what a quantum computer can actually be used for, from chemistry to logistics.', 'It turns hardware into products and shapes when real-world value arrives.'],
  nw: ['Links between quantum devices, so separate processors can be connected and share entanglement over fibre.', 'Could let smaller machines work together and enable a future quantum internet.'],
  sec: ['Two sides: quantum key distribution, and post-quantum cryptography, which is ordinary software designed to resist future quantum attacks.', 'Organisations must act before large quantum computers exist, so it is often the earliest revenue.'],
  sen: ['Quantum sensors measure time, gravity and magnetic fields with extreme precision, for navigation, medicine and defence.', 'It can be sold today and does not need a large quantum computer.'],
  en: ['The supporting stack: cooling systems, lasers, control electronics, chip fabrication and materials.', 'Bottlenecks here limit how fast anyone else can scale.'],
};
const APPROACHES = [
  ['Superconducting', 'Electrical circuits cooled close to absolute zero. Fast operations and the most mature, but they need large cooling systems.', 'IBM, Alphabet, Rigetti, IQM'],
  ['Trapped ion', 'Single charged atoms held in place by electric fields. Very accurate qubits, though operations are slower.', 'IonQ, Quantinuum'],
  ['Neutral atom', 'Atoms arranged by laser “tweezers”. Scales to large numbers of qubits; speed and accuracy are still improving.', 'Infleqtion, Pasqal'],
  ['Photonic', 'Particles of light on chips, which fit existing chip manufacturing. Making and detecting single photons is hard.', 'Xanadu, PsiQuantum, Quantum Computing Inc.'],
  ['Annealing', 'A special-purpose machine for optimisation problems. Not a general-purpose quantum computer.', 'D-Wave'],
];

function renderIndustry(d) {
  const keys = Object.keys(SEG);
  const rows = d.stocks.map((s) => ({ sym: s.sym, name: s.name, stage: s.group === 'established' ? 'Listed' : 'Listed, small', core: s.core || [], part: s.part || [] }))
    .concat((d.upcoming || []).map((u) => ({ sym: u.name, name: u.note || '', stage: u.route, core: u.core || [], part: u.part || [] })));

  const segs = keys.map((k) => `<div class="card col gap14">
      <div class="row gap10"><span style="width:12px;height:12px;border-radius:50%;background:${SEG[k].color}"></span><span style="font-size:18px;font-weight:500">${SEG[k].label}</span></div>
      <div class="col" style="gap:4px"><span class="kicker">What it is</span><span class="soft" style="font-size:14px;line-height:1.5">${esc(SEG_TEXT[k][0])}</span></div>
      <div class="col" style="gap:4px"><span class="kicker">Why it matters</span><span class="soft" style="font-size:14px;line-height:1.5">${esc(SEG_TEXT[k][1])}</span></div>
      <div class="small auto-top" style="border-top:1px solid var(--line);padding-top:12px;line-height:1.5">Core focus: <span style="color:var(--text)">${esc(rows.filter((r) => r.core.includes(k)).map((r) => r.sym).join(', ') || '—')}</span></div></div>`).join('');

  const head = keys.map((k) => `<span class="col" style="align-items:center;gap:6px;text-align:center;font-size:12px;line-height:1.25;color:var(--soft)"><span style="width:8px;height:8px;border-radius:50%;background:${SEG[k].color}"></span>${SEG[k].label}</span>`).join('');
  const matrix = rows.map((r) => `<div class="trow t-matrix"><div class="row baseline gap12"><span class="mono" style="font-size:15px;font-weight:500;min-width:100px">${esc(r.sym)}</span><span class="small">${esc(r.name)} · ${esc(r.stage)}</span></div>
      ${keys.map((k) => { const v = r.core.includes(k) ? 2 : r.part.includes(k) ? 1 : 0, c = SEG[k].color;
        return `<div class="row" style="justify-content:center"><svg width="22" height="22" viewBox="0 0 22 22" role="img" aria-label="${esc(r.sym + ', ' + SEG[k].label + ': ' + (v === 2 ? 'core focus' : v === 1 ? 'also active' : 'not active'))}"><circle cx="11" cy="11" r="${v === 2 ? 7.5 : v === 1 ? 6.2 : 2}" fill="${v === 2 ? c : v === 1 ? 'none' : '#2f3846'}" stroke="${v ? c : '#2f3846'}" stroke-width="1.8"/></svg></div>`; }).join('')}</div>`).join('');

  const appr = APPROACHES.map(([n, t, w]) => `<div class="card col gap12"><span style="font-family:var(--serif);font-size:28px;line-height:1.1">${n}</span><span class="soft" style="font-size:14px;line-height:1.5">${t}</span><span class="small auto-top" style="line-height:1.5">${esc(w)}</span></div>`).join('');

  return shell('industry', d, `
    ${intro('Industry map', 'Quantum computing is seven industries, not one', 'A plain-language guide to the parts of the field. Every company on this dashboard is tagged with the areas it works in, so you can tell a chip maker from a security vendor at a glance.')}
    <section class="col gap20"><h2 class="h2-lg">The seven areas</h2>
      <div class="grid g4">${segs}
        <div class="card-dashed col gap14" style="padding:22px 24px"><span style="font-size:18px;font-weight:500">How to read the tags</span>
          <div class="row gap10 soft" style="font-size:14px"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="#7fd1c7"/></svg>Core focus: a main part of the business</div>
          <div class="row gap10 soft" style="font-size:14px"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.2" fill="none" stroke="#7fd1c7" stroke-width="1.6"/></svg>Also active: a secondary line or partnership</div>
          <div class="col gap10 auto-top"><div class="small" style="line-height:1.5">Most companies do more than one thing, and the lines blur over time.</div><a class="link-arrow" href="markets.html">Filter companies by area →</a></div></div></div></section>
    <section class="col gap20"><div class="card-head" style="margin:0"><h2 class="h2-lg">Five ways to build a qubit</h2><span class="small">Hardware is the most crowded area, and nobody knows yet which approach will win</span></div><div class="grid g5">${appr}</div></section>
    <section class="card-lg col" style="padding-bottom:12px">
      <div class="card-head"><h2 class="h2">Who does what</h2><div class="row gap24 soft" style="font-size:13px">
        <span class="row gap8"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="#9aa3ae"/></svg>Core focus</span>
        <span class="row gap8"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.2" fill="none" stroke="#9aa3ae" stroke-width="1.6"/></svg>Also active</span></div></div>
      <div class="scroll-x"><div class="trow t-matrix" style="border-bottom:1px solid var(--line);align-items:end"><span class="label-mono">Company</span>${head}</div>${matrix}</div>
      <div class="small" style="padding:16px 0 8px;line-height:1.5">Classification is a manual first pass based on public company descriptions, to be reviewed as companies change direction.</div>
    </section>`, 'For information only, not investment advice.');
}

/* ------------------------------------------------------------ boot */

const RENDER = { overview: renderOverview, markets: renderMarkets, sentiment: renderSentiment, industry: renderIndustry };
const TITLES = { overview: 'Overview', markets: 'Markets', sentiment: 'Sentiment', industry: 'Industry map' };

async function boot() {
  const page = document.body.dataset.page;
  const root = document.getElementById('app');
  try {
    const res = await fetch('data/data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const draw = () => { root.innerHTML = RENDER[page](data); };
    draw();
    document.title = 'Quantum Daily · ' + TITLES[page];
    if (page === 'markets') {
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-filter]');
        if (!b) return;
        marketsState.filter = b.dataset.filter;
        draw();
        const again = root.querySelector(`[data-filter="${marketsState.filter}"]`);
        if (again) again.focus();
      });
    }
  } catch (err) {
    root.innerHTML = `<div class="page"><div class="loading">Could not load the data (${esc(err.message)}). Try again in a moment.</div></div>`;
  }
}

if (typeof document !== 'undefined' && document.body && document.body.dataset.page) boot();
