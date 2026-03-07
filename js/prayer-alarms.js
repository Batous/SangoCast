/**
 * SANGOCAST PRAYER ALARMS
 * Système d'alarmes de prière avec son, voix et vibration
 * Notifie 2 minutes avant chaque heure de prière
 */

const SangocastPrayerAlarms = (() => {
  'use strict';

  // Configuration
  const CONFIG = {
    DEFAULT_PRAYER_TIMES: [6, 12, 18, 21], // 6h, 12h, 18h, 21h
    WARNING_MINUTES: 2, // Notifier 2 minutes avant
    NOTIFICATION_DURATION: 120000, // Afficher 2 minutes (en ms)
    STORAGE_KEY: 'sangocast_prayer_times',
    LANGUAGE_KEY: 'sangocast_language',
    BELL_SOUND_PATH: '/assets/sounds/prayer-bell.mp3',
    CHECK_INTERVAL: 30000 // Vérifier toutes les 30 secondes
  };

  // Messages multilingues
  const MESSAGES = {
    'fr-FR': {
      title: 'Temps de Prière dans {minutes} Minutes',
      subtitle: '{hour}:00 • "Un jour dans Sa présence vaut mille ailleurs"',
      speech: 'Il est bientôt {hour} heures. Temps de prière dans {minutes} minutes.'
    },
    'en-US': {
      title: 'Prayer Time in {minutes} Minutes',
      subtitle: '{hour}:00 • "A day in His presence is worth a thousand elsewhere"',
      speech: 'It\'s almost {hour} o\'clock. Prayer time in {minutes} minutes.'
    },
    'es-ES': {
      title: 'Tiempo de Oración en {minutes} Minutos',
      subtitle: '{hour}:00 • "Un día en Su presencia vale más que mil"',
      speech: 'Son casi las {hour}. Tiempo de oración en {minutes} minutos.'
    },
    'pt-PT': {
      title: 'Hora da Oração em {minutes} Minutos',
      subtitle: '{hour}:00 • "Um dia na Sua presença vale mais que mil"',
      speech: 'São quase {hour} horas. Hora da oração em {minutes} minutos.'
    },
    'ln-CD': { // Lingala (RDC)
      title: 'Ntango ya Losambo na Miniti {minutes}',
      subtitle: '{hour}:00 • "Mokolo moko na bozali na Ye ekoki koleka nkoto"',
      speech: 'Ezali pene {hour} ngonga. Ntango ya losambo na miniti {minutes}.'
    }
  };

  // État
  let prayerTimes = [];
  let language = 'fr-FR';
  let isEnabled = true;
  let checkInterval = null;
  let lastNotificationHour = null;

  /**
   * Initialiser le système d'alarmes
   */
  function init() {
    try {
      // Charger les préférences
      loadPreferences();
      
      // Démarrer la vérification périodique
      startChecking();
      
      // Ajouter styles CSS
      injectStyles();
      
      console.log('✅ Prayer Alarms initialisé:', prayerTimes);
      return true;
    } catch (error) {
      console.error('❌ Erreur initialisation Prayer Alarms:', error);
      return false;
    }
  }

  /**
   * Charger les préférences utilisateur
   */
  function loadPreferences() {
    try {
      // Charger heures de prière
      const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
      prayerTimes = stored ? JSON.parse(stored) : CONFIG.DEFAULT_PRAYER_TIMES;
      
      // Charger langue
      const storedLang = localStorage.getItem(CONFIG.LANGUAGE_KEY);
      language = storedLang || 'fr-FR';
      
    } catch (error) {
      console.warn('⚠️ Erreur chargement préférences:', error);
      prayerTimes = CONFIG.DEFAULT_PRAYER_TIMES;
      language = 'fr-FR';
    }
  }

  /**
   * Sauvegarder les heures de prière
   */
  function setPrayerTimes(times) {
    try {
      prayerTimes = times;
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(times));
      console.log('✅ Heures de prière sauvegardées:', times);
      return true;
    } catch (error) {
      console.error('❌ Erreur sauvegarde heures de prière:', error);
      return false;
    }
  }

  /**
   * Définir la langue
   */
  function setLanguage(lang) {
    if (MESSAGES[lang]) {
      language = lang;
      localStorage.setItem(CONFIG.LANGUAGE_KEY, lang);
      console.log('✅ Langue définie:', lang);
      return true;
    } else {
      console.warn('⚠️ Langue non supportée:', lang);
      return false;
    }
  }

  /**
   * Démarrer la vérification périodique
   */
  function startChecking() {
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    
    // Vérifier toutes les 30 secondes
    checkInterval = setInterval(() => {
      if (isEnabled) {
        checkPrayerTime();
      }
    }, CONFIG.CHECK_INTERVAL);
    
    // Vérification immédiate
    checkPrayerTime();
  }

  /**
   * Arrêter la vérification
   */
  function stopChecking() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }

  /**
   * Vérifier si c'est l'heure de notifier
   */
  function checkPrayerTime() {
    if (!isEnabled || prayerTimes.length === 0) {
      return;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Calculer les minutes avant la prochaine heure
    const minutesUntilNextHour = 60 - currentMinute;
    
    // Si on est exactement 2 minutes avant l'heure de prière
    if (minutesUntilNextHour === CONFIG.WARNING_MINUTES) {
      const nextHour = (currentHour + 1) % 24;
      
      // Vérifier si c'est une heure de prière
      if (prayerTimes.includes(nextHour)) {
        // Éviter double notification
        if (lastNotificationHour !== nextHour) {
          lastNotificationHour = nextHour;
          triggerAlarm(nextHour, CONFIG.WARNING_MINUTES);
        }
      }
    }
  }

  /**
   * Déclencher l'alarme complète
   */
  function triggerAlarm(prayerHour, minutesBefore) {
    console.log(`🔔 Alarme déclenchée: ${prayerHour}:00 (dans ${minutesBefore} min)`);
    
    // 1. BANNIÈRE VISUELLE
    showBanner(prayerHour, minutesBefore);
    
    // 2. SON DE CLOCHE
    playBellSound();
    
    // 3. ANNONCE VOCALE (1 seconde après le son)
    setTimeout(() => {
      speakAnnouncement(prayerHour, minutesBefore);
    }, 1000);
    
    // 4. VIBRATION (mobile)
    vibrate();
  }

  /**
   * Afficher la bannière visuelle
   */
  function showBanner(hour, minutes) {
    // Supprimer bannière existante
    const existing = document.getElementById('sangocast-prayer-banner');
    if (existing) {
      existing.remove();
    }

    // Obtenir messages dans la langue actuelle
    const messages = MESSAGES[language] || MESSAGES['en-US'];
    
    // Remplacer placeholders
    const title = messages.title.replace('{minutes}', minutes);
    const subtitle = messages.subtitle.replace('{hour}', String(hour).padStart(2, '0'));

    // Créer bannière
    const banner = document.createElement('div');
    banner.id = 'sangocast-prayer-banner';
    banner.innerHTML = `
      <div class="prayer-banner-content">
        <div class="prayer-icon">🙏</div>
        <div class="prayer-title">${title}</div>
        <div class="prayer-subtitle">${subtitle}</div>
        <button class="prayer-dismiss" onclick="SangocastPrayerAlarms.dismissBanner()">
          ✕
        </button>
      </div>
    `;
    
    document.body.appendChild(banner);

    // Auto-hide après durée configurée
    setTimeout(() => {
      dismissBanner();
    }, CONFIG.NOTIFICATION_DURATION);
  }

  /**
   * Fermer la bannière manuellement
   */
  function dismissBanner() {
    const banner = document.getElementById('sangocast-prayer-banner');
    if (banner) {
      banner.style.animation = 'slideDown 0.5s ease-out';
      setTimeout(() => banner.remove(), 500);
    }
  }

  /**
   * Jouer le son de cloche
   */
  function playBellSound() {
    // Essayer d'abord le fichier audio
    const audio = new Audio(CONFIG.BELL_SOUND_PATH);
    audio.volume = 0.5;
    
    audio.play().catch(error => {
      console.warn('⚠️ Impossible de jouer le fichier audio:', error);
      // Fallback: son généré
      generateBellSound();
    });
  }

  /**
   * Générer un son de cloche synthétique
   */
  function generateBellSound() {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      const playNote = (frequency, duration, delay) => {
        setTimeout(() => {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + duration);
        }, delay);
      };
      
      // Séquence de cloche d'église: Ding-Dong-Ding
      playNote(880, 0.6, 0);      // Note élevée (A5)
      playNote(659, 0.8, 700);    // Note moyenne (E5)
      playNote(880, 0.6, 1500);   // Note élevée (A5)
      
    } catch (error) {
      console.warn('⚠️ Web Audio API non supportée:', error);
    }
  }

  /**
   * Annoncer vocalement (Text-to-Speech)
   */
  function speakAnnouncement(hour, minutes) {
    if (!('speechSynthesis' in window)) {
      console.warn('⚠️ Speech Synthesis non supporté');
      return;
    }

    try {
      // Obtenir message dans la langue actuelle
      const messages = MESSAGES[language] || MESSAGES['en-US'];
      const text = messages.speech
        .replace('{hour}', hour)
        .replace('{minutes}', minutes);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      utterance.rate = 0.9;  // Légèrement plus lent
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      
      // Sélectionner une voix dans la langue appropriée
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.lang.startsWith(language.split('-')[0]));
      if (voice) {
        utterance.voice = voice;
      }

      window.speechSynthesis.speak(utterance);
      console.log('🗣️ Annonce vocale:', text);
      
    } catch (error) {
      console.error('❌ Erreur Text-to-Speech:', error);
    }
  }

  /**
   * Vibration (mobile)
   */
  function vibrate() {
    if ('vibrate' in navigator) {
      // Pattern: 200ms ON, 100ms OFF, 200ms ON, 100ms OFF, 200ms ON
      navigator.vibrate([200, 100, 200, 100, 200]);
      console.log('📳 Vibration déclenchée');
    }
  }

  /**
   * Injecter les styles CSS
   */
  function injectStyles() {
    if (document.getElementById('sangocast-prayer-styles')) {
      return; // Déjà injecté
    }

    const style = document.createElement('style');
    style.id = 'sangocast-prayer-styles';
    style.textContent = `
      #sangocast-prayer-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        z-index: 99999;
        animation: slideUp 0.5s ease-out;
      }

      .prayer-banner-content {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 24px;
        text-align: center;
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
        position: relative;
      }

      .prayer-icon {
        font-size: 64px;
        margin-bottom: 12px;
        animation: pulse 2s infinite;
      }

      .prayer-title {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 8px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .prayer-subtitle {
        font-size: 16px;
        opacity: 0.95;
        font-weight: 500;
      }

      .prayer-dismiss {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .prayer-dismiss:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.1);
      }

      @keyframes slideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @keyframes slideDown {
        from {
          transform: translateY(0);
          opacity: 1;
        }
        to {
          transform: translateY(100%);
          opacity: 0;
        }
      }

      @keyframes pulse {
        0%, 100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.1);
        }
      }

      /* Responsive mobile */
      @media (max-width: 768px) {
        .prayer-title {
          font-size: 22px;
        }
        .prayer-subtitle {
          font-size: 14px;
        }
        .prayer-icon {
          font-size: 48px;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Activer/désactiver les alarmes
   */
  function enable() {
    isEnabled = true;
    startChecking();
    console.log('✅ Prayer Alarms activées');
  }

  function disable() {
    isEnabled = false;
    stopChecking();
    dismissBanner();
    console.log('⏸️ Prayer Alarms désactivées');
  }

  /**
   * Test manuel (pour développement)
   */
  function testAlarm() {
    const nextHour = (new Date().getHours() + 1) % 24;
    console.log('🧪 Test alarme pour', nextHour + ':00');
    triggerAlarm(nextHour, 2);
  }

  /**
   * Obtenir le statut
   */
  function getStatus() {
    return {
      enabled: isEnabled,
      prayerTimes: prayerTimes,
      language: language,
      nextPrayerTime: getNextPrayerTime()
    };
  }

  /**
   * Calculer la prochaine heure de prière
   */
  function getNextPrayerTime() {
    if (prayerTimes.length === 0) {
      return null;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Trouver prochaine heure de prière aujourd'hui
    for (const hour of prayerTimes.sort((a, b) => a - b)) {
      if (hour > currentHour || (hour === currentHour && currentMinute < 60)) {
        return {
          hour: hour,
          minutes: 0,
          isToday: true
        };
      }
    }

    // Si aucune aujourd'hui, prendre la première demain
    return {
      hour: prayerTimes[0],
      minutes: 0,
      isToday: false
    };
  }

  // API publique
  return {
    init,
    setPrayerTimes,
    setLanguage,
    enable,
    disable,
    dismissBanner,
    testAlarm,
    getStatus,
    getNextPrayerTime
  };
})();

// Auto-initialisation
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    SangocastPrayerAlarms.init();
  });
} else {
  SangocastPrayerAlarms.init();
}

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SangocastPrayerAlarms;
}
