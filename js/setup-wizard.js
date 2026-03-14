/**
 * SANGOCAST SETUP WIZARD
 * Assistant de première installation / First-install wizard
 * Bilingual: French + English displayed simultaneously
 *
 * Fixes in this version:
 *  A. toggleBible / toggleAudioHours now re-render the current step
 *  B. "Never" audio slot: mutually exclusive + correct empty-array check
 *  C. Progress bar aria-valuenow correct from first render
 *  D. Tradition label EN typo removed (extra leading space)
 *  E. Prayer-time grid uses auto-fit for flexible layout
 *  F. CSS :focus outline for keyboard navigation
 *  G. Enter / Space keyboard support on all role="button" cards
 *  H. bi() helper eliminates repetitive bilingual span markup
 */

// ─── Mobile detection (global) ────────────────────────────────────────────
function isSmallPhone() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  return /android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}
function applyMobileClass() {
  if (isSmallPhone()) document.body.classList.add('is-mobile');
}

// ─── Bilingual helper — FIX H ────────────────────────────────────────────
// bi(fr, en) → '<span class="fr">…</span><span class="en">…</span>'
function bi(fr, en) {
  return `<span class="fr">${fr}</span><span class="en">${en}</span>`;
}
// ─────────────────────────────────────────────────────────────────────────

const SangocastSetupWizard = (() => {
  'use strict';

  const STEPS = {
    STORAGE_CHECK: 1,
    AUDIENCE:      2,
    LANGUAGE:      3,
    TRADITION:     4,
    CHANNEL:       5,
    BIBLE:         6,
    PRAYER_TIMES:  7,
    DOWNLOAD:      8
  };

  let currentStep = STEPS.STORAGE_CHECK;
  let preferences = {
    storageAvailable: 0,
    ageMode:         'family_mode',
    language:        'en-US',
    tradition:       'reformed',
    channelId:       null,
    channelMetadata: null,
    bibleVersions:   [],
    prayerTimes:     [6, 12, 18, 21],
    audioHours:      [],
    installDate:     new Date().toISOString()
  };

  let availableChannels = [];

  // ─── Init ────────────────────────────────────────────────────────────────

  async function init() {
    if (localStorage.getItem('sangocast_configured') === 'true') {
      console.log('⚠️ SangoCast déjà configuré / Already configured');
      return false;
    }
    createWizardUI();
    applyMobileClass();
    // FIX C: update progress immediately so aria-valuenow is correct from step 1
    updateProgress();
    await loadAvailableChannels();
    showStep(STEPS.STORAGE_CHECK);
    return true;
  }

  // ─── Channel helpers ─────────────────────────────────────────────────────

  function normalizeChannel(ch) {
    if (ch.metadata && typeof ch.metadata === 'object') return ch;
    const typeMap      = { evergreen: 'SCR', liturgical: 'LEC', event: 'EVT', scripture: 'SCR', prayer: 'SCR' };
    const traditionMap = { ecumenical: 'interconfessional' };
    const rawTradition = ch.tradition || 'interconfessional';
    return {
      id:   ch.id,
      type: typeMap[ch.type] || typeMap[ch.category] || 'SCR',
      metadata: {
        name:        ch.name        || ch.id,
        description: ch.description || '',
        tradition:   traditionMap[rawTradition] || rawTradition,
        featured:    ch.featured    || false,
        author:      ch.author      || ''
      },
      defaultSettings: {
        recommendedBible: (ch.defaultContent && ch.defaultContent.translation) || 'KJV'
      }
    };
  }

  function getDefaultChannels() {
    return [
      {
        id: 'SCR-EN-GL-0001', type: 'SCR',
        metadata: {
          name:        'Global Daily Scripture',
          name_fr:     'Écriture Quotidienne Mondiale',
          description: 'A Bible verse for each day of the year — balanced, accessible, and open to all.',
          desc_fr:     'Un verset biblique par jour — équilibré, accessible et ouvert à tous.',
          tradition:   'interconfessional',
          featured:    true
        },
        defaultSettings: { readingPlan: 'horner', recommendedBible: 'KJV' }
      },
      {
        id: 'SCR-EN-GL-HOPE', type: 'SCR',
        metadata: {
          name:        'Hope Verses',
          name_fr:     'Versets d\'Espérance',
          description: 'Daily scriptures anchored in the hope we have in Christ.',
          desc_fr:     'Des versets quotidiens ancrés dans l\'espérance que nous avons en Christ.',
          tradition:   'interconfessional',
          featured:    true
        },
        defaultSettings: { recommendedBible: 'KJV' }
      },
      {
        id: 'SCR-EN-GL-PRAISE', type: 'SCR',
        metadata: {
          name:        'Praise & Worship',
          name_fr:     'Louange & Adoration',
          description: 'Verses that call the soul to worship — Psalms, hymns, and spiritual songs.',
          desc_fr:     'Des versets qui appellent l\'âme à l\'adoration — Psaumes, hymnes et cantiques.',
          tradition:   'interconfessional',
          featured:    true
        },
        defaultSettings: { recommendedBible: 'KJV' }
      }
    ];
  }

  async function loadAvailableChannels() {
    try {
      const response = await fetch('/data/channels.json');
      if (response.ok) {
        const data = await response.json();
        availableChannels = (data.channels || []).map(normalizeChannel);
        console.log('✅ Channels chargées / loaded:', availableChannels.length);
      } else {
        console.warn('⚠️ channels.json non trouvé (HTTP ' + response.status + ') — defaults used');
        availableChannels = getDefaultChannels();
      }
    } catch (error) {
      console.warn('⚠️ Cannot load channels (offline?) — using built-in defaults:', error);
      availableChannels = getDefaultChannels();
    }
  }

  // ─── UI shell ────────────────────────────────────────────────────────────

  function createWizardUI() {
    if (document.getElementById('sangocast-setup-wizard')) return;

    const wizard = document.createElement('div');
    wizard.id = 'sangocast-setup-wizard';
    wizard.innerHTML = `
      <div class="wizard-overlay"></div>
      <div class="wizard-container" role="dialog" aria-modal="true" aria-label="SangoCast Setup">
        <div class="wizard-progress">
          <div class="progress-bar" role="progressbar"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="12"
               aria-label="Setup progress">
            <div class="progress-fill" id="wizard-progress-fill"></div>
          </div>
          <div class="progress-text" id="wizard-progress-text" aria-live="polite">
            ${bi('Étape 1/8', 'Step 1/8')}
          </div>
        </div>
        <div class="wizard-content" id="wizard-content"></div>
        <div class="wizard-actions">
          <button class="btn-secondary" id="wizard-prev"
                  onclick="SangocastSetupWizard.previousStep()"
                  aria-label="Previous step / Étape précédente">
            ${bi('← Précédent', '← Back')}
          </button>
          <button class="btn-primary" id="wizard-next"
                  onclick="SangocastSetupWizard.nextStep()"
                  aria-label="Next step / Étape suivante">
            ${bi('Suivant →', 'Next →')}
          </button>
        </div>
      </div>
    `;

    injectStyles();
    document.body.appendChild(wizard);
  }

  // ─── CSS ─────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('sangocast-wizard-styles')) return;

    const style = document.createElement('style');
    style.id = 'sangocast-wizard-styles';
    style.textContent = `
      /* ─── Bilingual spans ─────────────────────────────────────────────── */
      .fr, .en { display: block; }
      .fr { font-style: normal; }
      .en { font-style: italic; opacity: 0.72; font-size: 0.91em; }

      /* Inline inside buttons and progress text */
      button .fr, button .en,
      .progress-text .fr, .progress-text .en { display: inline; }
      button .en::before,
      .progress-text .en::before { content: ' / '; opacity: 0.5; }

      /* Welcome screen intro paragraphs */
      .intro-text-div .fr { font-style: normal; color: #374151; }
      .intro-text-div .en { font-style: italic; opacity: 0.72; color: #4b5563; font-size: 0.93em; }

      /* ─── Root container ──────────────────────────────────────────────── */
      #sangocast-setup-wizard {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 999999;
      }

      #sangocast-setup-wizard * {
        box-sizing: border-box !important;
        color: inherit !important;
      }

      /* ─── Overlay ─────────────────────────────────────────────────────── */
      #sangocast-setup-wizard .wizard-overlay {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
      }

      /* ─── Container ───────────────────────────────────────────────────── */
      #sangocast-setup-wizard .wizard-container {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 96%;
        max-width: 760px;
        max-height: 92vh;
        background: white;
        color: #111827 !important;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
      }

      /* ─── Progress ────────────────────────────────────────────────────── */
      #sangocast-setup-wizard .wizard-progress {
        padding: 24px 24px 16px;
        border-bottom: 1px solid #e5e7eb;
      }

      #sangocast-setup-wizard .progress-bar {
        height: 8px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 12px;
      }

      #sangocast-setup-wizard .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        transition: width 0.3s ease;
        width: 12.5%;
      }

      #sangocast-setup-wizard .progress-text {
        font-size: 14px;
        color: #666 !important;
        font-weight: 600;
      }

      /* ─── Content & actions ───────────────────────────────────────────── */
      #sangocast-setup-wizard .wizard-content {
        flex: 1;
        overflow-y: auto;
        padding: clamp(16px,4vw,32px) clamp(14px,3.5vw,24px);
      }

      #sangocast-setup-wizard .wizard-actions {
        padding: clamp(12px,3vw,16px) clamp(14px,3.5vw,24px);
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      #sangocast-setup-wizard .wizard-actions button {
        flex: 1;
        padding: clamp(11px,3vw,14px) 16px;
        border: none;
        border-radius: 10px;
        font-weight: 600;
        font-size: clamp(14px,3.8vw,15px);
        cursor: pointer;
        transition: all 0.2s;
      }

      #sangocast-setup-wizard .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white !important;
      }

      #sangocast-setup-wizard .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102,126,234,0.4);
      }

      #sangocast-setup-wizard .btn-primary:disabled {
        opacity: 0.5; cursor: not-allowed; transform: none;
      }

      #sangocast-setup-wizard .btn-secondary {
        background: #f3f4f6;
        color: #4b5563 !important;
      }

      #sangocast-setup-wizard .btn-secondary:hover { background: #e5e7eb; }

      /* ─── FIX F: keyboard focus outline ──────────────────────────────── */
      #sangocast-setup-wizard .option-card:focus,
      #sangocast-setup-wizard [role="button"]:focus {
        outline: 3px solid #667eea;
        outline-offset: 2px;
      }

      /* ─── Step typography ─────────────────────────────────────────────── */
      #sangocast-setup-wizard .step-title {
        font-size: clamp(20px,5.5vw,28px);
        font-weight: 700;
        color: #1f2937 !important;
        margin-bottom: 12px;
        word-break: break-word;
      }

      #sangocast-setup-wizard .step-title .en {
        font-size: 0.65em;
        font-weight: 500;
        margin-top: 2px;
      }

      #sangocast-setup-wizard .step-description {
        font-size: clamp(14px,3.8vw,16px);
        color: #6b7280 !important;
        margin-bottom: clamp(20px,5vw,32px);
        line-height: 1.6;
        word-break: break-word;
      }

      /* ─── Option cards ────────────────────────────────────────────────── */
      #sangocast-setup-wizard .option-grid { display: grid; gap: 12px; }

      #sangocast-setup-wizard .option-card {
        padding: 20px;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
        color: #111827 !important;
      }

      #sangocast-setup-wizard .option-card:hover {
        border-color: #667eea;
        transform: translateY(-2px);
      }

      #sangocast-setup-wizard .option-card.selected {
        border-color: #667eea;
        background: #f5f3ff;
      }

      #sangocast-setup-wizard .option-icon  { font-size: 32px; margin-bottom: 8px; }
      #sangocast-setup-wizard .option-title { font-weight: 700; font-size: 16px; margin-bottom: 4px; color: #1f2937 !important; }
      #sangocast-setup-wizard .option-desc  { font-size: 14px; color: #6b7280 !important; }

      /* ─── Checkboxes ──────────────────────────────────────────────────── */
      #sangocast-setup-wizard .checkbox-group { display: grid; gap: 12px; }

      #sangocast-setup-wizard .checkbox-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: #f9fafb;
        border-radius: 8px;
        cursor: pointer;
      }

      #sangocast-setup-wizard .checkbox-item input[type="checkbox"] {
        width: 20px; height: 20px; cursor: pointer;
      }

      #sangocast-setup-wizard .checkbox-label {
        font-size: 15px; font-weight: 500; color: #1f2937 !important;
      }

      /* ─── Storage display ─────────────────────────────────────────────── */
      #sangocast-setup-wizard .storage-info {
        display: flex;
        justify-content: space-between;
        padding: 16px;
        background: #f0fdf4;
        border-radius: 8px;
        margin-bottom: 20px;
      }

      #sangocast-setup-wizard .storage-item    { text-align: center; }
      #sangocast-setup-wizard .storage-value   { font-size: 24px; font-weight: 700; color: #10b981 !important; }
      #sangocast-setup-wizard .storage-label   { font-size: 12px; color: #059669 !important; text-transform: uppercase; margin-top: 4px; }

      /* ─── Download progress ───────────────────────────────────────────── */
      #sangocast-setup-wizard .download-progress { margin-top: 24px; }
      #sangocast-setup-wizard .download-item     { margin-bottom: 16px; }
      #sangocast-setup-wizard .download-name     { font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #1f2937 !important; }
      #sangocast-setup-wizard .download-bar      { height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden; }
      #sangocast-setup-wizard .download-fill     { height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); transition: width 0.3s; }

      /* ─── Responsive ──────────────────────────────────────────────────── */
      @media (max-width: 640px) {
        #sangocast-setup-wizard .wizard-container {
          width: 98%; max-height: 95vh; border-radius: 14px;
        }
      }

      @media (max-width: 480px) {
        #sangocast-setup-wizard .option-card    { padding: 14px; }
        #sangocast-setup-wizard .option-icon    { font-size: 24px; }
        #sangocast-setup-wizard .option-title   { font-size: clamp(14px,4vw,16px); }
        #sangocast-setup-wizard .option-desc    { font-size: clamp(12px,3.2vw,14px); }
        #sangocast-setup-wizard .checkbox-label { font-size: clamp(13px,3.5vw,15px); }
      }

      /* ─── Mobile class (.is-mobile on <body>) ─────────────────────────── */
      body.is-mobile .intro-text-div               { line-height: 1.5; padding: 8px 0; }
      body.is-mobile .intro-text-div p             { margin: 0 0 10px !important; }
      body.is-mobile #sangocast-setup-wizard .wizard-container { width: 89%; }
    `;

    document.head.appendChild(style);
  }

  // ─── FIX G: keyboard activation for card-style role="button" elements ────
  // Called once after each step renders.
  function attachCardKeyboard() {
    const content = document.getElementById('wizard-content');
    if (!content) return;
    content.querySelectorAll('[role="button"]').forEach(el => {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      });
    });
  }

  // ─── Step navigation ─────────────────────────────────────────────────────

  function showStep(step) {
    currentStep = step;
    updateProgress();

    const content = document.getElementById('wizard-content');
    const prevBtn = document.getElementById('wizard-prev');
    const nextBtn = document.getElementById('wizard-next');

    prevBtn.style.display = step === STEPS.STORAGE_CHECK ? 'none' : 'flex';
    nextBtn.innerHTML = bi('Suivant →', 'Next →');

    switch (step) {
      case STEPS.STORAGE_CHECK:
        content.innerHTML = getStorageCheckHTML();
        checkStorage();
        break;
      case STEPS.AUDIENCE:     content.innerHTML = getAudienceHTML();    break;
      case STEPS.LANGUAGE:     content.innerHTML = getLanguageHTML();    break;
      case STEPS.TRADITION:    content.innerHTML = getTraditionHTML();   break;
      case STEPS.CHANNEL:      content.innerHTML = getChannelHTML();     break;
      case STEPS.BIBLE:        content.innerHTML = getBibleHTML();       break;
      case STEPS.PRAYER_TIMES: content.innerHTML = getPrayerTimesHTML(); break;
      case STEPS.DOWNLOAD:
        content.innerHTML = getDownloadHTML();
        nextBtn.innerHTML = bi('Terminer ✓', 'Finish ✓');
        startDownload();
        break;
    }

    forceTextColors();
    attachCardKeyboard(); // FIX G
  }

  function updateProgress() {
    const pct  = (currentStep / 8) * 100;
    const fill = document.getElementById('wizard-progress-fill');
    const text = document.getElementById('wizard-progress-text');
    const bar  = document.querySelector('.progress-bar');

    if (fill) fill.style.width = pct + '%';
    if (bar)  bar.setAttribute('aria-valuenow', Math.round(pct)); // FIX C
    if (text) text.innerHTML = bi(`Étape ${currentStep}/8`, `Step ${currentStep}/8`);
  }

  // ─── Step 1: Storage ─────────────────────────────────────────────────────

  function getStorageCheckHTML() {
    return `
      <div class="step-title">
        ${bi('💾 Vérification de l\'Espace', '💾 Checking Storage Space')}
      </div>
      <div class="step-description">
        ${bi(
          'Nous allons vérifier si vous avez suffisamment d\'espace pour SangoCast.',
          'We will check if you have enough storage space for SangoCast.'
        )}
      </div>

      <div class="storage-info" id="storage-display">
        <div class="storage-item">
          <div class="storage-value" id="storage-available">-</div>
          <div class="storage-label">${bi('Disponible', 'Available')}</div>
        </div>
        <div class="storage-item">
          <div class="storage-value">4.6 MB</div>
          <div class="storage-label">${bi('Requis (Min)', 'Required (Min)')}</div>
        </div>
        <div class="storage-item">
          <div class="storage-value" id="storage-status">...</div>
          <div class="storage-label">${bi('Statut', 'Status')}</div>
        </div>
      </div>

      <div id="storage-message"></div>
    `;
  }

  async function checkStorage() {
    const statusEl  = document.getElementById('storage-status');
    const messageEl = document.getElementById('storage-message');
    const availEl   = document.getElementById('storage-available');

    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate  = await navigator.storage.estimate();
        const available = estimate.quota - estimate.usage;
        const mb        = (available / 1024 / 1024).toFixed(1);

        preferences.storageAvailable = available;
        if (availEl) availEl.textContent = mb + ' MB';

        if (available > 5 * 1024 * 1024) {
          if (statusEl)  { statusEl.textContent = '✅ OK'; statusEl.style.color = '#10b981'; }
          if (messageEl) messageEl.innerHTML = `<p style="color:#10b981;">${bi('✅ Vous avez suffisamment d\'espace !', '✅ You have enough storage space!')}</p>`;
        } else {
          if (statusEl)  { statusEl.textContent = '⚠️'; statusEl.style.color = '#f59e0b'; }
          if (messageEl) messageEl.innerHTML = `<p style="color:#f59e0b;">${bi('⚠️ Espace limité. Libérez quelques mégaoctets pour une meilleure expérience.', '⚠️ Limited space. Free up a few megabytes for a better experience.')}</p>`;
        }
      } else {
        throw new Error('navigator.storage.estimate not supported');
      }
    } catch (error) {
      console.warn('Cannot check storage:', error);
      if (availEl)   availEl.textContent  = '—';
      if (statusEl)  statusEl.textContent = '✓ Skip';
      if (messageEl) messageEl.innerHTML  = `<p style="color:#6b7280;">${bi('Vérification indisponible sur ce navigateur — vous pouvez continuer.', 'Storage check unavailable on this browser — you may continue.')}</p>`;
    }
  }

  // ─── Step 2: Audience ────────────────────────────────────────────────────

  function getAudienceHTML() {
    const card = (val, icon, frTitle, enTitle, frDesc, enDesc) => `
      <div class="option-card ${preferences.ageMode === val ? 'selected' : ''}"
           onclick="SangocastSetupWizard.selectAudience('${val}')"
           role="button" tabindex="0" aria-pressed="${preferences.ageMode === val}">
        <div class="option-icon">${icon}</div>
        <div class="option-title">${bi(frTitle, enTitle)}</div>
        <div class="option-desc">${bi(frDesc, enDesc)}</div>
      </div>`;

    return `
      <div class="step-title">${bi('👥 Pour Qui est SangoCast ?', '👥 Who is SangoCast For?')}</div>
      <div class="step-description">${bi('Sélectionnez qui utilisera cette application. Cela nous aide à filtrer le contenu approprié.', 'Select who will use this application. This helps us filter appropriate content.')}</div>
      <div class="option-grid">
        ${card('adults_only', '🔞', 'Adultes Uniquement', 'Adults Only', '18+ • Aucun filtrage de contenu', '18+ • No content filtering')}
        ${card('family_mode', '👨‍👩‍👧‍👦', 'Famille', 'Family', 'Tous âges • Contenu sensible filtré', 'All ages • Sensitive content filtered')}
        ${card('children_mode', '👶', 'Enfants', 'Children', '0-12 ans • Contenu approuvé uniquement', '0-12 years • Approved content only')}
      </div>
    `;
  }

  function selectAudience(mode) { preferences.ageMode = mode; showStep(currentStep); }

  // ─── Step 3: Language ────────────────────────────────────────────────────

  function getLanguageHTML() {
    const languages = [
      { code: 'en-US', fr: 'Anglais',   en: 'English',    icon: '🇺🇸' },
      { code: 'fr-FR', fr: 'Français',  en: 'French',     icon: '🇫🇷' },
      { code: 'es-ES', fr: 'Espagnol',  en: 'Spanish',    icon: '🇪🇸' },
      { code: 'pt-PT', fr: 'Portugais', en: 'Portuguese', icon: '🇵🇹' },
      { code: 'ln-CD', fr: 'Lingala',   en: 'Lingala',    icon: '🇨🇩' }
    ];

    return `
      <div class="step-title">${bi('🌍 Choisissez Votre Langue', '🌍 Choose Your Language')}</div>
      <div class="step-description">${bi('Sélectionnez la langue pour l\'interface et les annonces vocales.', 'Select the language for the interface and voice announcements.')}</div>
      <div class="option-grid">
        ${languages.map(l => `
          <div class="option-card ${preferences.language === l.code ? 'selected' : ''}"
               onclick="SangocastSetupWizard.selectLanguage('${l.code}')"
               role="button" tabindex="0" aria-pressed="${preferences.language === l.code}">
            <div class="option-icon">${l.icon}</div>
            <div class="option-title">${bi(l.fr, l.en)}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function selectLanguage(code) { preferences.language = code; showStep(currentStep); }

  // ─── Step 4: Tradition — fully bilingual titles ───────────────────────────

  function getTraditionHTML() {
    const card = (val, icon, frTitle, enTitle, frDesc, enDesc) => `
      <div class="option-card ${preferences.tradition === val ? 'selected' : ''}"
           onclick="SangocastSetupWizard.selectTradition('${val}')"
           role="button" tabindex="0" aria-pressed="${preferences.tradition === val}">
        <div class="option-icon">${icon}</div>
        <div class="option-title">${bi(frTitle, enTitle)}</div>
        <div class="option-desc">${bi(frDesc, enDesc)}</div>
      </div>`;

    return `
      <div class="step-title">${bi('⛪ Votre Tradition Liturgique', '⛪ Your Liturgical Tradition')}</div>
      <div class="step-description">${bi('Choisissez votre famille liturgique. Cela influence le calendrier et les chaînes recommandées.', 'Choose your liturgical family. This influences the calendar and recommended channels.')}</div>
      <div class="option-grid">
        ${card('western_latin', '✝️',  'Latin Occidental',    'Western Latin',    'Lectionnaire romain, rite latin, fêtes mariales',                    'Roman lectionary, Latin rite, Marian feasts')}
        ${card('reformed',      '✟',   'Réformé',             'Reformed',         'Revised Common Lectionary, tradition protestante réformée',          'Revised Common Lectionary, Reformed Protestant tradition')}
        ${card('eastern',       '☦',   'Oriental',            'Eastern',          'Calendrier byzantin, rite oriental, traditions orthodoxes',          'Byzantine calendar, Eastern rite, Orthodox traditions')}
        ${card('interconfessional', '🕊️', 'Interconfessionnel', 'Interconfessional', 'Ouvert à plusieurs traditions, approche œcuménique',             'Open to multiple traditions, ecumenical approach')}
      </div>
    `;
  }

  function selectTradition(t) { preferences.tradition = t; showStep(currentStep); }

  // ─── Step 5: Channel ─────────────────────────────────────────────────────

  function getChannelHTML() {
    const selected = availableChannels.find(c => c.id === preferences.channelId);

    return `
      <div class="step-title">${bi('📺 Choisissez Votre Chaîne', '📺 Choose Your Channel')}</div>
      <div class="step-description">${bi('Une chaîne définit votre plan de lecture, les enseignements pastoraux et les événements que vous suivez.', 'A channel defines your reading plan, pastoral teachings and events you follow.')}</div>

      <div>
        ${availableChannels.map(ch => {
          const isSel = preferences.channelId === ch.id;
          // Use bilingual metadata if available (defaults have name_fr/desc_fr)
          const nameDisplay = ch.metadata.name_fr
            ? bi(ch.metadata.name_fr, ch.metadata.name)
            : ch.metadata.name;
          const descDisplay = ch.metadata.desc_fr
            ? bi(ch.metadata.desc_fr, ch.metadata.description)
            : (ch.metadata.description || '');

          return `
          <div onclick="SangocastSetupWizard.selectChannel('${ch.id}')"
               role="button" tabindex="0" aria-pressed="${isSel}"
               style="margin-bottom:12px;cursor:pointer;padding:12px;
                      border-left:4px solid ${isSel ? '#667eea' : '#e5e7eb'};
                      background:${isSel ? '#f5f3ff' : 'transparent'};">
            <div style="color:${isSel ? '#667eea' : 'inherit'};font-weight:${isSel ? '700' : 'normal'};">
              ${isSel ? '✅ ' : ''}<strong>${nameDisplay}</strong>
              ${ch.metadata.featured ? `<span style="color:#10b981;">(${bi('Recommandé', 'Recommended')})</span>` : ''}
            </div>
            <div style="font-size:13px;color:#6b7280;">ID: ${ch.id}</div>
            <div style="font-size:13px;">${descDisplay}</div>
            ${ch.metadata.tradition ? `
            <div style="font-size:12px;color:#9ca3af;">
              ${bi('Tradition :', 'Tradition:')}
              ${ch.metadata.tradition.replace(/_/g, ' ')}
            </div>` : ''}
          </div>`;
        }).join('')}
      </div>

      ${preferences.channelId ? `
        <div style="margin-top:16px;padding:14px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:14px;color:#166534;">
          ✅ <strong>${bi('Chaîne chargée :', 'Channel loaded:')}</strong>
          ${selected?.metadata.name || preferences.channelId}
          <br><span style="font-size:12px;color:#4ade80;">ID: ${preferences.channelId}</span>
        </div>` : `
        <div style="margin-top:16px;padding:14px;background:#fefce8;border:1px solid #fde047;border-radius:8px;font-size:14px;color:#854d0e;">
          ${bi('⚠️ Aucune chaîne sélectionnée — cliquez sur une chaîne ci-dessus.', '⚠️ No channel selected — click a channel above.')}
        </div>`}

      <div style="margin-top:12px;padding:16px;background:#f9fafb;border-radius:8px;font-size:14px;color:#4b5563;">
        💡 ${bi('Vous pourrez changer de chaîne à tout moment dans les paramètres.', 'You can change your channel at any time in settings.')}
      </div>
    `;
  }

  function selectChannel(channelId) {
    preferences.channelId = channelId;
    const ch = availableChannels.find(c => c.id === channelId);
    if (ch) {
      preferences.channelMetadata = ch.metadata;
      const channelBible = ch.defaultSettings?.recommendedBible || 'kjv';
      const isFrench = preferences.language.startsWith('fr');
      preferences.bibleVersions = [isFrench ? 'lsg' : channelBible.toLowerCase()];
    }
    showStep(currentStep);
  }

  // ─── Step 6: Bible ───────────────────────────────────────────────────────

  function getBibleHTML() {
    const allBibles = [
      { code: 'lsg',              lang: 'fr', name: 'Louis Segond (LSG)',              size: '≈4.2 MB', desc: { fr: 'Traduction protestante la plus répandue en français',    en: 'Most widely-used French Protestant translation' } },
      { code: 'darby',            lang: 'fr', name: 'Darby (Français)',                size: '≈4.2 MB', desc: { fr: 'Traduction littérale française classique',                en: 'Classic French literal translation' } },
      { code: 'louis-segond',     lang: 'fr', name: 'Louis Segond (variante)',         size: '≈4.2 MB', desc: { fr: 'French_Louis_segon.json — même famille LSG',             en: 'French_Louis_segon.json — same LSG family' } },
      { code: 'martin1744',       lang: 'fr', name: 'Martin 1744',                     size: '≈4.3 MB', desc: { fr: 'Traduction protestante classique française',              en: 'Classic French Protestant translation' } },
      { code: 'ostervald',        lang: 'fr', name: 'Ostervald',                       size: '≈4.2 MB', desc: { fr: 'Traduction réformée française (French_Osterwald.json)',   en: 'French Reformed translation (French_Osterwald.json)' } },
      { code: 'geneve1669',       lang: 'fr', name: 'Genève 1669',                     size: '≈4.1 MB', desc: { fr: 'Bible de Genève révisée 1669 (Fregeneve.json)',           en: 'Geneva Bible revised 1669 (Fregeneve.json)' } },
      { code: 'neg1979',          lang: 'fr', name: 'Nouvelle Édition de Genève 1979', size: '≈4.4 MB', desc: { fr: 'Révision moderne de la Bible de Genève',                 en: 'Modern revision of the Geneva Bible' } },
      { code: 'francais-courant', lang: 'fr', name: 'Français Courant',                size: '≈4.0 MB', desc: { fr: 'Langage courant, facile à lire',                          en: 'Everyday language, easy to read' } },
      { code: 'parole-de-vie',    lang: 'fr', name: 'Parole de Vie',                   size: '≈3.8 MB', desc: { fr: 'Traduction dynamique, très accessible',                  en: 'Dynamic translation, very accessible' } },
      { code: 'semeur',           lang: 'fr', name: 'Semeur',                          size: '≈4.1 MB', desc: { fr: 'Langage contemporain (French_sereur.json)',               en: 'Contemporary language (French_sereur.json)' } },
      { code: 'kjv',              lang: 'en', name: 'King James Version',              size: '≈4.0 MB', desc: { fr: 'Anglais classique 1611, domaine public',                  en: 'Classic 1611 English, public domain' } },
      { code: 'web',              lang: 'en', name: 'World English Bible',             size: '≈4.0 MB', desc: { fr: 'Anglais moderne, domaine public (English_WEB.json)',      en: 'Modern English, public domain (English_WEB.json)' } },
      { code: 'asv',              lang: 'en', name: 'American Standard Version',       size: '≈4.0 MB', desc: { fr: 'Anglais classique révisé (ASV.json)',                    en: 'Revised classic English (ASV.json)' } },
    ];

    const isFrench    = preferences.language.startsWith('fr');
    const bibles      = isFrench ? allBibles.filter(b => b.lang === 'fr' || b.code === 'kjv') : allBibles;
    const recommended = preferences.bibleVersions[0] || (isFrench ? 'lsg' : 'kjv');

    return `
      <div class="step-title">${bi('📖 Sélectionnez Vos Bibles', '📖 Select Your Bibles')}</div>
      <div class="step-description">
        ${bi(`Choisissez au moins une version à télécharger. Recommandée : <strong>${recommended.toUpperCase()}</strong>`,
             `Choose at least one version to download. Recommended: <strong>${recommended.toUpperCase()}</strong>`)}
      </div>

      <div class="checkbox-group">
        ${bibles.map(b => `
          <div class="checkbox-item">
            <input type="checkbox"
                   id="bible-${b.code}"
                   aria-label="${b.name}"
                   ${preferences.bibleVersions.includes(b.code) ? 'checked' : ''}
                   onchange="SangocastSetupWizard.toggleBible('${b.code}')">
            <label for="bible-${b.code}" class="checkbox-label">
              <div style="font-weight:700;">${b.name} (${b.code.toUpperCase()}) ${b.code === recommended ? '⭐' : ''}</div>
              <div style="font-size:13px;color:#6b7280;">
                ${bi(b.desc.fr, b.desc.en)} • ${b.size} • ✅
              </div>
            </label>
          </div>
        `).join('')}
      </div>

      <div style="margin-top:24px;padding:16px;background:#e0f2fe;border-radius:12px;font-size:14px;color:#1e40af;line-height:1.5;">
        ${bi('<strong>Important :</strong> Toutes les versions listées sont embarquées en JSON et disponibles hors-ligne après téléchargement.',
             '<strong>Note:</strong> All listed versions are bundled as JSON and available offline after the initial download.')}
      </div>
    `;
  }

  // FIX A: re-render after toggle so checkboxes visually confirm instantly
  function toggleBible(code) {
    const index = preferences.bibleVersions.indexOf(code);
    if (index > -1) preferences.bibleVersions.splice(index, 1);
    else preferences.bibleVersions.push(code);
    showStep(currentStep); // FIX A
  }

  // ─── Step 7: Prayer times ─────────────────────────────────────────────────

  function getPrayerTimesHTML() {
    const audioSlots = [
      { id: 'morning', fr: '6h-8h (Matin)',            en: '6am-8am (Morning)',  hours: [6, 7] },
      { id: 'noon',    fr: '12h-13h (Midi)',            en: '12pm-1pm (Noon)',    hours: [12] },
      { id: 'evening', fr: '18h-22h (Soir)',            en: '6pm-10pm (Evening)', hours: [18, 19, 20, 21] },
      // FIX B: 'never' checked when audioHours is empty (not every() on [])
      { id: 'never',   fr: 'Jamais (Texte uniquement)', en: 'Never (Text only)',  hours: [] }
    ];

    return `
      <div class="step-title">${bi('🔔 Heures de Prière & Audio', '🔔 Prayer Times & Audio')}</div>
      <div class="step-description">${bi('Définissez vos heures de prière quotidiennes et quand autoriser la lecture audio.', 'Set your daily prayer times and when to allow audio playback.')}</div>

      <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">
        ${bi('⏰ Heures de Prière (Alarmes)', '⏰ Prayer Times (Alarms)')}
      </h3>

      <!-- FIX E: auto-fit grid instead of hardcoded repeat(4,1fr) -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(60px,1fr));gap:8px;margin-bottom:24px;">
        ${[6, 9, 12, 15, 18, 21].map(hour => `
          <button onclick="SangocastSetupWizard.togglePrayerTime(${hour})"
                  aria-pressed="${preferences.prayerTimes.includes(hour)}"
                  style="padding:12px;border:2px solid #e5e7eb;border-radius:8px;
                         background:${preferences.prayerTimes.includes(hour) ? '#667eea' : 'white'};
                         color:${preferences.prayerTimes.includes(hour) ? 'white' : '#1f2937'};
                         font-weight:600;cursor:pointer;">
            ${hour}h
          </button>
        `).join('')}
      </div>

      <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">
        ${bi('🔊 Autoriser Audio', '🔊 Allow Audio')}
      </h3>
      <div class="checkbox-group">
        ${audioSlots.map(slot => {
          // FIX B: correct checked logic per slot type
          const isChecked = slot.id === 'never'
            ? preferences.audioHours.length === 0
            : slot.hours.length > 0 && slot.hours.every(h => preferences.audioHours.includes(h));
          return `
          <div class="checkbox-item">
            <input type="checkbox"
                   id="audio-${slot.id}"
                   aria-label="${slot.en}"
                   ${isChecked ? 'checked' : ''}
                   onchange="SangocastSetupWizard.toggleAudioHours('${slot.id}', ${JSON.stringify(slot.hours).replace(/"/g, '&quot;')})">
            <label for="audio-${slot.id}" class="checkbox-label">
              ${bi(slot.fr, slot.en)}
            </label>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  function togglePrayerTime(hour) {
    const idx = preferences.prayerTimes.indexOf(hour);
    if (idx > -1) preferences.prayerTimes.splice(idx, 1);
    else { preferences.prayerTimes.push(hour); preferences.prayerTimes.sort((a, b) => a - b); }
    showStep(currentStep);
  }

  // FIX A + B: re-render after toggle; 'never' clears all other hours
  function toggleAudioHours(slotId, hours) {
    const checkbox = document.getElementById(`audio-${slotId}`);
    if (!checkbox) return;

    if (slotId === 'never') {
      // FIX B: 'never' is mutually exclusive — clear everything
      preferences.audioHours = [];
    } else if (checkbox.checked) {
      preferences.audioHours.push(...hours);
    } else {
      preferences.audioHours = preferences.audioHours.filter(h => !hours.includes(h));
    }

    // Deduplicate and sort (FIX F from prior version)
    preferences.audioHours = [...new Set(preferences.audioHours)].sort((a, b) => a - b);

    showStep(currentStep); // FIX A: re-render so all checkboxes reflect state
  }

  // ─── Step 8: Download ─────────────────────────────────────────────────────

  function getDownloadHTML() {
    return `
      <div class="step-title">${bi('⬇️ Installation en Cours', '⬇️ Installing')}</div>
      <div class="step-description">${bi('Téléchargement et configuration de SangoCast...', 'Downloading and configuring SangoCast...')}</div>

      <div class="download-progress" id="download-items" aria-live="polite"></div>

      <div id="download-complete" style="display:none;text-align:center;padding:32px;">
        <div style="font-size:64px;margin-bottom:16px;" aria-hidden="true">✅</div>
        <div style="font-size:24px;font-weight:700;margin-bottom:8px;">
          ${bi('Installation Terminée !', 'Installation Complete!')}
        </div>
        <div style="color:#6b7280;">
          ${bi('SangoCast est prêt à diffuser Sango Malamu.', 'SangoCast is ready to broadcast Sango Malamu.')}
        </div>
      </div>
    `;
  }

  async function startDownload() {
    const container = document.getElementById('download-items');
    const nextBtn   = document.getElementById('wizard-next');
    nextBtn.disabled = true;

    const tasks = [
      { fr: 'Configuration utilisateur', en: 'User configuration',  duration: 500 },
      ...preferences.bibleVersions.map(v => ({ fr: `Bible ${v}`, en: `Bible ${v}`, duration: 2000 })),
      { fr: 'Plan de lecture',       en: 'Reading plan',       duration: 500 },
      { fr: 'Calendrier liturgique', en: 'Liturgical calendar', duration: 500 },
      { fr: 'Métadonnées chaîne',    en: 'Channel metadata',    duration: 500 }
    ];

    for (const task of tasks) await downloadTask(container, task);

    saveConfiguration();
    container.style.display = 'none';
    document.getElementById('download-complete').style.display = 'block';
    nextBtn.disabled = false;
    nextBtn.innerHTML = bi('Commencer →', 'Start →');
  }

  function downloadTask(container, task) {
    return new Promise(resolve => {
      const item = document.createElement('div');
      item.className = 'download-item';
      item.innerHTML = `
        <div class="download-name">${bi(task.fr, task.en)}</div>
        <div class="download-bar"><div class="download-fill" style="width:0%"></div></div>
      `;
      container.appendChild(item);

      const fill = item.querySelector('.download-fill');
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        fill.style.width = progress + '%';
        if (progress >= 100) { clearInterval(interval); setTimeout(resolve, 100); }
      }, task.duration / 10);
    });
  }

  // ─── Save configuration ───────────────────────────────────────────────────

  function saveConfiguration() {
    try {
      localStorage.setItem('sangocast_age_mode',      preferences.ageMode);
      localStorage.setItem('sangocast_language',       preferences.language);
      localStorage.setItem('sangocast_tradition',      preferences.tradition);
      localStorage.setItem('sangocast_channel_id',     preferences.channelId);
      localStorage.setItem('sangocast_bible_versions', JSON.stringify(preferences.bibleVersions));
      localStorage.setItem('sangocast_prayer_times',   JSON.stringify(preferences.prayerTimes));
      localStorage.setItem('sangocast_audio_hours',    JSON.stringify(preferences.audioHours));
      localStorage.setItem('sangocast_install_date',   preferences.installDate);
      localStorage.setItem('sangocast_configured',     'true');
      console.log('✅ Configuration sauvegardée / saved:', preferences);
    } catch (e) {
      console.error('⚠️ localStorage unavailable / indisponible:', e);
    }
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  function nextStep() {
    if (currentStep === STEPS.DOWNLOAD) { closeWizard(); window.location.reload(); return; }
    if (!validateStep()) return;
    showStep(currentStep + 1);
  }

  function previousStep() {
    if (currentStep > STEPS.STORAGE_CHECK) showStep(currentStep - 1);
  }

  function validateStep() {
    switch (currentStep) {
      case STEPS.AUDIENCE:     return preferences.ageMode   !== null;
      case STEPS.LANGUAGE:     return preferences.language  !== null;
      case STEPS.TRADITION:    return preferences.tradition !== null;
      case STEPS.CHANNEL:
        if (!preferences.channelId) {
          alert('FR: Veuillez sélectionner une chaîne\nEN: Please select a channel');
          return false;
        }
        return true;
      case STEPS.BIBLE:
        if (preferences.bibleVersions.length === 0) {
          alert('FR: Veuillez sélectionner au moins une version de la Bible\nEN: Please select at least one Bible version');
          return false;
        }
        return true;
      case STEPS.PRAYER_TIMES:
        if (preferences.prayerTimes.length === 0) {
          alert('FR: Veuillez sélectionner au moins une heure de prière\nEN: Please select at least one prayer time');
          return false;
        }
        return true;
      default: return true;
    }
  }

  function closeWizard() {
    const w = document.getElementById('sangocast-setup-wizard');
    if (w) w.remove();
  }

  function forceTextColors() {
    const root = document.getElementById('wizard-content');
    if (!root) return;
    [
      ['.step-title',       '#111827'],
      ['.step-description', '#6b7280'],
      ['.option-title',     '#111827'],
      ['.option-desc',      '#6b7280'],
      ['.checkbox-label',   '#111827'],
      ['.download-name',    '#111827'],
      ['.storage-label',    '#059669'],
    ].forEach(([sel, color]) => {
      root.querySelectorAll(sel).forEach(el => el.style.setProperty('color', color, 'important'));
    });
    root.querySelectorAll('.option-card').forEach(el => {
      if (!el.classList.contains('selected')) el.style.setProperty('background-color', '#ffffff', 'important');
      el.style.setProperty('color', '#111827', 'important');
    });
  }

  // Public API
  return {
    init, nextStep, previousStep,
    selectAudience, selectLanguage, selectTradition, selectChannel,
    toggleBible, togglePrayerTime, toggleAudioHours,
    close: closeWizard, hide: closeWizard, skip: closeWizard
  };
})();

// ─── Welcome / Early Testers screen ──────────────────────────────────────────

function showSangocastWelcome() {
  const el = document.createElement('div');
  el.id = 'sangocast-welcome';
  el.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:12px;"
     role="dialog" aria-modal="true" aria-label="SangoCast Welcome">
  <div style="background:#ffffff;border-radius:20px;max-width:640px;width:100%;max-height:92vh;overflow-y:auto;padding:clamp(20px,5vw,36px) clamp(16px,4vw,32px) clamp(16px,4vw,28px);box-shadow:0 24px 64px rgba(0,0,0,0.3);">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:clamp(28px,8vw,36px);margin-bottom:8px;" aria-hidden="true">📺</div>
      <div style="font-size:clamp(18px,5vw,22px);font-weight:800;color:#1f2937;line-height:1.3;">SangoCast</div>
      <div style="font-size:clamp(11px,3vw,13px);font-weight:600;color:#667eea;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">
        Early Testers Edition
      </div>
    </div>

    <!-- Body text -->
    <div class="intro-text-div" style="font-size:clamp(14px,3.8vw,15px);color:#374151;line-height:1.8;word-break:break-word;overflow-wrap:break-word;">
      <p style="margin:14px 0 14px;color:#b00000;font-weight:700;">
        ⚠ Early Testing Notice: Please DO NOT share this link, code, or concept during the testing period. Public Testing coming in 2 weeks.
      </p>
      
      <p style="margin:0 0 14px;">Beloved in the Lord, welcome to <strong>SangoCast</strong> — Early Testers Edition.</p>

      <p style="margin:0 0 14px;">In simple terms, <strong>SangoCast.live</strong> is a clock app to be placed in the home — yet instead of merely counting hours, it lets the Word of God mark the moments of the day.</p>

      <p style="margin:0 0 14px;">Scriptures appear gently, one after another, as though the day itself were turning the pages of the Bible.</p>

      <p style="margin:0 0 14px;">You are among the first invited to try it, to explore it, and to help shape it through your feedback.</p>

      <p style="margin:0 0 14px;">SangoCast is designed to run on most modern devices: Android phones, Windows computers, Apple devices, smart TVs, and browsers.</p>

      <p style="margin:0 0 14px;">Soon, teachers and ministries will be able to..... ( let's keep the surprise for next week).</p>

      <p style="margin:0 0 14px;">The application can also offer much more features. For this reason, it may request some storage space.</p>

      <p style="margin:0 0 14px;">If you ever wish to remove the application and clear its data, you may do so using the button below.</p>

      <p style="margin:0 0 20px;">If you are willing to join this early journey and help test SangoCast, please click <strong>Continue</strong>.</p>

      <p style="margin:0 0 6px;font-weight:600;color:#1f2937;">Above all, we welcome your voice.</p>
      <p style="margin:0 0 4px;color:#4b5563;">Send your feedback at any time.</p>
      <p style="margin:0 0 4px;color:#4b5563;">
        Feedback line (24/7):
        <strong style="color:#1f2937;">+2764 897 8490</strong>
      </p>
      <p style="margin:14px 0 0;font-style:italic;color:#6b7280;">With gratitude, Batous Kabuika</p>

    </div>
  </div>
</div>
        <!-- Divider -->
        <div style="border-top:1px solid #e5e7eb;margin:20px 0 16px;"></div>

        <!-- Buttons -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button onclick="sangocastExitAndClear()"
                  aria-label="Exit and clear SangoCast data"
                  style="flex:1;min-width:120px;padding:clamp(10px,3vw,14px) 16px;border:2px solid #fca5a5;border-radius:10px;background:#fff7f7;color:#dc2626;font-weight:600;font-size:clamp(13px,3.5vw,14px);cursor:pointer;">
            🗑️ Exit & Clear
          </button>
          <button onclick="sangocastContinueToWizard()"
                  aria-label="Continue to setup wizard"
                  style="flex:2;min-width:140px;padding:clamp(10px,3vw,14px) 16px;border:none;border-radius:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:#ffffff;font-weight:700;font-size:clamp(14px,4vw,15px);cursor:pointer;">
            ${bi('Continuer →', 'Continue →')}
          </button>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(el);
  applyMobileClass();
}

function sangocastContinueToWizard() {
  const welcome = document.getElementById('sangocast-welcome');
  if (welcome) welcome.remove();
  SangocastSetupWizard.init();
}

function sangocastExitAndClear() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith('sangocast')).forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.warn('localStorage clear failed:', e);
  }
  const welcome = document.getElementById('sangocast-welcome');
  if (welcome) welcome.remove();
  console.log('🗑️ SangoCast data cleared / données effacées.');
}

// ─── Auto-start ───────────────────────────────────────────────────────────────
(function () {
  function maybeShow() {
    try {
      if (localStorage.getItem('sangocast_configured') !== 'true') showSangocastWelcome();
    } catch (e) {
      showSangocastWelcome(); // show anyway if localStorage is blocked
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeShow);
  } else {
    maybeShow();
  }
})();

// Export pour modules
if (typeof module !== 'undefined' && module.exports) module.exports = SangocastSetupWizard;
