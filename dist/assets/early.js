/* Runs before first paint (blocking, tiny): marks the page as scripted so the phone header renders
   collapsed from the start instead of collapsing after the deferred scripts load (no layout shift). */
document.documentElement.classList.add('js');
