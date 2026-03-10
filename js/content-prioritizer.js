/**
 * SANGOCAST CONTENT PRIORITIZER
 * Le cerveau du système - décide quel contenu afficher
 * Intègre: Network, Bible Lookup, Horner, Age Filter, Prayer Alarms
 */

const SangocastContentPrioritizer = (() => {
  'use strict';

  // Priorités strictes (ordre descendant)
  const PRIORITIES = {
    LIVE_VIDEO: 1,
    LIVE_AUDIO: 2,
    PASTOR_SCHEDULE: 3,
    EVENT_SEMINAR: 4,
    LITURGICAL: 5,
    HORNER_PLAN: 6,
    FALLBACK: 7
  };

  let channelsData = null;
  let liturgicalCalendar = null;
  let installDate = null;

  /**
   * Initialiser le prioritizer
   */
  async function init(userInstallDate = null) {
    try {
      installDate = userInstallDate || localStorage.getItem('sangocast_install_date') || new Date().toISOString();
      
      // Sauvegarder date d'installation si nouvelle
      if (!localStorage.getItem('sangocast_install_date')) {
        localStorage.setItem('sangocast_install_date', installDate);
      }

      console.log('✅ Content Prioritizer initialisé');
      console.log('📅 Date installation:', new Date(installDate).toLocaleDateString());
      return true;
    } catch (error) {
      console.error('❌ Erreur initialisation Prioritizer:', error);
      return false;
    }
  }

  /**
   * Charger les données de chaînes
   */
  async function loadChannelsData() {
    if (channelsData) return channelsData;

    try {
      const response = await fetch('/data/channels.json');
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      channelsData = await response.json();
      console.log('✅ Channels data chargées');
      return channelsData;
    } catch (error) {
      console.warn('⚠️ Impossible de charger channels.json:', error);
      channelsData = { channels: [] };
      return channelsData;
    }
  }

  /**
   * Charger calendrier liturgique
   */
  async function loadLiturgicalCalendar() {
    if (liturgicalCalendar) return liturgicalCalendar;

    try {
      const response = await fetch('/data/liturgical-calendar.json');
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      liturgicalCalendar = await response.json();
      console.log('✅ Calendrier liturgique chargé');
      return liturgicalCalendar;
    } catch (error) {
      console.warn('⚠️ Impossible de charger calendrier liturgique:', error);
      liturgicalCalendar = {};
      return liturgicalCalendar;
    }
  }

  /**
   * Obtenir la chaîne de l'utilisateur
   */
  async function getChannel(channelId) {
    const data = await loadChannelsData();
    const channel = data.channels?.find(ch => ch.id === channelId);
    return channel || null;
  }

  /**
   * Formater date/heure actuelle
   */
  function getCurrentDateTime() {
    const now = new Date();
    return {
      date: now.toISOString().split('T')[0], // YYYY-MM-DD
      time: String(now.getHours()).padStart(2, '0') + String(Math.floor(now.getMinutes() / 10) * 10).padStart(2, '0'), // HHMM (10-min slots)
      fullTime: String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0'), // HHMM exact
      hour: now.getHours(),
      minute: now.getMinutes(),
      dayOfWeek: now.getDay()
    };
  }

  /**
   * Vérifier si un live est actif maintenant
   */
  function isLiveActive(liveData) {
    if (!liveData || !liveData.startTime || !liveData.endTime) {
      return false;
    }

    const now = new Date();
    const start = new Date(liveData.startTime);
    const end = new Date(liveData.endTime);

    return now >= start && now <= end;
  }

  /**
   * PRIORITÉ 1: Vérifier LIVE VIDEO
   */
  async function checkLiveVideo(channel, dateTime) {
    if (!channel?.schedule?.video) {
      return null;
    }

    const key = `${dateTime.date}-${dateTime.time}`;
    const liveVideo = channel.schedule.video[key];

    if (liveVideo && isLiveActive(liveVideo)) {
      console.log('🎥 PRIORITÉ 1: Live vidéo actif');
      return {
        type: 'video',
        priority: PRIORITIES.LIVE_VIDEO,
        content: {
          title: liveVideo.title,
          url: liveVideo.url,
          startTime: liveVideo.startTime,
          endTime: liveVideo.endTime,
          isLive: true
        }
      };
    }

    return null;
  }

  /**
   * PRIORITÉ 2: Vérifier LIVE AUDIO
   */
  async function checkLiveAudio(channel, dateTime) {
    if (!channel?.schedule?.audio) {
      return null;
    }

    const key = `${dateTime.date}-${dateTime.time}`;
    const liveAudio = channel.schedule.audio[key];

    if (liveAudio && isLiveActive(liveAudio)) {
      console.log('🔊 PRIORITÉ 2: Live audio actif');
      return {
        type: 'audio',
        priority: PRIORITIES.LIVE_AUDIO,
        content: {
          title: liveAudio.title,
          url: liveAudio.url,
          startTime: liveAudio.startTime,
          endTime: liveAudio.endTime,
          isLive: true
        }
      };
    }

    return null;
  }

  /**
   * PRIORITÉ 3: Vérifier PROGRAMME PASTEUR
   */
  async function checkPastorSchedule(channel, dateTime, ageMode) {
    if (!channel?.schedule?.text) {
      return null;
    }

    const key = `${dateTime.date}-${dateTime.time}`;
    const scheduledVerse = channel.schedule.text[key];

    if (scheduledVerse) {
      // Vérifier appropriété selon âge
      const appropriate = SangocastAgeFilter.shouldDisplayVerse({
        book: scheduledVerse.book,
        chapter: scheduledVerse.chapter,
        verse: scheduledVerse.verses ? scheduledVerse.verses[0] : null
      }, ageMode);

      if (!appropriate.allowed) {
        console.log('⚠️ Verset pasteur bloqué:', appropriate.reason);
        return null; // Passer à la priorité suivante
      }

      // Obtenir le texte via Bible Lookup
      const verse = await SangocastBibleLookup.lookupVerse({
        version: scheduledVerse.version || 'KJV',
        book: scheduledVerse.book,
        chapter: scheduledVerse.chapter,
        verses: scheduledVerse.verses || [1]
      });

      if (verse.error) {
        console.error('❌ Erreur lookup verset pasteur:', verse.error);
        return null;
      }

      console.log('📖 PRIORITÉ 3: Programme pasteur');
      return {
        type: 'text',
        priority: PRIORITIES.PASTOR_SCHEDULE,
        content: {
          reference: verse.reference,
          text: verse.text,
          version: verse.version,
          commentary: scheduledVerse.commentary || null,
          pastor: channel.metadata?.pastor || 'Unknown'
        }
      };
    }

    return null;
  }

  /**
   * PRIORITÉ 4: Vérifier ÉVÉNEMENT/SÉMINAIRE
   */
  async function checkEvent(channel, dateTime, ageMode) {
    if (!channel?.schedule?.events) {
      return null;
    }

    const eventKey = dateTime.date;
    const event = channel.schedule.events[eventKey];

    if (event && event.schedule) {
      const timeKey = `${dateTime.date}-${dateTime.time}`;
      const eventVerse = event.schedule[timeKey];

      if (eventVerse) {
        // Vérifier appropriété
        const appropriate = SangocastAgeFilter.shouldDisplayVerse({
          book: eventVerse.book,
          chapter: eventVerse.chapter
        }, ageMode);

        if (!appropriate.allowed) {
          console.log('⚠️ Verset événement bloqué:', appropriate.reason);
          return null;
        }

        // Obtenir texte
        const verse = await SangocastBibleLookup.lookupVerse({
          version: eventVerse.version || 'KJV',
          book: eventVerse.book,
          chapter: eventVerse.chapter,
          verses: eventVerse.verses || [1]
        });

        if (verse.error) {
          return null;
        }

        console.log('🎪 PRIORITÉ 4: Événement spécial');
        return {
          type: 'text',
          priority: PRIORITIES.EVENT_SEMINAR,
          content: {
            reference: verse.reference,
            text: verse.text,
            version: verse.version,
            eventName: event.title,
            eventDates: event.dates
          }
        };
      }
    }

    return null;
  }

  /**
   * PRIORITÉ 5: Vérifier CALENDRIER LITURGIQUE
   */
  async function checkLiturgical(dateTime, userTradition, ageMode) {
    const calendar = await loadLiturgicalCalendar();
    
    if (!calendar || !calendar[dateTime.date.substring(0, 4)]) {
      return null;
    }

    const yearData = calendar[dateTime.date.substring(0, 4)];
    const tradition = userTradition || 'reformed';
    const liturgicalDay = yearData[tradition]?.[dateTime.date];

    if (liturgicalDay && liturgicalDay.reading) {
      // Vérifier appropriété
      const appropriate = SangocastAgeFilter.shouldDisplayVerse({
        book: liturgicalDay.reading.book,
        chapter: liturgicalDay.reading.chapter
      }, ageMode);

      if (!appropriate.allowed) {
        console.log('⚠️ Lecture liturgique bloquée:', appropriate.reason);
        return null;
      }

      // Obtenir texte
      const verse = await SangocastBibleLookup.lookupVerse({
        version: liturgicalDay.reading.version || 'KJV',
        book: liturgicalDay.reading.book,
        chapter: liturgicalDay.reading.chapter,
        verses: liturgicalDay.reading.verses || [1]
      });

      if (verse.error) {
        return null;
      }

      console.log('⛪ PRIORITÉ 5: Calendrier liturgique');
      return {
        type: 'text',
        priority: PRIORITIES.LITURGICAL,
        content: {
          reference: verse.reference,
          text: verse.text,
          version: verse.version,
          liturgicalName: liturgicalDay.name,
          season: liturgicalDay.season,
          color: liturgicalDay.color
        }
      };
    }

    return null;
  }

  /**
   * PRIORITÉ 6: Vérifier PLAN HORNER
   */
  async function checkHornerPlan(dateTime, ageMode, bibleVersion = 'KJV') {
    try {
      // Calculer jour depuis installation
      const dayNumber = SangocastHornerEngine.getDaysSinceInstall(installDate);
      
      // Obtenir lecture pour créneau actuel
      const reading = await SangocastHornerEngine.getReadingForTime(dayNumber, dateTime.time);

      if (!reading) {
        console.warn('⚠️ Aucune lecture Horner pour ce créneau');
        return null;
      }

      // Vérifier appropriété
      const appropriate = SangocastAgeFilter.shouldDisplayVerse({
        book: reading.book,
        chapter: reading.chapter
      }, ageMode);

      if (!appropriate.allowed) {
        console.log('⚠️ Chapitre Horner bloqué:', appropriate.reason);
        // Obtenir alternative sûre
        const safeAlt = SangocastAgeFilter.getSafeAlternative();
        const safeVerse = await SangocastBibleLookup.lookupVerse({
          version: bibleVersion,
          book: safeAlt.book,
          chapter: safeAlt.chapter,
          verses: [safeAlt.verse]
        });

        return {
          type: 'text',
          priority: PRIORITIES.HORNER_PLAN,
          content: {
            reference: safeVerse.reference,
            text: safeVerse.text,
            version: bibleVersion,
            replacedUnsafe: true,
            originalReference: `${reading.book} ${reading.chapter}`
          }
        };
      }

      // Obtenir premiers versets du chapitre (1-3)
      const verse = await SangocastBibleLookup.lookupVerse({
        version: bibleVersion,
        book: reading.book,
        chapter: reading.chapter,
        verses: [1, 2, 3]
      });

      if (verse.error) {
        console.error('❌ Erreur lookup Horner:', verse.error);
        return null;
      }

      console.log('📚 PRIORITÉ 6: Plan Horner');
      return {
        type: 'text',
        priority: PRIORITIES.HORNER_PLAN,
        content: {
          reference: verse.reference,
          text: verse.text,
          version: bibleVersion,
          hornerList: reading.list,
          hornerDay: dayNumber,
          timeslot: dateTime.time
        }
      };

    } catch (error) {
      console.error('❌ Erreur Plan Horner:', error);
      return null;
    }
  }

  /**
   * PRIORITÉ 7: FALLBACK — rotation sur un ensemble de versets sûrs
   * Utilise SangocastBibleLookup.lookupVerse() pour obtenir le texte réel.
   * Si le lookup échoue, le texte de secours est fourni directement.
   */
  // Versets de secours pour le fallback (utilisés si BibleLookup indisponible)
  const FALLBACK_VERSES = [
    { book: 'Psalms',       chapter: 23,  verses: [1],    text: 'The Lord is my shepherd; I shall not want.' },
    { book: 'John',         chapter: 3,   verses: [16],   text: 'For God so loved the world, that he gave his only begotten Son.' },
    { book: 'Philippians',  chapter: 4,   verses: [13],   text: 'I can do all things through Christ which strengtheneth me.' },
    { book: 'Proverbs',     chapter: 3,   verses: [5, 6], text: 'Trust in the Lord with all thine heart; and lean not unto thine own understanding.' },
    { book: 'Romans',       chapter: 8,   verses: [28],   text: 'And we know that all things work together for good to them that love God.' },
    { book: 'Isaiah',       chapter: 40,  verses: [31],   text: 'But they that wait upon the Lord shall renew their strength.' },
    { book: 'Matthew',      chapter: 11,  verses: [28],   text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.' },
    { book: 'Lamentations', chapter: 3,   verses: [22, 23], text: 'It is of the Lord\'s mercies that we are not consumed, because his compassions fail not.' }
  ];
  let fallbackRotationIndex = 0;

  async function getFallback(bibleVersion = 'KJV') {
    // Rotation sur les versets de secours
    const entry = FALLBACK_VERSES[fallbackRotationIndex % FALLBACK_VERSES.length];
    fallbackRotationIndex++;

    console.log('🆘 PRIORITÉ 7: Fallback →', entry.book, entry.chapter);

    // Tentative d'obtenir le texte réel via BibleLookup
    const verseResult = await SangocastBibleLookup.lookupVerse({
      version: bibleVersion,
      book: entry.book,
      chapter: entry.chapter,
      verses: entry.verses
    });

    // Si lookup réussit, utiliser le texte réel ; sinon texte de secours intégré
    const verseText = (verseResult && verseResult.text) ? verseResult.text : entry.text;
    const reference = (verseResult && verseResult.reference)
      ? verseResult.reference
      : `${entry.book} ${entry.chapter}:${entry.verses.join(',')}`;

    if (verseResult && verseResult.error) {
      console.warn('⚠️ Fallback BibleLookup échoué:', verseResult.error, '— texte embarqué utilisé');
    }

    return {
      type: 'text',
      priority: PRIORITIES.FALLBACK,
      content: {
        reference: reference,
        text: verseText,
        version: bibleVersion,
        isFallback: true
      }
    };
  }

  /**
   * FONCTION PRINCIPALE: Obtenir contenu pour maintenant
   */
  async function getContentForNow(userChannelId, userAgeMode = 'family_mode', userTradition = 'reformed', bibleVersion = 'KJV') {
    try {
      const dateTime = getCurrentDateTime();
      
      console.log('⏰ Obtention contenu pour:', dateTime.date, dateTime.time);
      console.log('📺 Chaîne:', userChannelId);
      console.log('👥 Mode âge:', userAgeMode);

      // Charger chaîne utilisateur
      const channel = await getChannel(userChannelId);
      
      if (!channel) {
        console.warn('⚠️ Chaîne non trouvée:', userChannelId);
      }

      // Vérifier priorités dans l'ordre

      // PRIORITÉ 1: Live Video
      const liveVideo = await checkLiveVideo(channel, dateTime);
      if (liveVideo) return liveVideo;

      // PRIORITÉ 2: Live Audio
      const liveAudio = await checkLiveAudio(channel, dateTime);
      if (liveAudio) return liveAudio;

      // PRIORITÉ 3: Programme Pasteur
      const pastorSchedule = await checkPastorSchedule(channel, dateTime, userAgeMode);
      if (pastorSchedule) return pastorSchedule;

      // PRIORITÉ 4: Événement
      const event = await checkEvent(channel, dateTime, userAgeMode);
      if (event) return event;

      // PRIORITÉ 5: Calendrier Liturgique
      const liturgical = await checkLiturgical(dateTime, userTradition, userAgeMode);
      if (liturgical) return liturgical;

      // PRIORITÉ 6: Plan Horner
      const horner = await checkHornerPlan(dateTime, userAgeMode, bibleVersion);
      if (horner) return horner;

      // PRIORITÉ 7: Fallback
      return await getFallback(bibleVersion);

    } catch (error) {
      console.error('❌ Erreur Content Prioritizer:', error);
      
      // Fallback d'urgence
      return {
        type: 'text',
        priority: PRIORITIES.FALLBACK,
        content: {
          reference: 'Psalms 23:1',
          text: 'The Lord is my shepherd; I shall not want.',
          version: 'KJV',
          error: error.message
        }
      };
    }
  }

  /**
   * Obtenir contenu pour un moment spécifique
   */
  async function getContentForTime(userChannelId, dateString, timeString, userAgeMode = 'family_mode') {
    // Simuler dateTime pour un moment spécifique
    const [year, month, day] = dateString.split('-');
    const hour = parseInt(timeString.substring(0, 2));
    const minute = parseInt(timeString.substring(2, 4));

    const testDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour, minute);
    
    const dateTime = {
      date: dateString,
      time: timeString,
      hour: hour,
      minute: minute,
      dayOfWeek: testDate.getDay()
    };

    // Même logique mais avec dateTime spécifique
    // (Implémentation similaire à getContentForNow)
  }

  /**
   * Obtenir l'état actuel
   */
  function getStatus() {
    return {
      installDate: installDate,
      daysSinceInstall: installDate ? SangocastHornerEngine.getDaysSinceInstall(installDate) : 0,
      currentDateTime: getCurrentDateTime(),
      priorities: PRIORITIES
    };
  }

  // API publique
  return {
    init,
    getContentForNow,
    getContentForTime,
    getStatus,
    PRIORITIES
  };
})();

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SangocastContentPrioritizer;
}
