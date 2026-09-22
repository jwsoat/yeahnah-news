// yeah nah news — edition renderer
// Loads editions from /editions/*.json, renders latest on the home page,
// lists all on the archive page. Pipeline just drops a JSON file per edition.

const EDITIONS_DIR = '/editions/';

// Escape HTML in user/JSON-derived strings to avoid injection
function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function loadEditions() {
  // Fetch a directory listing. Many static hosts don't list directories, so
  // fall back to a manifest file at /editions/manifest.json (list of slugs).
  try {
    const res = await fetch(EDITIONS_DIR + 'manifest.json');
    if (res.ok) {
      const slugs = await res.json(); // e.g. ["2026-09-21"]
      const loaded = await Promise.all(slugs.map(async (s) => {
        const r = await fetch(EDITIONS_DIR + s + '.json');
        return r.ok ? r.json() : null;
      }));
      return loaded.filter(Boolean).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }
  } catch (_) { /* fall through */ }

  // No manifest -> try a known default edition so local dev works.
  try {
    const r = await fetch(EDITIONS_DIR + '2026-09-21.json');
    if (r.ok) return [await r.json()];
  } catch (_) { /* no default */ }

  return [];
}

function renderStory(story) {
  let html = `<article class="story" id="${esc(story.id)}">
    <div class="story-category">${esc(story.category)}</div>
    <h2 class="story-headline">${esc(story.headline)}</h2>
    <p class="story-summary">${esc(story.summary)}</p>
    <div class="story-body">`;

  if (Array.isArray(story.body)) {
    for (const block of story.body) {
      if (block.kind === 'banter') {
        html += `<p class="block-banter">${esc(block.text)}</p>`;
      } else if (block.kind === 'fact') {
        html += `<p class="block-fact">${esc(block.text)}</p>`;
      } else {
        html += `<p>${esc(block.text)}</p>`;
      }
    }
  }

  html += `</div>`;

  // Bottom-of-story affiliate CTA (intent signal): rendered only after the
  // full story, never pre-loaded. Shows disclosure + optional items.
  // The CTA config is edition-level, serialized into the story namespace by
  // the pipeline so each edition's CTA slot is filled. Falls back gracefully.
  const c = story.affiliate_cta || story.edition_cta;
  if (c && c.enabled) {
    html += renderCta(c);
  }

  html += `</article>`;
  return html;
}

function renderCta(c) {
  if (!c || !c.enabled) return '';
  let items = '';
  if (Array.isArray(c.items)) {
    for (const it of c.items) {
      const endors = it.endorsement ? `<span class="cta-endorsement">${esc(it.endorsement)}</span>` : '';
      items += `<li class="cta-item">
        <a href="${esc(it.url)}" rel="sponsored" target="_blank" rel="noopener">${esc(it.label)}</a>${endors}
      </li>`;
    }
  }
  const cmp = c.items && c.items.length ? `<ul class="cta-items">${items}</ul>` : '';
  return `<div class="cta" data-intent="reveal">
    <details>
      <summary><strong>${esc(c.headline)}</strong></summary>
      <p>${esc(c.body)}</p>
      ${cmp}
      <p class="cta-disclosure">${esc(c.disclosure)}</p>
      <p class="cta-analytics">value tracked: purchase / detail capture</p>
    </details>
  </div>`;
}

function renderHero(edition) {
  const minutes = edition.reading_minutes || 3;
  const metaText = `${minutes} min read · ${(edition.stories || []).length} stories · fact-checked ✅`;
  return `
    <div class="edition-kicker">${esc(edition.edition)}</div>
    <h1 class="edition-title">${esc(edition.tagline)}</h1>
    <p class="edition-meta">${esc(metaText)}</p>`;
}

async function renderHome() {
  const editions = await loadEditions();
  const hero = document.getElementById('edition-hero');
  const storiesEl = document.getElementById('stories');
  if (!editions.length) {
    hero.hidden = false;
    hero.innerHTML = `<div class="edition-kicker">nothing yet</div>
      <h1 class="edition-title">First edition loading…</h1>
      <p class="edition-meta">The machine is warming up. Check back at 9am tomorrow.</p>`;
    return;
  }
  const latest = editions[editions.length - 1];
  hero.hidden = false;
  hero.innerHTML = renderHero(latest);
  // Inject the edition-level CTA into each story so every full-read
  // shows the bottom-of-story intent-gated CTA (Q38).
  const editionCta = latest.affiliate_cta;
  const stories = (latest.stories || []).map((s) => {
    return editionCta ? { ...s, edition_cta: editionCta } : s;
  });
  storiesEl.innerHTML = stories.map(renderStory).join('');
}

async function renderArchive() {
  const editions = await loadEditions();
  const list = document.getElementById('archive-list');
  if (!editions.length) {
    list.innerHTML = `<p class="empty">No editions yet. The archive builds itself once we ship our first brief.</p>`;
    return;
  }
  list.innerHTML = editions.slice().reverse().map((e) => `
    <article class="archive-card">
      <h2>${esc(e.date || e.slug)}</h2>
      <p>${esc(e.edition)}</p>
      <p>${esc(e.tagline)}</p>
      <ul class="archive-topics">${(e.stories || []).map(s => `<li>${esc(s.category)}</li>`).join('')}</ul>
    </article>`).join('');
}

function wireForm() {
  const form = document.getElementById('capture-form');
  if (!form) return;
  // Kit (ConvertKit) capture — JWSOAT-54.
  // Public v3 key is safe in browser JS (Kit's supported client-side path).
  // The SECRET key never lives here; it stays in the Jwsoat vault.
  const KIT_FORM_ID = '9941784';
  const KIT_PUBLIC_KEY = 'nE24zwepUXsqmbceYwccXA';
  const KIT_ENDPOINT = `https://api.convertkit.com/v3/forms/${KIT_FORM_ID}/subscribe`;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const note = document.getElementById('capture-note');
    const btn = form.querySelector('button');
    if (!email) return;
    btn.disabled = true;
    btn.textContent = 'Subscribing…';
    note.dataset.state = 'pending';
    note.textContent = 'Subscribing…';
    try {
      const res = await fetch(KIT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ api_key: KIT_PUBLIC_KEY, email, first_name: '' })
      });
      const data = await res.json();
      if (res.ok && data.subscription) {
        note.dataset.state = 'ok';
        note.textContent = `Nice one — ${email} is on the list. Check your inbox to confirm, then we'll ping you tomorrow 9am.`;
      } else {
        note.dataset.state = 'error';
        const msg = (data.error && data.error.join ? data.error.join(', ') : 'Something went wrong') || 'Something went wrong';
        note.textContent = `Hmm: ${msg}. Try again or email us directly.`;
        btn.disabled = false;
        btn.textContent = 'Count me in';
      }
    } catch (_) {
      note.dataset.state = 'error';
      note.textContent = 'Couldn\'t reach the signup server. Please try again shortly.';
      btn.disabled = false;
      btn.textContent = 'Count me in';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
  wireForm();

  const path = window.location.pathname;
  if (path.endsWith('archive') || path.endsWith('archive.html')) {
    renderArchive();
  } else {
    renderHome();
  }
});