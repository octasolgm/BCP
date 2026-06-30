(function () {
  function upgradePromptFields() {
    document
      .querySelectorAll(
        'tr[data-param-name="prompt"] input, tr[data-param-name="Prompt"] input, tr[data-param-name="prompt"] textarea, tr[data-param-name="Prompt"] textarea',
      )
      .forEach(function (field) {
        if (field.dataset.bcpTextarea === '1') return;

        var textarea = document.createElement('textarea');
        textarea.name = field.name;
        textarea.className = field.className + ' bcp-prompt-textarea';
        textarea.value = field.value;
        textarea.rows = 20;
        textarea.placeholder =
          'Paste your full compliance / extraction prompt here…';
        textarea.dataset.bcpTextarea = '1';

        field.parentNode.replaceChild(textarea, field);
      });
  }

  function observeSwagger() {
    upgradePromptFields();
    var observer = new MutationObserver(upgradePromptFields);
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(upgradePromptFields, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeSwagger);
  } else {
    observeSwagger();
  }
})();
