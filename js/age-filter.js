/**
 * SANGOCAST AGE FILTER
 * Système de filtrage de contenu biblique selon l'âge
 * Protège les enfants du contenu inapproprié
 */

const SangocastAgeFilter = (() => {
  'use strict';

  let sensitiveVerses = null;
  let currentAgeMode = 'family_mode';
  const STORAGE_KEY = 'sangocast_age_mode';

  /**
   * Charger la liste des versets sensibles
   */
  async function loadSensitiveVerses() {
    if (sensitiveVerses) {
      return sensitiveVerses;
    }

    try {
      const response = await fetch('/data/sensitive-verses.json');
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      sensitiveVerses = await response.json();
      console.log('✅ Liste versets sensibles chargée');
      return sensitiveVerses;
    } catch (error) {
      console.error('❌ Erreur chargement versets sensibles:', error);
      // Mode sécuritaire par défaut si échec
      sensitiveVerses = { ageRestricted: { adults_only: [], family_mode: [], children_whitelist: [] } };
      return sensitiveVerses;
    }
  }

  /**
   * Initialiser le filtre
   */
  async function init() {
    try {
      // Charger mode sauvegardé
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ['adults_only', 'family_mode', 'children_mode'].includes(stored)) {
        currentAgeMode = stored;
      }

      // Charger liste sensible
      await loadSensitiveVerses();

      console.log('✅ Age Filter initialisé - Mode:', currentAgeMode);
      return true;
    } catch (error) {
      console.error('❌ Erreur initialisation Age Filter:', error);
      return false;
    }
  }

  /**
   * Définir le mode d'âge
   */
  function setAgeMode(mode) {
    const validModes = ['adults_only', 'family_mode', 'children_mode'];
    
    if (!validModes.includes(mode)) {
      console.error('❌ Mode d\'âge invalide:', mode);
      return false;
    }

    currentAgeMode = mode;
    localStorage.setItem(STORAGE_KEY, mode);
    console.log('✅ Mode d\'âge défini:', mode);
    return true;
  }

  /**
   * Obtenir le mode actuel
   */
  function getAgeMode() {
    return currentAgeMode;
  }

  /**
   * Vérifier si un livre/chapitre/verset est dans une liste
   */
  function isInList(list, book, chapter, verse = null) {
    for (const entry of list) {
      // Match book
      if (entry.book !== book) continue;

      // Match chapters (whole chapters)
      if (entry.chapters) {
        if (entry.chapters.includes(chapter)) {
          return { blocked: true, reason: entry.reason };
        }
      }

      // Match specific chapter
      if (entry.chapter === chapter) {
        // If no verse specified, entire chapter is blocked
        if (!entry.verses) {
          return { blocked: true, reason: entry.reason };
        }
        
        // Check specific verses if provided
        if (verse !== null && entry.verses.includes(verse)) {
          return { blocked: true, reason: entry.reason };
        }
      }
    }

    return { blocked: false };
  }

  /**
   * Vérifier si un livre/chapitre est dans la whitelist enfants
   */
  function isInChildrenWhitelist(book, chapter) {
    if (!sensitiveVerses || !sensitiveVerses.ageRestricted.children_whitelist) {
      return false;
    }

    for (const entry of sensitiveVerses.ageRestricted.children_whitelist) {
      if (entry.book !== book) continue;

      // Check if chapter is explicitly listed
      if (entry.chapters && entry.chapters.includes(chapter)) {
        // Check if not in excluded chapters
        if (entry.excluded_chapters && entry.excluded_chapters.includes(chapter)) {
          return false;
        }
        return true;
      }
    }

    return false;
  }

  /**
   * Fonction principale: Vérifier si un verset doit être affiché
   * 
   * @param {Object} reference - { book, chapter, verse }
   * @param {String} ageMode - 'adults_only', 'family_mode', 'children_mode'
   * @returns {Object} - { allowed: boolean, reason: string }
   */
  function shouldDisplayVerse(reference, ageMode = null) {
    // Utiliser mode actuel si non spécifié
    const mode = ageMode || currentAgeMode;

    // Valider référence
    if (!reference || !reference.book || !reference.chapter) {
      return { allowed: false, reason: 'Invalid reference' };
    }

    const { book, chapter, verse } = reference;

    // Charger liste si pas encore fait
    if (!sensitiveVerses) {
      console.warn('⚠️ Versets sensibles pas encore chargés - permettre par défaut');
      return { allowed: true, reason: 'Not yet loaded' };
    }

    // MODE ADULTES: Tout est permis
    if (mode === 'adults_only') {
      return { allowed: true, reason: 'Adults mode - no restrictions' };
    }

    // MODE FAMILLE: Bloquer adults_only
    if (mode === 'family_mode') {
      const adultsCheck = isInList(
        sensitiveVerses.ageRestricted.adults_only,
        book,
        chapter,
        verse
      );

      if (adultsCheck.blocked) {
        return { 
          allowed: false, 
          reason: `Blocked for family mode: ${adultsCheck.reason}`
        };
      }

      // Bloquer aussi contenu family_mode (violence extrême)
      const familyCheck = isInList(
        sensitiveVerses.ageRestricted.family_mode,
        book,
        chapter,
        verse
      );

      if (familyCheck.blocked) {
        return {
          allowed: false,
          reason: `Blocked for family mode: ${familyCheck.reason}`
        };
      }

      return { allowed: true, reason: 'Passed family mode filter' };
    }

    // MODE ENFANTS: Whitelist uniquement
    if (mode === 'children_mode') {
      const isWhitelisted = isInChildrenWhitelist(book, chapter);

      if (isWhitelisted) {
        // Double-vérifier qu'il n'est pas dans adults_only ou family_mode
        const adultsCheck = isInList(
          sensitiveVerses.ageRestricted.adults_only,
          book,
          chapter,
          verse
        );

        const familyCheck = isInList(
          sensitiveVerses.ageRestricted.family_mode,
          book,
          chapter,
          verse
        );

        if (adultsCheck.blocked || familyCheck.blocked) {
          return {
            allowed: false,
            reason: 'In whitelist but contains sensitive content'
          };
        }

        return { allowed: true, reason: 'In children whitelist' };
      }

      return {
        allowed: false,
        reason: 'Not in children whitelist - children mode requires explicit approval'
      };
    }

    // Mode inconnu - mode sécuritaire
    return { allowed: false, reason: 'Unknown mode - default deny' };
  }

  /**
   * Vérifier un chapitre entier
   */
  function shouldDisplayChapter(book, chapter, ageMode = null) {
    return shouldDisplayVerse({ book, chapter }, ageMode);
  }

  /**
   * Obtenir une liste de chapitres sûrs pour un livre
   */
  function getSafeChapters(book, ageMode = null) {
    const mode = ageMode || currentAgeMode;
    const safeChapters = [];

    // Pour mode enfants, utiliser whitelist
    if (mode === 'children_mode') {
      if (!sensitiveVerses) return [];

      const whitelist = sensitiveVerses.ageRestricted.children_whitelist;
      for (const entry of whitelist) {
        if (entry.book === book && entry.chapters) {
          safeChapters.push(...entry.chapters);
        }
      }

      return safeChapters.sort((a, b) => a - b);
    }

    // Pour autres modes, il faudrait connaître le nombre total de chapitres
    // C'est une limitation - on retourne vide pour forcer vérification individuelle
    return [];
  }

  /**
   * Obtenir statistiques de filtrage
   */
  function getFilterStats() {
    if (!sensitiveVerses) {
      return null;
    }

    return {
      adultsOnlyCount: sensitiveVerses.ageRestricted.adults_only.length,
      familyModeCount: sensitiveVerses.ageRestricted.family_mode.length,
      childrenWhitelistCount: sensitiveVerses.ageRestricted.children_whitelist.length,
      currentMode: currentAgeMode
    };
  }

  /**
   * Obtenir la raison du blocage pour un verset
   */
  function getBlockReason(book, chapter, verse = null, ageMode = null) {
    const mode = ageMode || currentAgeMode;

    if (mode === 'adults_only') {
      return null; // Rien n'est bloqué
    }

    if (!sensitiveVerses) {
      return null;
    }

    // Vérifier adults_only
    const adultsCheck = isInList(
      sensitiveVerses.ageRestricted.adults_only,
      book,
      chapter,
      verse
    );

    if (adultsCheck.blocked) {
      return adultsCheck.reason;
    }

    // Vérifier family_mode si mode enfants
    if (mode === 'children_mode' || mode === 'family_mode') {
      const familyCheck = isInList(
        sensitiveVerses.ageRestricted.family_mode,
        book,
        chapter,
        verse
      );

      if (familyCheck.blocked) {
        return familyCheck.reason;
      }
    }

    // Mode enfants: vérifier whitelist
    if (mode === 'children_mode') {
      const isWhitelisted = isInChildrenWhitelist(book, chapter);
      if (!isWhitelisted) {
        return 'Not approved for children';
      }
    }

    return null;
  }

  /**
   * Obtenir une alternative sûre (verset de remplacement)
   */
  function getSafeAlternative(ageMode = null) {
    // Versets toujours sûrs pour tous âges
    const safeVerses = [
      { book: 'Psalms', chapter: 23, verse: 1 },
      { book: 'John', chapter: 3, verse: 16 },
      { book: 'Philippians', chapter: 4, verse: 13 },
      { book: 'Psalms', chapter: 46, verse: 1 },
      { book: 'Proverbs', chapter: 3, verse: 5 },
      { book: 'Isaiah', chapter: 40, verse: 31 },
      { book: 'Matthew', chapter: 5, verse: 14 },
      { book: 'Romans', chapter: 8, verse: 28 },
      { book: 'Jeremiah', chapter: 29, verse: 11 },
      { book: 'Psalms', chapter: 118, verse: 24 }
    ];

    // Choisir aléatoirement
    return safeVerses[Math.floor(Math.random() * safeVerses.length)];
  }

  // API publique
  return {
    init,
    loadSensitiveVerses,
    setAgeMode,
    getAgeMode,
    shouldDisplayVerse,
    shouldDisplayChapter,
    getSafeChapters,
    getFilterStats,
    getBlockReason,
    getSafeAlternative
  };
})();

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SangocastAgeFilter;
}
