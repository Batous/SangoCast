/**
 * SANGOCAST HORNER ENGINE
 * Implémente le système de lecture biblique du Professeur Horner
 * 10 listes, 10 chapitres par jour, distribution horaire automatique
 */

const SangocastHornerEngine = (() => {
  'use strict';

  let hornerPlan = null;
  let isInitialized = false;

  /**
   * Charger le plan Horner
   */
  async function loadPlan() {
    if (hornerPlan) return hornerPlan;

    try {
      const response = await fetch('/data/horner-plan.json');
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      hornerPlan = await response.json();
      isInitialized = true;
      console.log('✅ Plan Horner chargé:', hornerPlan.lists.length, 'listes');
      return hornerPlan;
    } catch (error) {
      console.error('❌ Erreur chargement plan Horner:', error);
      throw error;
    }
  }

  /**
   * Obtenir le chapitre à lire pour une liste donnée à un jour donné
   * Les listes bouclent automatiquement (jour 90 de liste 1 = jour 1)
   */
  function getChapterForListAndDay(listId, dayNumber) {
    if (!hornerPlan) {
      throw new Error('Plan Horner non chargé. Appelez loadPlan() d\'abord.');
    }

    const list = hornerPlan.lists.find(l => l.id === listId);
    if (!list) {
      throw new Error(`Liste ${listId} non trouvée`);
    }

    // Calculer le jour dans le cycle (liste boucle)
    const dayInCycle = ((dayNumber - 1) % list.totalDays) + 1;

    // Trouver le chapitre pour ce jour
    const chapterEntry = list.chapters.find(c => c.day === dayInCycle);
    
    if (!chapterEntry) {
      console.warn(`Chapitre non trouvé pour liste ${listId}, jour ${dayInCycle}. Utilisation jour 1.`);
      return list.chapters[0];
    }

    return chapterEntry;
  }

  /**
   * Générer les créneaux horaires de 10 minutes pour une heure donnée
   * Ex: heure 6 → ["0600", "0610", "0620", "0630", "0640", "0650"]
   */
  function generateTimeslots(startHour) {
    const timeslots = [];
    for (let minute = 0; minute < 60; minute += 10) {
      const hourStr = String(startHour).padStart(2, '0');
      const minStr = String(minute).padStart(2, '0');
      timeslots.push(hourStr + minStr);
    }
    return timeslots;
  }

  /**
   * Obtenir la distribution horaire pour toutes les listes
   */
  function getTimeDistribution() {
    if (!hornerPlan) {
      // Distribution par défaut si plan pas encore chargé
      return [
        {list: 1, startHour: 6, endHour: 7},
        {list: 2, startHour: 7, endHour: 8},
        {list: 3, startHour: 8, endHour: 9},
        {list: 4, startHour: 9, endHour: 10},
        {list: 5, startHour: 10, endHour: 11},
        {list: 6, startHour: 11, endHour: 12},
        {list: 7, startHour: 12, endHour: 13},
        {list: 8, startHour: 13, endHour: 14},
        {list: 9, startHour: 14, endHour: 15},
        {list: 10, startHour: 15, endHour: 16}
      ];
    }

    return hornerPlan.timeDistribution.schedule;
  }

  /**
   * Fonction principale: Obtenir la lecture complète pour un jour
   */
  async function getReadingForDay(dayNumber) {
    // Charger le plan si pas encore fait
    if (!hornerPlan) {
      await loadPlan();
    }

    const reading = {
      day: dayNumber,
      totalChapters: 10,
      chapters: []
    };

    const timeDistribution = getTimeDistribution();

    // Pour chaque liste (1-10)
    for (let listId = 1; listId <= 10; listId++) {
      try {
        // Obtenir le chapitre à lire aujourd'hui
        const chapter = getChapterForListAndDay(listId, dayNumber);
        
        // Obtenir la distribution horaire pour cette liste
        const timeSlot = timeDistribution.find(t => t.list === listId);
        
        if (!timeSlot) {
          console.warn(`Pas de créneau horaire pour liste ${listId}`);
          continue;
        }

        // Générer les créneaux de 10 minutes
        const timeslots = timeSlot.timeslots || generateTimeslots(timeSlot.startHour);

        reading.chapters.push({
          list: listId,
          listName: hornerPlan.lists[listId - 1].name,
          book: chapter.book,
          chapter: chapter.chapter,
          dayInCycle: ((dayNumber - 1) % hornerPlan.lists[listId - 1].totalDays) + 1,
          startHour: timeSlot.startHour,
          endHour: timeSlot.endHour,
          timeslots: timeslots
        });

      } catch (error) {
        console.error(`Erreur liste ${listId}:`, error);
      }
    }

    return reading;
  }

  /**
   * Obtenir le chapitre à lire pour un créneau horaire spécifique
   * Ex: getReadingForTime(1, "0820") → Liste 3, jour 1
   */
  async function getReadingForTime(dayNumber, timeString) {
    const reading = await getReadingForDay(dayNumber);
    
    // Trouver quel chapitre correspond à ce créneau
    for (const chapter of reading.chapters) {
      if (chapter.timeslots.includes(timeString)) {
        return {
          ...chapter,
          currentTimeslot: timeString,
          timeslotIndex: chapter.timeslots.indexOf(timeString)
        };
      }
    }

    return null;
  }

  /**
   * Calculer le numéro de jour depuis l'installation
   */
  function getDaysSinceInstall(installDate) {
    const now = new Date();
    const install = new Date(installDate);
    const diffTime = Math.abs(now - install);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Obtenir la lecture d'aujourd'hui (basé sur date d'installation)
   */
  async function getTodaysReading(installDate) {
    const dayNumber = getDaysSinceInstall(installDate);
    return await getReadingForDay(dayNumber);
  }

  /**
   * Obtenir tous les versets à lire pour un chapitre complet
   * Retourne un tableau de références pour bible-lookup
   */
  async function getVersesForChapter(book, chapter, bibleVersion = 'KJV') {
    // Note: Cette fonction nécessite de connaître le nombre de versets par chapitre
    // Pour l'instant, on retourne une structure que bible-lookup peut utiliser
    
    // Dans une version complète, charger depuis un fichier verse-counts.json
    // qui liste le nombre de versets par chapitre
    
    return {
      version: bibleVersion,
      book: book,
      chapter: chapter,
      verses: [] // À remplir avec [1, 2, 3, ..., n] selon le chapitre
    };
  }

  /**
   * Obtenir des statistiques sur le progrès
   */
  function getProgress(dayNumber) {
    if (!hornerPlan) {
      return null;
    }

    const progress = {
      totalDaysActive: dayNumber,
      listsProgress: []
    };

    for (const list of hornerPlan.lists) {
      const cycles = Math.floor((dayNumber - 1) / list.totalDays);
      const currentDay = ((dayNumber - 1) % list.totalDays) + 1;
      const percentComplete = (currentDay / list.totalDays * 100).toFixed(1);

      progress.listsProgress.push({
        listId: list.id,
        listName: list.name,
        totalDays: list.totalDays,
        currentDay: currentDay,
        cyclesCompleted: cycles,
        percentComplete: percentComplete
      });
    }

    return progress;
  }

  /**
   * Obtenir un résumé de la journée (pour affichage)
   */
  async function getDailySummary(dayNumber) {
    const reading = await getReadingForDay(dayNumber);
    const progress = getProgress(dayNumber);

    return {
      day: dayNumber,
      date: new Date().toLocaleDateString('fr-FR'),
      totalChapters: reading.totalChapters,
      schedule: reading.chapters.map(ch => ({
        time: `${String(ch.startHour).padStart(2, '0')}:00 - ${String(ch.endHour).padStart(2, '0')}:00`,
        reading: `${ch.book} ${ch.chapter}`,
        list: `Liste ${ch.list}: ${ch.listName}`
      })),
      progress: progress
    };
  }

  /**
   * Vérifier si le plan est chargé
   */
  function isLoaded() {
    return isInitialized && hornerPlan !== null;
  }

  // API publique
  return {
    loadPlan,
    getReadingForDay,
    getReadingForTime,
    getTodaysReading,
    getDaysSinceInstall,
    getProgress,
    getDailySummary,
    getVersesForChapter,
    isLoaded
  };
})();

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SangocastHornerEngine;
}
