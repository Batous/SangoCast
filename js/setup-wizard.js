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
   * Charger les chaînes disponibles
   */
  async function loadAvailableChannels() {
    try {
      const response = await fetch('/data/channels.json');
      if (response.ok) {
        const data = await response.json();
        availableChannels = data.channels || [];
        console.log('✅ Channels chargées:', availableChannels.length);
      }
    } catch (error) {
      console.warn('⚠️ Impossible de charger channels:', error);
      // Channels par défaut
      availableChannels = [
        {
          id: 'SCR-EN-GL-0001',
          metadata: {
            name: 'Global Daily Scripture',
            description: 'Daily Bible reading using Horner\'s plan',
            tradition: 'interconfessional',
            featured: true
          },
          defaultSettings: {
            readingPlan: 'horner',
            recommendedBible: 'KJV'
          }
        }
      ];
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
      #sangocast-setup-wizard {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
      }

      .wizard-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }

      .wizard-container {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        background: white;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
      }

      .wizard-progress {
        padding: 24px 24px 16px;
        border-bottom: 1px solid #e5e7eb;
      }

      .progress-bar {
        height: 8px;
        background: #e5e7eb;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 12px;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        transition: width 0.3s ease;
        width: 12.5%;
      }

      .progress-text {
        font-size: 14px;
        color: #666;
        font-weight: 600;
      }

      .wizard-content {
        flex: 1;
        overflow-y: auto;
        padding: 32px 24px;
      }

      .wizard-actions {
        padding: 16px 24px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      .wizard-actions button {
        flex: 1;
        padding: 14px 24px;
        border: none;
        border-radius: 10px;
        font-weight: 600;
        font-size: 15px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .btn-secondary {
        background: #f3f4f6;
        color: #4b5563;
      }

      .btn-secondary:hover {
        background: #e5e7eb;
      }

      .step-title {
        font-size: 28px;
        font-weight: 700;
        color: #1f2937;
        margin-bottom: 12px;
      }

      .step-description {
        font-size: 16px;
        color: #6b7280;
        margin-bottom: 32px;
        line-height: 1.6;
      }

      .option-grid {
        display: grid;
        gap: 12px;
      }

      .option-card {
        padding: 20px;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
      }

      .option-card:hover {
        border-color: #667eea;
        transform: translateY(-2px);
      }

      .option-card.selected {
        border-color: #667eea;
        background: #f5f3ff;
      }

      .option-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }

      .option-title {
        font-weight: 700;
        font-size: 16px;
        margin-bottom: 4px;
        color: #1f2937;
      }

      .option-desc {
        font-size: 14px;
        color: #6b7280;
      }

      .option-badge {
        display: inline-block;
        padding: 4px 12px;
        background: #10b981;
        color: white;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        margin-left: 8px;
      }

      .channel-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border: 2px solid #e5e7eb;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 12px;
      }

      .channel-card:hover {
        border-color: #667eea;
      }

      .channel-card.selected {
        border-color: #667eea;
        background: #f5f3ff;
      }

      .channel-icon {
        font-size: 48px;
        width: 60px;
        text-align: center;
      }

      .channel-info {
        flex: 1;
      }

      .channel-name {
        font-weight: 700;
        font-size: 16px;
        margin-bottom: 4px;
      }

      .channel-id {
        font-size: 12px;
        color: #667eea;
        font-family: monospace;
        margin-bottom: 4px;
      }

      .channel-desc {
        font-size: 13px;
        color: #6b7280;
      }

      .checkbox-group {
        display: grid;
        gap: 12px;
      }

      .checkbox-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: #f9fafb;
        border-radius: 8px;
        cursor: pointer;
      }

      .checkbox-item input[type="checkbox"] {
        width: 20px;
        height: 20px;
        cursor: pointer;
      }

      .checkbox-label {
        font-size: 15px;
        font-weight: 500;
      }

      .storage-info {
        display: flex;
        justify-content: space-between;
        padding: 16px;
        background: #f0fdf4;
        border-radius: 8px;
        margin-bottom: 20px;
      }

      .storage-item {
        text-align: center;
      }

      .storage-value {
        font-size: 24px;
        font-weight: 700;
        color: #10b981;
      }

      .storage-label {
        font-size: 12px;
        color: #059669;
        text-transform: uppercase;
        margin-top: 4px;
      }

      .download-progress {
        margin-top: 24px;
      }

      .download-item {
        margin-bottom: 16px;
      }

      .download-name {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #1f2937;
      }

      .download-bar {
        height: 12px;
        background: #e5e7eb;
        border-radius: 6px;
        overflow: hidden;
      }

      .download-fill {
        height: 100%;
        background: linear-gradient(90deg, #10b981 0%, #059669 100%);
        transition: width 0.3s;
      }

      @media (max-width: 640px) {
        .wizard-container {
          width: 95%;
          max-height: 95vh;
        }
        
        .step-title {
          font-size: 24px;
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
        content.innerHTML = getChannelHTML();
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
    const filteredChannels = availableChannels.filter(ch => 
      !ch.metadata.tradition || 
      ch.metadata.tradition === preferences.tradition || 
      ch.metadata.tradition === 'interconfessional'
    );

    return `
      <div class="step-title">📺 Choisissez Votre Chaîne</div>
      <div class="step-description">
        Une chaîne définit votre plan de lecture, les enseignements pastoraux et les événements que vous suivez.
      </div>
      
      ${filteredChannels.map(channel => `
        <div class="channel-card ${preferences.channelId === channel.id ? 'selected' : ''}" 
             onclick="SangocastSetupWizard.selectChannel('${channel.id}')">
          <div class="channel-icon">${getChannelIcon(channel.type)}</div>
          <div class="channel-info">
            <div class="channel-name">
              ${channel.metadata.name}
              ${channel.metadata.featured ? '<span class="option-badge">Recommandé</span>' : ''}
            </div>
            <div class="channel-id">${channel.id}</div>
            <div class="channel-desc">${channel.metadata.description || ''}</div>
          </div>
        </div>
      `).join('')}
      
      <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px; font-size: 14px; color: #666;">
        <strong>💡 Conseil:</strong> Vous pourrez changer de chaîne à tout moment dans les paramètres.
      </div>
    `;
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
      // Auto-select recommended Bible
      if (channel.defaultSettings?.recommendedBible) {
        preferences.bibleVersions = [channel.defaultSettings.recommendedBible];
      }
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
  const bibles = [
    { code: 'darby', name: 'Darby (Français)', size: '≈4.2 MB', free: true, desc: 'Traduction littérale française classique' },
    { code: 'crampon', name: 'Crampon', size: '≈4.5 MB', free: true, desc: 'Bible catholique française traditionnelle' },
    { code: 'geneve1669', name: 'Genève 1669', size: '≈4.1 MB', free: true, desc: 'Bible de Genève révisée 1669' },
    { code: 'martin1744', name: 'Martin 1744', size: '≈4.3 MB', free: true, desc: 'Traduction protestante classique française' },
    { code: 'darby-fr', name: 'Darby Français', size: '≈4.2 MB', free: true, desc: 'Version Darby en français' },
    { code: 'francais-courant', name: 'Français Courant', size: '≈4.0 MB', free: true, desc: 'Langage courant, facile à lire' },
    { code: 'neg1979', name: 'Nouvelle Édition de Genève 1979', size: '≈4.4 MB', free: true, desc: 'Révision moderne de la Bible de Genève' },
    { code: 'parole-de-vie', name: 'Parole de Vie', size: '≈3.8 MB', free: true, desc: 'Traduction dynamique, très accessible' },
    { code: 'semeur', name: 'Semeur', size: '≈4.1 MB', free: true, desc: 'Bible Semeur – langage contemporain' },
    { code: 'kjv', name: 'King James Version', size: '≈4.0 MB', free: true, desc: 'Anglais classique 1611, domaine public' }
    // kjvmini exclu comme demandé (probablement version compressée ou incomplète)
  ];

  // Bible recommandée par défaut (on peut la changer selon la tradition plus tard)
  
  const recommended = preferences.bibleVersions[0] || 'martin1744'; // exemple par défaut protestant/français

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
    toggleAudioHours
  };
})();

// Auto-initialisation si pas encore configuré
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const configured = localStorage.getItem('sangocast_configured');
    if (!configured || configured !== 'true') {
      SangocastSetupWizard.init();
    }
  });
} else {
  const configured = localStorage.getItem('sangocast_configured');
  if (!configured || configured !== 'true') {
    SangocastSetupWizard.init();
  }
}

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SangocastSetupWizard;
}