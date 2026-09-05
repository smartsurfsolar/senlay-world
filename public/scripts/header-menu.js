(function () {
  const CLOSE_DELAY_MS = 4200;

  const timers = new WeakMap();

  function clearTimer(element) {
    const timer = timers.get(element);
    if (timer) {
      window.clearTimeout(timer);
      timers.delete(element);
    }
  }

  function schedule(element, closeFn) {
    clearTimer(element);
    timers.set(element, window.setTimeout(closeFn, CLOSE_DELAY_MS));
  }

  function closeMobileNav() {
    const nav = document.querySelector('.header .nav.open');
    const button = document.querySelector('.header .hamburger.active');
    if (nav) nav.classList.remove('open');
    if (button) {
      button.classList.remove('active');
      button.setAttribute('aria-expanded', 'false');
    }
  }

  function initDetailsMenus() {
    document.querySelectorAll('.header details.nav-menu').forEach((menu) => {
      const close = () => {
        menu.open = false;
        clearTimer(menu);
      };

      menu.addEventListener('toggle', () => {
        if (!menu.open) {
          clearTimer(menu);
          return;
        }

        document.querySelectorAll('.header details.nav-menu[open]').forEach((other) => {
          if (other !== menu) other.open = false;
        });
        schedule(menu, close);
      });

      ['pointermove', 'focusin', 'click'].forEach((eventName) => {
        menu.addEventListener(eventName, () => {
          if (menu.open) schedule(menu, close);
        });
      });

      menu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', close);
      });
    });
  }

  function initMobileNav() {
    const header = document.querySelector('.header');
    const nav = header?.querySelector('.nav');
    const button = header?.querySelector('.hamburger');
    if (!header || !nav || !button) return;
    button.setAttribute('aria-expanded', String(nav.classList.contains('open')));
    if (!nav.id) nav.id = 'primary-navigation';
    button.setAttribute('aria-controls', nav.id);

    const close = () => {
      closeMobileNav();
      clearTimer(nav);
    };

    button.addEventListener('click', () => {
      button.setAttribute('aria-expanded', String(nav.classList.contains('open')));
      window.setTimeout(() => {
        if (nav.classList.contains('open')) schedule(nav, close);
        else clearTimer(nav);
      }, 0);
    });

    ['pointermove', 'focusin', 'click'].forEach((eventName) => {
      nav.addEventListener(eventName, () => {
        if (nav.classList.contains('open')) schedule(nav, close);
      });
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', close);
    });
  }

  function initGlobalClose() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('.header')) {
        document.querySelectorAll('.header details.nav-menu[open]').forEach((menu) => {
          menu.open = false;
          clearTimer(menu);
        });
        closeMobileNav();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.header details.nav-menu[open]').forEach((menu) => {
        menu.open = false;
        clearTimer(menu);
      });
      closeMobileNav();
    });
  }

  function init() {
    initDetailsMenus();
    initMobileNav();
    initGlobalClose();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
