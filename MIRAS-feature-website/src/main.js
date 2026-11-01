import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initHero } from './hero.js';
import './style.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import { mountChrome, reveal } from './ui/shell.js';
import { renderHome } from './pages/home.js';

gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lite = matchMedia('(max-width: 820px), (pointer: coarse)').matches;
const $ = (s, el = document) => el.querySelector(s);

// ---------- site chrome and homepage sections (everything below the hero) ----------
const { closeMenu } = mountChrome({ section: '', home: true, header: $('#header'), footer: $('#footer') });
renderHome($('#home'));

// ---------- smooth scroll ----------
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ duration: 1.25, smoothWheel: true, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

const headerH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
function scrollToHash(hash) {
  const target = hash === '#top' ? 0 : $(hash);
  if (target === null) return;
  const offset = hash === '#top' ? 0 : -headerH() + 1;
  if (lenis) lenis.scrollTo(target, { offset, duration: 1.6 });
  else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + scrollY + offset });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href').length < 2) return;
  e.preventDefault();
  closeMenu();
  scrollToHash(a.getAttribute('href'));
  if (a.getAttribute('href') !== '#top') history.replaceState(null, '', a.getAttribute('href'));
});

// ---------- header ----------
// The header stays hidden over the hero and slides in once the first section is reached.
const header = $('#header');
ScrollTrigger.create({
  trigger: '#about',
  start: () => `top ${innerHeight * 0.6}px`,
  onEnter: () => { header.classList.add('show'); document.documentElement.classList.add('past-hero'); },
  onLeaveBack: () => { header.classList.remove('show'); document.documentElement.classList.remove('past-hero'); closeMenu(); },
});

// ---------- hero ----------
const media = $('#heroMedia');
let hero = null;
initHero({ canvas: $('#heroGL'), birdCanvas: $('#heroBirds'), lite, reduced, onReady: () => media.classList.add('live') })
  .then((h) => (hero = h))
  .catch((err) => console.warn('Hero animation unavailable, showing the still illustration.', err));

// title: letters in one by one, then the divider grows out from the star
const intro = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.25 });
intro
  .from('.miras span', { opacity: 0, y: 26, duration: 1.3, stagger: 0.12 })
  .from('.city', { opacity: 0, y: 12, duration: 1 }, '-=0.7')
  .from('.sub > *', { opacity: 0, y: 10, duration: 0.9, stagger: 0.15 }, '-=0.6')
  .from('.divider .star', { opacity: 0, scale: 0, rotate: -90, duration: 0.8 }, '-=0.4')
  .from('.divider .ln', { scaleX: 0, duration: 1.4, ease: 'power2.inOut' }, '-=0.35')
  .from('.hero-title .btn', { opacity: 0, y: 10, duration: 0.9 }, '-=0.7')
  .from('.scroll-cue', { opacity: 0, duration: 1 }, '-=0.4');

if (!reduced) {
  // scroll: zoom toward the street, title lifts away, view settles into paper
  gsap.timeline({
    scrollTrigger: {
      trigger: '.hero', start: 'top top', end: 'bottom bottom', scrub: 0.6,
      onUpdate: (self) => hero?.setProgress(self.progress),
    },
  })
    .to(media, { scale: lite ? 1.12 : 1.2, yPercent: -3, ease: 'none', duration: 1 }, 0)
    .to('.hero-title', { y: () => -innerHeight * 0.16, opacity: 0, ease: 'power1.in', duration: 0.5 }, 0)
    .to('.hero-veil', { opacity: 0, ease: 'none', duration: 0.5 }, 0)
    .to('.scroll-cue', { opacity: 0, ease: 'none', duration: 0.12 }, 0)
    .to('.hero-fade', { opacity: 0.72, ease: 'power1.in', duration: 0.4 }, 0.6);
}

// ---------- reveals below the hero ----------
reveal($('#home'));

// fonts change line heights: re-measure once they arrive
document.fonts?.ready.then(() => ScrollTrigger.refresh());
