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
   * Couvre 24h en trois blocs : matin (6-16h), soirée (16-22h), nuit (22-6h)
   * Les 10 listes sont distribuées dans chaque bloc avec rotation continue
   */
  function getTimeDistribution() {
    // Distribution principale 6h-16h (une liste par heure)
    const mainSchedule = [
      {list: 1, startHour: 6,  endHour: 7},
      {list: 2, startHour: 7,  endHour: 8},
      {list: 3, startHour: 8,  endHour: 9},
      {list: 4, startHour: 9,  endHour: 10},
      {list: 5, startHour: 10, endHour: 11},
      {list: 6, startHour: 11, endHour: 12},
      {list: 7, startHour: 12, endHour: 13},
      {list: 8, startHour: 13, endHour: 14},
      {list: 9, startHour: 14, endHour: 15},
      {list: 10, startHour: 15, endHour: 16}
    ];

    // Extension soirée 16h-22h (listes 1-6 en répétition)
    const eveningSchedule = [
      {list: 1, startHour: 16, endHour: 17},
      {list: 2, startHour: 17, endHour: 18},
      {list: 3, startHour: 18, endHour: 19},
      {list: 4, startHour: 19, endHour: 20},
      {list: 5, startHour: 20, endHour: 21},
      {list: 6, startHour: 21, endHour: 22}
    ];

    // Extension nuit 22h-6h (listes 7-10 + 1-4 pour la nuit/prière matinale)
    const nightSchedule = [
      {list: 7,  startHour: 22, endHour: 23},
      {list: 8,  startHour: 23, endHour: 24},
      {list: 9,  startHour: 0,  endHour: 1},
      {list: 10, startHour: 1,  endHour: 2},
      {list: 1,  startHour: 2,  endHour: 3},
      {list: 2,  startHour: 3,  endHour: 4},
      {list: 3,  startHour: 4,  endHour: 5},
      {list: 4,  startHour: 5,  endHour: 6}
    ];

    if (hornerPlan && hornerPlan.timeDistribution && hornerPlan.timeDistribution.schedule) {
      return hornerPlan.timeDistribution.schedule;
    }

    return [...mainSchedule, ...eveningSchedule, ...nightSchedule];
  }

  /**
   * Déterminer la liste Horner appropriée pour une heure donnée (hors créneaux planifiés)
   * Mappe chaque heure de 0-23 sur une liste 1-10 de façon déterministe
   */
  function getListForHour(hour) {
    // Mapping déterministe : 24h → 10 listes
    // Priorise les listes Psaumes (3) et prière pour les heures nocturnes
    const hourToList = {
      0: 9, 1: 10, 2: 1, 3: 2, 4: 3, 5: 4,
      6: 1, 7: 2, 8: 3, 9: 4, 10: 5, 11: 6,
      12: 7, 13: 8, 14: 9, 15: 10,
      16: 1, 17: 2, 18: 3, 19: 4, 20: 5, 21: 6,
      22: 7, 23: 8
    };
    return hourToList[hour] || ((hour % 10) + 1);
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
   * Couvre 24h/24 : si hors du créneau planifié, retourne la lecture
   * de la liste appropriée à cette heure (jamais null).
   */
  async function getReadingForTime(dayNumber, timeString) {
    const reading = await getReadingForDay(dayNumber);

    // 1. Recherche dans les créneaux planifiés (comportement original)
    for (const chapter of reading.chapters) {
      if (chapter.timeslots.includes(timeString)) {
        return {
          ...chapter,
          currentTimeslot: timeString,
          timeslotIndex: chapter.timeslots.indexOf(timeString)
        };
      }
    }

    // 2. Hors créneau planifié → déterminer la liste selon l'heure
    const hour = parseInt(timeString.substring(0, 2), 10);
    const targetListId = getListForHour(hour);

    // Chercher la lecture de cette liste dans les chapitres du jour
    const offScheduleChapter = reading.chapters.find(ch => ch.list === targetListId);

    if (offScheduleChapter) {
      console.warn(
        `⚠️ Horner: créneau ${timeString} hors plage planifiée → ` +
        `Liste ${targetListId} (${offScheduleChapter.book} ${offScheduleChapter.chapter})`
      );
      return {
        ...offScheduleChapter,
        currentTimeslot: timeString,
        timeslotIndex: 0,
        isOffSchedule: true  // flag indiquant un mapping hors-créneau
      };
    }

    // 3. Dernier recours : première liste disponible du jour
    if (reading.chapters.length > 0) {
      const defaultChapter = reading.chapters[0];
      console.warn(
        `⚠️ Horner: aucune liste trouvée pour heure ${hour}h → ` +
        `défaut Liste 1 (${defaultChapter.book} ${defaultChapter.chapter})`
      );
      return {
        ...defaultChapter,
        currentTimeslot: timeString,
        timeslotIndex: 0,
        isOffSchedule: true
      };
    }

    // Ne devrait jamais arriver si le plan est correctement chargé
    console.error('❌ Horner: aucune lecture disponible pour le jour', dayNumber);
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
