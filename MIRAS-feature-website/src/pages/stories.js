import { stories } from '../data/index.js';
import { storyRow, sourceBadge, emptyState } from '../ui/components.js';
import { pageHead, subNav, reveal } from '../ui/shell.js';
import { doodle } from '../ui/icons.js';

const TYPES = /** @type {const} */ (['All', 'History', 'Oral tradition', 'Legend']);

/** @param {HTMLElement} main */
export function render(main) {
  let type = /** @type {string} */ ('All');
  main.innerHTML = `
    ${pageHead({ label: 'Stories', title: 'Stories behind the stones', titleHi: 'पत्थरों के पीछे की कहानियाँ', lead: 'Short readings about the places you will walk past, each one honest about what kind of story it is.', art: doodle.book })}
    ${subNav('stories')}
    <section class="m-section"><div class="m-wrap">
      <div class="p-split" style="margin-bottom:40px">
        <div class="p-box p-box--paper">
          <h3>Three kinds of story</h3>
          <dl class="m-kv" style="grid-template-columns:auto 1fr;align-items:center">
            <dt>${sourceBadge('History')}</dt><dd>Documented in written records.</dd>
            <dt>${sourceBadge('Oral tradition')}</dt><dd>Passed down locally, by people who live here.</dd>
            <dt>${sourceBadge('Legend')}</dt><dd>Told and retold; not to be read as fact.</dd>
          </dl>
        </div>
        <div class="p-box">
          <h3>Where these stories stand today</h3>
          <p style="margin:0">None of these entries has yet been checked by a second person, so none is marked Verified. Some are written only to show the format and are marked Illustrative. The source reference is always printed in full under each story.</p>
        </div>
      </div>
      <div class="m-filters" role="group" aria-label="Filter by source type" style="margin-bottom:20px">
        ${TYPES.map((t) => `<button class="m-filter" type="button" data-type="${t}" aria-pressed="${t === 'All'}">${t}</button>`).join('')}
      </div>
      <p class="m-count" data-count aria-live="polite"></p>
      <div data-list></div>
    </div></section>`;

  const list = /** @type {HTMLElement} */ (main.querySelector('[data-list]'));
  const count = /** @type {HTMLElement} */ (main.querySelector('[data-count]'));
  const draw = () => {
    const items = stories.filter((s) => type === 'All' || s.sourceType === type);
    count.textContent = `${items.length} ${items.length === 1 ? 'story' : 'stories'}`;
    list.innerHTML = items.length ? items.map(storyRow).join('') : emptyState({ title: 'No stories of this kind yet', body: 'Try another source type.' });
    main.querySelectorAll('[data-type]').forEach((b) => b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.type === type)));
    reveal(list);
  };
  main.addEventListener('click', (e) => {
    const b = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('[data-type]'));
    if (b) { type = b.dataset.type ?? 'All'; draw(); }
  });
  draw();
}
