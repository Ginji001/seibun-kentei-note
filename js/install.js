// Chrome only offers this event when installation is available. Safari keeps its existing instructions.
const button = document.querySelector('#install-app');
const standalone = window.matchMedia('(display-mode: standalone)');
let installPrompt = null;
let installed = false;
const isStandalone = () => standalone.matches || navigator.standalone === true;
function updateButton() {
  button.hidden = !installPrompt || installed || isStandalone();
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  updateButton();
});
window.addEventListener('appinstalled', () => {
  installed = true;
  installPrompt = null;
  updateButton();
});
standalone.addEventListener('change', updateButton);
button.addEventListener('click', async () => {
  const prompt = installPrompt;
  if (!prompt || installed || isStandalone()) return;
  installPrompt = null;
  updateButton();
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') installed = true;
  } catch {
    document.querySelector('#status').textContent = 'インストールできませんでした。Chromeのメニューから再度お試しください。';
  }
  updateButton();
});
