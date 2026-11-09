/* Lazy-load the real scan only when the homepage figure is visible. */
window.createSplatScene = function (map, camera, hud, reduceMotion) {
  let scene, disposed = false;
  const viewButtons = [...document.querySelectorAll('[data-map-view]')];
  viewButtons.forEach(button => button.disabled = true);
  hud.status.textContent = 'Loading real scan…';
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(e => e.isIntersecting)) return;
    observer.disconnect();
    import('./dataset-scene.js?v=20261110-replay').then(async module => {
      scene = await module.createDatasetScene(map, camera, hud, reduceMotion);
      if (disposed) { scene.destroy(); return; }
      document.querySelector('.map-controls').hidden = false;
      document.querySelector('.replay-controls').hidden = false;
      viewButtons.forEach(button => button.disabled = false);
    }).catch(error => {
      console.warn('Scan could not be loaded', error);
      hud.status.textContent = 'Scan unavailable';
      document.getElementById('map-caption').textContent = 'The real 3D scan could not load. Check your connection and reload. Please try reloading the page.';
      document.querySelector('.map-controls').hidden = true;
    });
  });
  observer.observe(map);
  return { refreshColors() { scene?.refreshColors(); }, destroy() { disposed = true; observer.disconnect(); scene?.destroy(); } };
};
