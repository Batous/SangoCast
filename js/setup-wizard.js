/**
 * SANGOCAST SETUP WIZARD
 * Assistant de première installation
 * Guide l'utilisateur étape par étape pour configurer SangoCast
 */

const SangocastSetupWizard = (() => {
  'use strict';

  const STEPS = {
    STORAGE_CHECK: 1,
    AUDIENCE: 2,
    LANGUAGE: 3,
    TRADITION: 4,
    CHANNEL: 5,
    BIBLE: 6,
    PRAYER_TIMES: 7,
    DOWNLOAD: 8
  };

  let currentStep = STEPS.STORAGE_CHECK;
  let preferences = {
    storageAvailable: 0,
    ageMode: 'family_mode',
    language: 'en-US',
    tradition: 'reformed',
    channelId: null,
    channelMetadata: null,
    bibleVersions: [],
    prayerTimes: [6, 12, 18, 21],
    audioHours: [],
    installDate: new Date().toISOString()
  };

  let availableChannels = [];

  /**
   * Initialiser le wizard
   */
  function init() {
    // Vérifier si déjà configuré
    const existing = localStorage.getItem('sangocast_configured');
    if (existing === 'true') {
      console.log('⚠️ SangoCast déjà configuré');
      return false;
    }

    // Créer l'interface
    createWizardUI();
    
    // Charger channels disponibles
    loadAvailableChannels();

    // Démarrer à l'étape 1
    showStep(STEPS.STORAGE_CHECK);
    
    return true;
  }

  /**
   * Normalise a channel object from channels.json into the shape the wizard
   * expects internally: { id, type, metadata: { name, description, tradition,
   * featured }, defaultSettings: { recommendedBible } }
   *
   * Handles BOTH formats gracefully:
   *   - Flat  : { id, name, description, tradition, ... }   ← your current JSON
   *   - Nested: { id, metadata: { name, ... }, ... }        ← original wizard format
   */
  function normalizeChannel(ch) {
    // Already in nested format — nothing to do
    if (ch.metadata && typeof ch.metadata === 'object') return ch;

    // Map channel type string to short prefix for icon lookup
    const typeMap = {
      'evergreen':  'SCR',
      'liturgical': 'LEC',
      'event':      'EVT',
      'scripture':  'SCR',
      'prayer':     'SCR'
    };

    // Treat "ecumenical" as equivalent to "interconfessional"
    const traditionMap = { 'ecumenical': 'interconfessional' };
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

  /**
   * Charger les chaînes disponibles
   */
  function getDefaultChannels() {
    return [
      {
        id: 'SCR-EN-GL-0001',
        type: 'SCR',
        metadata: {
          name: 'Global Daily Scripture',
          description: 'A Bible verse for each day of the year — balanced, accessible, and open to all.',
          tradition: 'interconfessional',
          featured: true
        },
        defaultSettings: { readingPlan: 'horner', recommendedBible: 'KJV' }
      },
      {
        id: 'SCR-EN-GL-HOPE',
        type: 'SCR',
        metadata: {
          name: 'Hope Verses',
          description: 'Daily scriptures anchored in the hope we have in Christ.',
          tradition: 'interconfessional',
          featured: true
        },
        defaultSettings: { recommendedBible: 'KJV' }
      },
      {
        id: 'SCR-EN-GL-PRAISE',
        type: 'SCR',
        metadata: {
          name: 'Praise & Worship',
          description: 'Verses that call the soul to worship — Psalms, hymns, and spiritual songs.',
          tradition: 'interconfessional',
          featured: true
        },
        defaultSettings: { recommendedBible: 'KJV' }
      }
    ];
  }

  /**
   * Charger les chaînes disponibles
   */
  async function loadAvailableChannels() {
    try {
      const response = await fetch('/data/channels.json');
      if (response.ok) {
        const data = await response.json();
        availableChannels = (data.channels || []).map(normalizeChannel);
        console.log('✅ Channels chargées:', availableChannels.length);
      } else {
        // 404 or other non-ok status — use built-in defaults instead of looping forever
        console.warn('⚠️ channels.json non trouvé (HTTP ' + response.status + ') — utilisation des chaînes par défaut');
        availableChannels = getDefaultChannels();
      }
    } catch (error) {
      console.warn('⚠️ Impossible de charger channels:', error);
      availableChannels = getDefaultChannels();
    }
  }

  /**
   * Créer l'interface UI du wizard
   */
  function createWizardUI() {
    // Vérifier si déjà créé
    if (document.getElementById('sangocast-setup-wizard')) {
      return;
    }

    const wizard = document.createElement('div');
    wizard.id = 'sangocast-setup-wizard';
    wizard.innerHTML = `
      <div class="wizard-overlay"></div>
      <div class="wizard-container">
        <div class="wizard-progress">
          <div class="progress-bar">
            <div class="progress-fill" id="wizard-progress-fill"></div>
          </div>
          <div class="progress-text" id="wizard-progress-text">Étape 1/8</div>
        </div>
        
        <div class="wizard-content" id="wizard-content">
          <!-- Content injected here -->
        </div>
        
        <div class="wizard-actions">
          <button class="btn-secondary" id="wizard-prev" onclick="SangocastSetupWizard.previousStep()">
            ← Précédent
          </button>
          <button class="btn-primary" id="wizard-next" onclick="SangocastSetupWizard.nextStep()">
            Suivant →
          </button>
        </div>
      </div>
    `;

    // Ajouter styles
    injectStyles();

    // Ajouter au DOM
    document.body.appendChild(wizard);
  }

  /**
   * Injecter styles CSS
   */
  function injectStyles() {
    if (document.getElementById('sangocast-wizard-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'sangocast-wizard-styles';
    style.textContent = `
      /* ─── Root container ──────────────────────────────────────────────── */
      #sangocast-setup-wizard {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
      }

      /* Nuclear reset: ID-scoped so (1,0,0) specificity beats any app class rule.
         color: inherit !important ensures the container's dark color cascades
         down even when the host app sets color: white on generic elements. */
      #sangocast-setup-wizard * {
        box-sizing: border-box !important;
        color: inherit !important;
      }

      /* ─── Overlay ─────────────────────────────────────────────────────── */
      #sangocast-setup-wizard .wizard-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }

      /* ─── Container ───────────────────────────────────────────────────── */
      #sangocast-setup-wizard .wizard-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 92%;
        max-width: 760px;
        max-height: 90vh;
        background: white;
        color: #111827 !important; /* anchor: all children inherit this dark color */
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
        padding: 32px 24px;
      }

      #sangocast-setup-wizard .wizard-actions {
        padding: 16px 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      #sangocast-setup-wizard .wizard-actions button {
        flex: 1;
        padding: 14px 24px;
        border: none;
        border-radius: 10px;
        font-weight: 600;
        font-size: 15px;
        cursor: pointer;
        transition: all 0.2s;
      }

      #sangocast-setup-wizard .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white !important;
      }

      #sangocast-setup-wizard .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      #sangocast-setup-wizard .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      #sangocast-setup-wizard .btn-secondary {
        background: #f3f4f6;
        color: #4b5563 !important;
      }

      #sangocast-setup-wizard .btn-secondary:hover {
        background: #e5e7eb;
      }

      /* ─── Step typography ─────────────────────────────────────────────── */
      #sangocast-setup-wizard .step-title {
        font-size: 28px;
        font-weight: 700;
        color: #1f2937 !important;
        margin-bottom: 12px;
      }

      #sangocast-setup-wizard .step-description {
        font-size: 16px;
        color: #6b7280 !important;
        margin-bottom: 32px;
        line-height: 1.6;
      }

      /* ─── Option cards ────────────────────────────────────────────────── */
      #sangocast-setup-wizard .option-grid {
        display: grid;
        gap: 12px;
      }

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

      #sangocast-setup-wizard .option-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }

      #sangocast-setup-wizard .option-title {
        font-weight: 700;
        font-size: 16px;
        margin-bottom: 4px;
        color: #1f2937 !important;
      }

      #sangocast-setup-wizard .option-desc {
        font-size: 14px;
        color: #6b7280 !important;
      }

      #sangocast-setup-wizard .option-badge {
        display: inline-block;
        padding: 4px 12px;
        background: #10b981;
        color: white !important;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        margin-left: 8px;
      }

      /* ─── Channel card styles removed — plain text list used instead ──── */
      /*
      #sangocast-setup-wizard .channel-grid { ... }
      #sangocast-setup-wizard .channel-card { ... }
      #sangocast-setup-wizard .channel-card:hover { ... }
      #sangocast-setup-wizard .channel-card.selected { ... }
      #sangocast-setup-wizard .channel-info { ... }
      #sangocast-setup-wizard .channel-name { ... }
      #sangocast-setup-wizard .channel-id { ... }
      #sangocast-setup-wizard .channel-desc { ... }
      #sangocast-setup-wizard .channel-tradition { ... }
      */

      /* ─── Checkboxes ──────────────────────────────────────────────────── */
      #sangocast-setup-wizard .checkbox-group {
        display: grid;
        gap: 12px;
      }

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
        width: 20px;
        height: 20px;
        cursor: pointer;
      }

      #sangocast-setup-wizard .checkbox-label {
        font-size: 15px;
        font-weight: 500;
        color: #1f2937 !important;
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

      #sangocast-setup-wizard .storage-item {
        text-align: center;
      }

      #sangocast-setup-wizard .storage-value {
        font-size: 24px;
        font-weight: 700;
        color: #10b981 !important;
      }

      #sangocast-setup-wizard .storage-label {
        font-size: 12px;
        color: #059669 !important;
        text-transform: uppercase;
        margin-top: 4px;
      }

      /* ─── Download progress ───────────────────────────────────────────── */
      #sangocast-setup-wizard .download-progress {
        margin-top: 24px;
      }

      #sangocast-setup-wizard .download-item {
        margin-bottom: 16px;
      }

      #sangocast-setup-wizard .download-name {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #1f2937 !important;
      }

      #sangocast-setup-wizard .download-bar {
        height: 12px;
        background: #e5e7eb;
        border-radius: 6px;
        overflow: hidden;
      }

      #sangocast-setup-wizard .download-fill {
        height: 100%;
        background: linear-gradient(90deg, #10b981 0%, #059669 100%);
        transition: width 0.3s;
      }

      /* ─── Responsive ──────────────────────────────────────────────────── */
      @media (max-width: 640px) {
        #sangocast-setup-wizard .wizard-container {
          width: 98%;
          max-height: 95vh;
        }
        
        #sangocast-setup-wizard .step-title {
          font-size: 22px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Afficher une étape spécifique
   */
  function showStep(step) {
    currentStep = step;
    updateProgress();

    const content = document.getElementById('wizard-content');
    const prevBtn = document.getElementById('wizard-prev');
    const nextBtn = document.getElementById('wizard-next');

    // Désactiver bouton Précédent à la première étape
    prevBtn.style.display = step === STEPS.STORAGE_CHECK ? 'none' : 'flex';

    // Générer contenu selon l'étape
    switch (step) {
      case STEPS.STORAGE_CHECK:
        content.innerHTML = getStorageCheckHTML();
        checkStorage();
        break;
      case STEPS.AUDIENCE:
        content.innerHTML = getAudienceHTML();
        break;
      case STEPS.LANGUAGE:
        content.innerHTML = getLanguageHTML();
        break;
      case STEPS.TRADITION:
        content.innerHTML = getTraditionHTML();
        break;
      case STEPS.CHANNEL:
        // If channels haven't loaded yet (async race), wait and retry once
        if (availableChannels.length === 0) {
          content.innerHTML = `
            <div class="step-title">📺 Choisissez Votre Chaîne</div>
            <div style="text-align:center; padding: 40px; color: #6b7280;">
              <div style="font-size: 32px; margin-bottom: 12px;">⏳</div>
              Chargement des chaînes...
            </div>`;
          loadAvailableChannels().then(() => {
            if (currentStep === STEPS.CHANNEL) showStep(STEPS.CHANNEL);
          });
        } else {
          content.innerHTML = getChannelHTML();
        }
        break;
      case STEPS.BIBLE:
        content.innerHTML = getBibleHTML();
        break;
      case STEPS.PRAYER_TIMES:
        content.innerHTML = getPrayerTimesHTML();
        break;
      case STEPS.DOWNLOAD:
        content.innerHTML = getDownloadHTML();
        nextBtn.textContent = 'Terminer ✓';
        startDownload();
        break;
    }

    // Override any host-app color rules that make text invisible
    forceTextColors();
  }

  /**
   * Mettre à jour la barre de progression
   */
  function updateProgress() {
    const progress = (currentStep / 8) * 100;
    document.getElementById('wizard-progress-fill').style.width = progress + '%';
    document.getElementById('wizard-progress-text').textContent = `Étape ${currentStep}/8`;
  }

  /**
   * ÉTAPE 1: Vérification Stockage
   */
  function getStorageCheckHTML() {
    return `
      <div class="step-title">💾 Vérification de l'Espace</div>
      <div class="step-description">
        Nous allons vérifier si vous avez suffisamment d'espace pour SangoCast.
      </div>
      
      <div class="storage-info" id="storage-display">
        <div class="storage-item">
          <div class="storage-value">-</div>
          <div class="storage-label">Disponible</div>
        </div>
        <div class="storage-item">
          <div class="storage-value">4.6 MB</div>
          <div class="storage-label">Requis (Min)</div>
        </div>
        <div class="storage-item">
          <div class="storage-value" id="storage-status">...</div>
          <div class="storage-label">Statut</div>
        </div>
      </div>
      
      <div id="storage-message"></div>
    `;
  }

  async function checkStorage() {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const available = estimate.quota - estimate.usage;
        const availableMB = (available / 1024 / 1024).toFixed(1);
        
        preferences.storageAvailable = available;
        
        const display = document.querySelector('.storage-info .storage-value');
        if (display) {
          display.textContent = availableMB + ' MB';
        }
        
        const status = document.getElementById('storage-status');
        const message = document.getElementById('storage-message');
        
        if (available > 5 * 1024 * 1024) { // 5 MB
          status.textContent = '✅ OK';
          status.style.color = '#10b981';
          message.innerHTML = '<p style="color: #10b981;">✅ Vous avez suffisamment d\'espace!</p>';
        } else {
          status.textContent = '⚠️ Limité';
          status.style.color = '#f59e0b';
          message.innerHTML = '<p style="color: #f59e0b;">⚠️ Espace limité. Libérez quelques mégaoctets pour une meilleure expérience.</p>';
        }
      }
    } catch (error) {
      console.warn('Impossible de vérifier le stockage:', error);
      document.getElementById('storage-status').textContent = '✓ Skip';
    }
  }

  /**
   * ÉTAPE 2: Sélection Audience
   */
  function getAudienceHTML() {
    return `
      <div class="step-title">👥 Pour Qui est SangoCast?</div>
      <div class="step-description">
        Sélectionnez qui utilisera cette application. Cela nous aide à filtrer le contenu approprié.
      </div>
      
      <div class="option-grid">
        <div class="option-card ${preferences.ageMode === 'adults_only' ? 'selected' : ''}" 
             onclick="SangocastSetupWizard.selectAudience('adults_only')">
          <div class="option-icon">🔞</div>
          <div class="option-title">Adultes Uniquement</div>
          <div class="option-desc">18+ • Aucun filtrage de contenu</div>
        </div>
        
        <div class="option-card ${preferences.ageMode === 'family_mode' ? 'selected' : ''}" 
             onclick="SangocastSetupWizard.selectAudience('family_mode')">
          <div class="option-icon">👨‍👩‍👧‍👦</div>
          <div class="option-title">Famille</div>
          <div class="option-desc">Tous âges • Contenu sensible filtré</div>
        </div>
        
        <div class="option-card ${preferences.ageMode === 'children_mode' ? 'selected' : ''}" 
             onclick="SangocastSetupWizard.selectAudience('children_mode')">
          <div class="option-icon">👶</div>
          <div class="option-title">Enfants</div>
          <div class="option-desc">0-12 ans • Contenu approuvé uniquement</div>
        </div>
      </div>
    `;
  }

  function selectAudience(mode) {
    preferences.ageMode = mode;
    showStep(currentStep); // Refresh to show selection
  }

  /**
   * ÉTAPE 3: Sélection Langue
   */
  function getLanguageHTML() {
    const languages = [
      { code: 'en-US', name: 'English', icon: '🇺🇸' },
      { code: 'fr-FR', name: 'Français', icon: '🇫🇷' },
      { code: 'es-ES', name: 'Español', icon: '🇪🇸' },
      { code: 'pt-PT', name: 'Português', icon: '🇵🇹' },
      { code: 'ln-CD', name: 'Lingala', icon: '🇨🇩' }
    ];

    return `
      <div class="step-title">🌍 Choisissez Votre Langue</div>
      <div class="step-description">
        Sélectionnez la langue pour l'interface et les annonces vocales.
      </div>
      
      <div class="option-grid">
        ${languages.map(lang => `
          <div class="option-card ${preferences.language === lang.code ? 'selected' : ''}" 
               onclick="SangocastSetupWizard.selectLanguage('${lang.code}')">
            <div class="option-icon">${lang.icon}</div>
            <div class="option-title">${lang.name}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function selectLanguage(code) {
    preferences.language = code;
    showStep(currentStep);
  }

  /**
   * ÉTAPE 4: Sélection Tradition (version académique)
   */
  function getTraditionHTML() {
    return `
      <div class="step-title">⛪ Votre Tradition Liturgique</div>
      <div class="step-description">
        Choisissez votre famille liturgique / tradition chrétienne. Cela influence le calendrier et les chaînes recommandées.
      </div>
      
      <div class="option-grid">
        <div class="option-card ${preferences.tradition === 'western_latin' ? 'selected' : ''}" 
             onclick="SangocastSetupWizard.selectTradition('western_latin')">
          <div class="option-icon">✝️</div>
          <div class="option-title">Western Latin</div>
          <div class="option-desc">Lectionnaire romain, rite latin, fêtes mariales</div>
        </div>
        
        <div class="option-card ${preferences.tradition === 'reformed' ? 'selected' : ''}" 
             onclick="SangocastSetupWizard.selectTradition('reformed')">
          <div class="option-icon">✟</div>
          <div class="option-title">Reformed</div>
          <div class="option-desc">Revised Common Lectionary, tradition protestante réformée</div>
        </div>
        
        <div class="option-card ${preferences.tradition === 'eastern' ? 'selected' : ''}" 
             onclick="SangocastSetupWizard.selectTradition('eastern')">
          <div class="option-icon">☦</div>
          <div class="option-title">Eastern</div>
          <div class="option-desc">Calendrier byzantin, rite oriental, traditions orthodoxes</div>
        </div>
        
        <div class="option-card ${preferences.tradition === 'interconfessional' ? 'selected' : ''}" 
             onclick="SangocastSetupWizard.selectTradition('interconfessional')">
          <div class="option-icon">🕊️</div>
          <div class="option-title">Interconfessional</div>
          <div class="option-desc">Ouvert à plusieurs traditions, approche œcuménique</div>
        </div>
      </div>
    `;
  }

  function selectTradition(tradition) {
    preferences.tradition = tradition;
    showStep(currentStep);
  }

  /**
   * ÉTAPE 5: Sélection Chaîne
   */
  function getChannelHTML() {
    const filteredChannels = availableChannels;

    return `
      <div class="step-title" style="font-size:26px;font-weight:700;color:#111827;margin-bottom:10px;">📺 Choisissez Votre Chaîne</div>
      <div class="step-description" style="font-size:15px;color:#6b7280;margin-bottom:24px;line-height:1.6;">
        Une chaîne définit votre plan de lecture, les enseignements pastoraux et les événements que vous suivez.
      </div>

      <div>
        ${filteredChannels.map(channel => {
          const isSelected = preferences.channelId === channel.id;
          return `
          <div onclick="SangocastSetupWizard.selectChannel('${channel.id}')"
               style="margin-bottom:12px;cursor:pointer;padding:12px;border-left:4px solid ${isSelected ? '#667eea' : '#e5e7eb'};background:${isSelected ? '#f5f3ff' : 'transparent'};">
            <div style="color:${isSelected ? '#667eea' : 'inherit'};font-weight:${isSelected ? '700' : 'normal'};">
              ${isSelected ? '✅ ' : ''}<strong>${channel.metadata.name}</strong>
              ${channel.metadata.featured ? '<span style="color:#10b981;">(Recommandé)</span>' : ''}
            </div>
            <div>ID: ${channel.id}</div>
            <div>Description: ${channel.metadata.description || ''}</div>
            ${channel.metadata.tradition ? `<div>Tradition: ${channel.metadata.tradition.replace(/_/g, ' ')}</div>` : ''}
          </div>`;
        }).join('')}
      </div>

      ${preferences.channelId ? `
        <div style="margin-top:16px;padding:14px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:14px;color:#166534;">
          ✅ <strong>Chaîne chargée :</strong> ${availableChannels.find(c => c.id === preferences.channelId)?.metadata.name || preferences.channelId}
          <br><span style="font-size:12px;color:#4ade80;">ID: ${preferences.channelId} — prête pour l'installation</span>
        </div>` : `
        <div style="margin-top:16px;padding:14px;background:#fefce8;border:1px solid #fde047;border-radius:8px;font-size:14px;color:#854d0e;">
          ⚠️ Aucune chaîne sélectionnée — cliquez sur une chaîne ci-dessus.
        </div>`}

      <div style="margin-top:12px;padding:16px;background:#f9fafb;border-radius:8px;font-size:14px;color:#4b5563;">
        <strong style="color:#111827;">💡 Conseil:</strong> Vous pourrez changer de chaîne à tout moment dans les paramètres.
      </div>
    `;
  }

  /**
   * Force explicit text colors on all rendered step content.
   * Needed because host-app CSS (e.g. .dark * { color: white !important })
   * can override even ID-scoped rules. Inline JS style is the only guarantee.
   */
  function forceTextColors() {
    const root = document.getElementById('wizard-content');
    if (!root) return;

    const rules = [
      { sel: '.step-title',    color: '#111827' },
      { sel: '.step-description', color: '#6b7280' },
      { sel: '.option-title',  color: '#111827' },
      { sel: '.option-desc',   color: '#6b7280' },
      { sel: '.channel-name',  color: '#111827' },
      { sel: '.channel-desc',  color: '#4b5563' },
      { sel: '.channel-id',    color: '#667eea' },
      { sel: '.channel-info',  color: '#111827' },
      { sel: '.checkbox-label',color: '#111827' },
      { sel: '.download-name', color: '#111827' },
      { sel: '.storage-label', color: '#059669' },
      { sel: '.progress-text', color: '#6b7280' },
    ];

    rules.forEach(({ sel, color }) => {
      root.querySelectorAll(sel).forEach(el => {
        el.style.setProperty('color', color, 'important');
      });
    });

    // Also force card backgrounds so white text can't hide on white
    root.querySelectorAll('.option-card, .channel-card').forEach(el => {
      if (!el.classList.contains('selected')) {
        el.style.setProperty('background-color', '#ffffff', 'important');
      }
      el.style.setProperty('color', '#111827', 'important');
    });
  }

  function getChannelIcon(type) {
    const icons = {
      'SCR': '📖',
      'LEC': '📅',
      'EVT': '🎪'
    };
    return icons[type] || '📻';
  }

  function selectChannel(channelId) {
    preferences.channelId = channelId;
    const channel = availableChannels.find(ch => ch.id === channelId);
    if (channel) {
      preferences.channelMetadata = channel.metadata;
      // All current channels recommend KJV, but French users should default to LSG.
      // Only override the auto-pick if bibleVersions is still at its empty default.
      const channelBible = channel.defaultSettings?.recommendedBible || 'kjv';
      const isFrench = preferences.language.startsWith('fr');
      preferences.bibleVersions = [isFrench ? 'lsg' : channelBible.toLowerCase()];
    }
    showStep(currentStep);
  }

  /**
   * ÉTAPE 6 orginale ave differentes bibles: Sélection Bible
   */
  /**function getBibleHTML() {
    const bibles = [
    *  { code: 'KJV', name: 'King James Version', size: '4 MB', free: true, desc: 'Anglais classique, 1611' },
    * { code: 'WEB', name: 'World English Bible', size: '4 MB', free: true, desc: 'Anglais moderne, domaine public' },
    * { code: 'BBE', name: 'Bible in Basic English', size: '3 MB', free: true, desc: 'Anglais simplifié' },
    *  { code: 'NIV', name: 'New International Version', size: '4 MB', free: false, desc: 'Populaire, payant ($2.99)' },
    * { code: 'ESV', name: 'English Standard Version', size: '4 MB', free: false, desc: 'Littéral, payant ($2.99)' }
    * ];
	*/
	/**
 * ÉTAPE 6: Sélection Bible
 */
function getBibleHTML() {
  // Each entry has a lang tag: 'fr' = French only, 'en' = English only, 'all' = always shown.
  // This replaces the broken name-string filter from the previous version.
  // Removed: crampon (no file found), darby-fr (duplicate of darby).
  // Added: lsg, ostervald, louis-segond (files confirmed present).
  const allBibles = [
    { code: 'lsg',             lang: 'fr',  name: 'Louis Segond (LSG)',            size: '≈4.2 MB', free: true,  desc: 'Traduction protestante la plus répandue en français' },
    { code: 'darby',           lang: 'fr',  name: 'Darby (Français)',              size: '≈4.2 MB', free: true,  desc: 'Traduction littérale française classique' },
    { code: 'louis-segond',    lang: 'fr',  name: 'Louis Segond (variante)',       size: '≈4.2 MB', free: true,  desc: 'Fichier French_Louis_segon.json — même famille LSG' },
    { code: 'martin1744',      lang: 'fr',  name: 'Martin 1744',                   size: '≈4.3 MB', free: true,  desc: 'Traduction protestante classique française' },
    { code: 'ostervald',       lang: 'fr',  name: 'Ostervald',                     size: '≈4.2 MB', free: true,  desc: 'Traduction réformée française (French_Osterwald.json)' },
    { code: 'geneve1669',      lang: 'fr',  name: 'Genève 1669',                   size: '≈4.1 MB', free: true,  desc: 'Bible de Genève révisée 1669 (Fregeneve.json)' },
    { code: 'neg1979',         lang: 'fr',  name: 'Nouvelle Édition de Genève 1979', size: '≈4.4 MB', free: true, desc: 'Révision moderne de la Bible de Genève' },
    { code: 'francais-courant',lang: 'fr',  name: 'Français Courant',              size: '≈4.0 MB', free: true,  desc: 'Langage courant, facile à lire' },
    { code: 'parole-de-vie',   lang: 'fr',  name: 'Parole de Vie',                 size: '≈3.8 MB', free: true,  desc: 'Traduction dynamique, très accessible' },
    { code: 'semeur',          lang: 'fr',  name: 'Semeur',                        size: '≈4.1 MB', free: true,  desc: 'Bible Semeur – langage contemporain (French_sereur.json)' },
    { code: 'kjv',             lang: 'en',  name: 'King James Version',            size: '≈4.0 MB', free: true,  desc: 'Anglais classique 1611, domaine public' },
    { code: 'web',             lang: 'en',  name: 'World English Bible',           size: '≈4.0 MB', free: true,  desc: 'Anglais moderne, domaine public (English_WEB.json)' },
    { code: 'asv',             lang: 'en',  name: 'American Standard Version',     size: '≈4.0 MB', free: true,  desc: 'Anglais classique révisé (ASV.json)' },
  ];

  // Filter: French users see French + KJV; English/other users see English + all French available
  const isFrench = preferences.language.startsWith('fr');
  const bibles = isFrench
    ? allBibles.filter(b => b.lang === 'fr' || b.code === 'kjv')
    : allBibles; // non-French users can browse everything

  // Default recommended Bible: respect channel pick if set, else language-appropriate fallback
  const recommended = preferences.bibleVersions[0] ||
    (isFrench ? 'lsg' : 'kjv');

  return `
    <div class="step-title">📖 Sélectionnez Vos Bibles</div>
    <div class="step-description">
      Choisissez au moins une version de la Bible à télécharger localement. 
      Recommandé pour votre profil : <strong>${recommended.toUpperCase()}</strong>
    </div>
    
    <div class="checkbox-group">
      ${bibles.map(bible => `
        <div class="checkbox-item">
          <input type="checkbox" 
                 id="bible-${bible.code}" 
                 ${preferences.bibleVersions.includes(bible.code) ? 'checked' : ''}
                 onchange="SangocastSetupWizard.toggleBible('${bible.code}')">
          <label for="bible-${bible.code}" class="checkbox-label">
            <div style="font-weight: 700;">${bible.name} (${bible.code.toUpperCase()}) ${bible.code === recommended ? '⭐ Recommandée' : ''}</div>
            <div style="font-size: 13px; color: #6b7280;">
              ${bible.desc} • ${bible.size} • ${bible.free ? '✅ Gratuit & domaine public' : '💰 (licence requise)'}
            </div>
          </label>
        </div>
      `).join('')}
    </div>
    
    <div style="margin-top: 24px; padding: 16px; background: #e0f2fe; border-radius: 12px; font-size: 14px; color: #1e40af; line-height: 1.5;">
      <strong>Important :</strong> Toutes les versions listées ici sont prévues pour être embarquées en JSON et resteront disponibles hors-ligne après téléchargement initial.
      <br><br>
      <small>Les Bibles en français sont prioritaires pour les utilisateurs francophones. Vous pourrez en ajouter d'autres plus tard via les paramètres.</small>
    </div>
  `;
}

  function toggleBible(code) {
    const index = preferences.bibleVersions.indexOf(code);
    if (index > -1) {
      preferences.bibleVersions.splice(index, 1);
    } else {
      preferences.bibleVersions.push(code);
    }
  }

  /**
   * ÉTAPE 7: Heures de Prière
   */
  function getPrayerTimesHTML() {
    const audioSlots = [
      { id: 'morning', label: '6h-8h (Matin)', hours: [6, 7] },
      { id: 'noon', label: '12h-13h (Midi)', hours: [12] },
      { id: 'evening', label: '18h-22h (Soir)', hours: [18, 19, 20, 21] },
      { id: 'never', label: 'Jamais (Texte uniquement)', hours: [] }
    ];

    return `
      <div class="step-title">🔔 Heures de Prière & Audio</div>
      <div class="step-description">
        Définissez vos heures de prière quotidiennes et quand autoriser la lecture audio.
      </div>
      
      <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 12px;">⏰ Heures de Prière (Alarmes)</h3>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 24px;">
        ${[6, 9, 12, 15, 18, 21].map(hour => `
          <button class="time-btn ${preferences.prayerTimes.includes(hour) ? 'active' : ''}"
                  onclick="SangocastSetupWizard.togglePrayerTime(${hour})"
                  style="padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; background: ${preferences.prayerTimes.includes(hour) ? '#667eea' : 'white'}; color: ${preferences.prayerTimes.includes(hour) ? 'white' : '#1f2937'}; font-weight: 600; cursor: pointer;">
            ${hour}h
          </button>
        `).join('')}
      </div>
      
      <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 12px;">🔊 Autoriser Audio</h3>
      <div class="checkbox-group">
        ${audioSlots.map(slot => `
          <div class="checkbox-item">
            <input type="checkbox" 
                   id="audio-${slot.id}" 
                   onchange="SangocastSetupWizard.toggleAudioHours('${slot.id}', ${JSON.stringify(slot.hours).replace(/"/g, '&quot;')})">
            <label for="audio-${slot.id}" class="checkbox-label">${slot.label}</label>
          </div>
        `).join('')}
      </div>
    `;
  }

  function togglePrayerTime(hour) {
    const index = preferences.prayerTimes.indexOf(hour);
    if (index > -1) {
      preferences.prayerTimes.splice(index, 1);
    } else {
      preferences.prayerTimes.push(hour);
      preferences.prayerTimes.sort((a, b) => a - b);
    }
    showStep(currentStep);
  }

  function toggleAudioHours(slotId, hours) {
    const checkbox = document.getElementById(`audio-${slotId}`);
    if (checkbox.checked) {
      preferences.audioHours.push(...hours);
    } else {
      preferences.audioHours = preferences.audioHours.filter(h => !hours.includes(h));
    }
  }

  /**
   * ÉTAPE 8: Téléchargement
   */
  function getDownloadHTML() {
    return `
      <div class="step-title">⬇️ Installation en Cours</div>
      <div class="step-description">
        Téléchargement et configuration de SangoCast...
      </div>
      
      <div class="download-progress" id="download-items">
        <!-- Progress bars injected here -->
      </div>
      
      <div id="download-complete" style="display: none; text-align: center; padding: 32px;">
        <div style="font-size: 64px; margin-bottom: 16px;">✅</div>
        <div style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Installation Terminée!</div>
        <div style="color: #6b7280;">SangoCast est prêt à diffuser Sango Malamu.</div>
      </div>
    `;
  }

  async function startDownload() {
    const container = document.getElementById('download-items');
    const nextBtn = document.getElementById('wizard-next');
    nextBtn.disabled = true;

    const tasks = [
      { name: 'Configuration utilisateur', duration: 500 },
      ...preferences.bibleVersions.map(version => ({
        name: `Bible ${version}`,
        duration: 2000
      })),
      { name: 'Plan de lecture', duration: 500 },
      { name: 'Calendrier liturgique', duration: 500 },
      { name: 'Métadonnées chaîne', duration: 500 }
    ];

    for (const task of tasks) {
      await downloadTask(container, task);
    }

    // Sauvegarder configuration
    saveConfiguration();

    // Afficher succès
    container.style.display = 'none';
    document.getElementById('download-complete').style.display = 'block';
    nextBtn.disabled = false;
    nextBtn.textContent = 'Commencer →';
  }

  function downloadTask(container, task) {
    return new Promise(resolve => {
      const item = document.createElement('div');
      item.className = 'download-item';
      item.innerHTML = `
        <div class="download-name">${task.name}</div>
        <div class="download-bar">
          <div class="download-fill" style="width: 0%"></div>
        </div>
      `;
      container.appendChild(item);

      const fill = item.querySelector('.download-fill');
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        fill.style.width = progress + '%';
        
        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(resolve, 100);
        }
      }, task.duration / 10);
    });
  }

  /**
   * Sauvegarder la configuration
   */
  function saveConfiguration() {
    // Sauvegarder dans localStorage
    localStorage.setItem('sangocast_age_mode', preferences.ageMode);
    localStorage.setItem('sangocast_language', preferences.language);
    localStorage.setItem('sangocast_tradition', preferences.tradition);
    localStorage.setItem('sangocast_channel_id', preferences.channelId);
    localStorage.setItem('sangocast_bible_versions', JSON.stringify(preferences.bibleVersions));
    localStorage.setItem('sangocast_prayer_times', JSON.stringify(preferences.prayerTimes));
    localStorage.setItem('sangocast_audio_hours', JSON.stringify(preferences.audioHours));
    localStorage.setItem('sangocast_install_date', preferences.installDate);
    localStorage.setItem('sangocast_configured', 'true');

    console.log('✅ Configuration sauvegardée:', preferences);
  }

  /**
   * Navigation
   */
  function nextStep() {
    if (currentStep === STEPS.DOWNLOAD) {
      // Terminer et fermer le wizard
      closeWizard();
      window.location.reload(); // Recharger pour charger l'app principale
      return;
    }

    // Validation avant de continuer
    if (!validateStep()) {
      return;
    }

    showStep(currentStep + 1);
  }

  function previousStep() {
    if (currentStep > STEPS.STORAGE_CHECK) {
      showStep(currentStep - 1);
    }
  }

  function validateStep() {
    switch (currentStep) {
      case STEPS.AUDIENCE:
        return preferences.ageMode !== null;
      case STEPS.LANGUAGE:
        return preferences.language !== null;
      case STEPS.TRADITION:
        return preferences.tradition !== null;
      case STEPS.CHANNEL:
        if (!preferences.channelId) {
          alert('Veuillez sélectionner une chaîne');
          return false;
        }
        return true;
      case STEPS.BIBLE:
        if (preferences.bibleVersions.length === 0) {
          alert('Veuillez sélectionner au moins une version de la Bible');
          return false;
        }
        return true;
      case STEPS.PRAYER_TIMES:
        return true; // Optional
      default:
        return true;
    }
  }

  function closeWizard() {
    const wizard = document.getElementById('sangocast-setup-wizard');
    if (wizard) {
      wizard.remove();
    }
  }

  // API publique
  return {
    init,
    nextStep,
    previousStep,
    selectAudience,
    selectLanguage,
    selectTradition,
    selectChannel,
    toggleBible,
    togglePrayerTime,
    toggleAudioHours,
    close:   closeWizard,   // alias for external callers
    hide:    closeWizard,   // alias
    skip:    closeWizard    // alias
  };
})();

// ─── Welcome / Early Testers screen ────────────────────────────────────────
// Shown before the wizard. Two paths:
//   • Continue  → dismisses welcome, starts wizard
//   • Exit & Clear → wipes all SangoCast data, removes screen
// ────────────────────────────────────────────────────────────────────────────

function showSangocastWelcome() {

  // Inject the welcome overlay
  const el = document.createElement('div');
  el.id = 'sangocast-welcome';
  el.innerHTML = `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:999998;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;">
      <div style="background:#ffffff;border-radius:20px;max-width:640px;width:100%;max-height:90vh;overflow-y:auto;padding:36px 32px 28px;box-shadow:0 24px 64px rgba(0,0,0,0.3);">

        <!-- Header -->
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:36px;margin-bottom:8px;">📺</div>
          <div style="font-size:22px;font-weight:800;color:#1f2937;line-height:1.3;">SangoCast</div>
          <div style="font-size:13px;font-weight:600;color:#667eea;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;">Early Testers Edition</div>
        </div>

        <!-- Body text -->
        <div style="font-size:15px;color:#374151;line-height:1.8;">

          <p style="margin:0 0 14px;">Beloved in the Lord, welcome to <strong>SangoCast</strong> — the Early Testers Edition.</p>

          <p style="margin:0 0 14px;">In simple terms, <strong>SangoCast.live</strong> is a clock app to be placed in the home — yet instead of merely counting hours, it lets the Word of God mark the moments of the day.</p>

          <p style="margin:0 0 14px;">Scriptures appear gently, every ten minutes, one after another, as though the day itself were turning the pages of the Bible.</p>

          <p style="margin:0 0 14px;">You are among the first invited to try it, to explore it, and to help shape it through your feedback.</p>

          <p style="margin:0 0 14px;">SangoCast is designed to run on most modern devices: Android phones, Windows computers, Apple devices, smart TVs, and browsers.</p>

          <p style="margin:0 0 14px;">Soon, teachers and ministries will be able to open their own channels and share reading plans that follow the rhythm of their communities.</p>

          <p style="margin:0 0 14px;">The application can also work offline, quietly storing selected scripture plans on your device. For this reason, it may request some storage space.</p>

          <p style="margin:0 0 14px;">If you ever wish to remove the application and clear its data, you may do so using the button below.</p>

          <p style="margin:0 0 20px;">If you are willing to join this early journey and help test SangoCast, please click <strong>Continue</strong>.</p>

          <p style="margin:0 0 6px;font-weight:600;color:#1f2937;">Above all, we welcome your voice.</p>
          <p style="margin:0 0 4px;color:#4b5563;">Send your feedback at any time.</p>
          <p style="margin:0 0 4px;color:#4b5563;">Feedback line (24/7): <strong style="color:#1f2937;">+2764 897 8490</strong></p>
          <p style="margin:14px 0 0;font-style:italic;color:#6b7280;">With gratitude, Batous Kabuika</p>

        </div>

        <!-- Divider -->
        <div style="border-top:1px solid #e5e7eb;margin:24px 0 20px;"></div>

        <!-- Buttons -->
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button onclick="sangocastExitAndClear()"
                  style="flex:1;min-width:140px;padding:14px 20px;border:2px solid #fca5a5;border-radius:10px;background:#fff7f7;color:#dc2626;font-weight:600;font-size:14px;cursor:pointer;">
            🗑️ Exit &amp; Clear Data
          </button>
          <button onclick="sangocastContinueToWizard()"
                  style="flex:2;min-width:160px;padding:14px 20px;border:none;border-radius:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:#ffffff;font-weight:700;font-size:15px;cursor:pointer;">
            Continue →
          </button>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(el);
}

function sangocastContinueToWizard() {
  const welcome = document.getElementById('sangocast-welcome');
  if (welcome) welcome.remove();
  SangocastSetupWizard.init();
}

function sangocastExitAndClear() {
  // Wipe all SangoCast keys from localStorage
  Object.keys(localStorage)
    .filter(k => k.startsWith('sangocast'))
    .forEach(k => localStorage.removeItem(k));
  const welcome = document.getElementById('sangocast-welcome');
  if (welcome) welcome.remove();
  console.log('🗑️ SangoCast data cleared.');
}

// ─── Auto-start ──────────────────────────────────────────────────────────────
// Show the welcome screen only on first run (not yet configured).
// On subsequent loads the app initialises normally without interruption.
// ─────────────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('sangocast_configured') !== 'true') {
      showSangocastWelcome();
    }
  });
} else {
  if (localStorage.getItem('sangocast_configured') !== 'true') {
    showSangocastWelcome();
  }
}


// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SangocastSetupWizard;
}