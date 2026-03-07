/**
 * SangoCast Universal Bible Converter v3.0
 * Multi-language support: English, French, German, Portuguese, Spanish
 * Handles all major Bible JSON formats
 * 
 * Supported input formats:
 * - flat_verses: {"metadata": {...}, "verses": [{"book_name": "...", "chapter": 1, "verse": 1, "text": "..."}]}
 * - flat_array: [{"book_name": "...", "chapter": 1, "verse": 1, "text": "..."}] (no metadata)
 * - nested_books: {"books": [{"name": "...", "chapters": [{"chapter": 1, "verses": [{"verse": 1, "text": "..."}]}]}]}
 * - deep_nested: {"Genesis": {"1": {"1": "text"}}}
 * - youversion: {Testaments: [{Books: [{Chapters: [{Verses: [{ID: 1, Text: "..."}]}]}]}]}
 * - scrollmapper: {resultset: {row: [...]}}
 * 
 * Output format (SangoCast Standard):
 * {version: "...", books: [{name: "...", chapters: [{chapter: 1, verses: [{verse: 1, text: "..."}]}]}]}
 */

const SangocastBibleConverter = (function() {
  'use strict';

  // =============================================================================
  // CANONICAL BOOK NAMES (66 books of the Bible)
  // =============================================================================
  const BOOK_NAMES = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
    "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
    "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah",
    "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
    "Jude", "Revelation"
  ];

  // =============================================================================
  // MULTI-LANGUAGE BOOK NAME MAPPINGS
  // =============================================================================
  
  // French book names (from samples: Louis Segond, Martin, Darby)
  const FRENCH_MAP = {
    "genèse": "Genesis", "genese": "Genesis",
    "exode": "Exodus",
    "lévitique": "Leviticus", "levitique": "Leviticus",
    "nombres": "Numbers",
    "deutéronome": "Deuteronomy", "deuteronome": "Deuteronomy",
    "josue": "Joshua", "josué": "Joshua",
    "juges": "Judges",
    "ruth": "Ruth",
    "1 samuel": "1 Samuel", "1samuel": "1 Samuel",
    "2 samuel": "2 Samuel", "2samuel": "2 Samuel",
    "1 rois": "1 Kings", "1rois": "1 Kings",
    "2 rois": "2 Kings", "2rois": "2 Kings",
    "1 chroniques": "1 Chronicles", "1chroniques": "1 Chronicles",
    "2 chroniques": "2 Chronicles", "2chroniques": "2 Chronicles",
    "esdras": "Ezra",
    "néhémie": "Nehemiah", "nehemie": "Nehemiah",
    "esther": "Esther",
    "job": "Job",
    "psaumes": "Psalms",
    "proverbes": "Proverbs",
    "ecclésiaste": "Ecclesiastes", "ecclesiaste": "Ecclesiastes",
    "cantique des cantiques": "Song of Solomon",
    "cantique": "Song of Solomon", "cantiques": "Song of Solomon",
    "ésaïe": "Isaiah", "esaïe": "Isaiah", "esaie": "Isaiah",
    "jérémie": "Jeremiah", "jeremie": "Jeremiah",
    "lamentations": "Lamentations", "lamentations de jérémias": "Lamentations",
    "ézéchiel": "Ezekiel", "ezéchiel": "Ezekiel", "ezekiel": "Ezekiel",
    "daniel": "Daniel",
    "osée": "Hosea", "osee": "Hosea",
    "joël": "Joel", "joel": "Joel",
    "amos": "Amos",
    "abdias": "Obadiah", "obadiah": "Obadiah",
    "jonas": "Jonah",
    "michée": "Micah", "michee": "Micah",
    "nahum": "Nahum",
    "habacuc": "Habakkuk",
    "sophonie": "Zephaniah",
    "aggée": "Haggai", "aggee": "Haggai",
    "zacharie": "Zechariah",
    "malachie": "Malachi",
    "matthieu": "Matthew",
    "marc": "Mark",
    "luc": "Luke",
    "jean": "John",
    "actes": "Acts",
    "romains": "Romans",
    "1 corinthiens": "1 Corinthians", "1corinthiens": "1 Corinthians",
    "2 corinthiens": "2 Corinthians", "2corinthiens": "2 Corinthians",
    "galates": "Galatians",
    "éphésiens": "Ephesians", "ephesiens": "Ephesians",
    "philippiens": "Philippians",
    "colossiens": "Colossians",
    "1 thessaloniciens": "1 Thessalonians", "1thessaloniciens": "1 Thessalonians",
    "2 thessaloniciens": "2 Thessalonians", "2thessaloniciens": "2 Thessalonians",
    "1 timothée": "1 Timothy", "1timothee": "1 Timothy", "1 timothee": "1 Timothy",
    "2 timothée": "2 Timothy", "2timothee": "2 Timothy", "2 timothee": "2 Timothy",
    "tite": "Titus",
    "philémon": "Philemon", "philemon": "Philemon",
    "hébreux": "Hebrews", "hebreux": "Hebrews",
    "jacques": "James",
    "1 pierre": "1 Peter", "1pierre": "1 Peter",
    "2 pierre": "2 Peter", "2pierre": "2 Peter",
    "1 jean": "1 John", "1jean": "1 John",
    "2 jean": "2 John", "2jean": "2 John",
    "3 jean": "3 John", "3jean": "3 John",
    "jude": "Jude",
    "apocalypse": "Revelation"
  };

  // German book names (Luther Bible uses numeric Moses for Pentateuch)
  const GERMAN_MAP = {
    "1 mose": "Genesis", "1. mose": "Genesis", "1.mose": "Genesis",
    "2 mose": "Exodus", "2. mose": "Exodus", "2.mose": "Exodus",
    "3 mose": "Leviticus", "3. mose": "Leviticus", "3.mose": "Leviticus",
    "4 mose": "Numbers", "4. mose": "Numbers", "4.mose": "Numbers",
    "5 mose": "Deuteronomy", "5. mose": "Deuteronomy", "5.mose": "Deuteronomy",
    "genesis": "Genesis",
    "exodus": "Exodus",
    "levitikus": "Leviticus",
    "numeri": "Numbers",
    "deuteronomium": "Deuteronomy",
    "josua": "Joshua",
    "richter": "Judges",
    "rut": "Ruth",
    "1 samuel": "1 Samuel", "1samuel": "1 Samuel",
    "2 samuel": "2 Samuel", "2samuel": "2 Samuel",
    "1 könige": "1 Kings", "1könige": "1 Kings", "1 koenige": "1 Kings",
    "2 könige": "2 Kings", "2könige": "2 Kings", "2 koenige": "2 Kings",
    "1 chronik": "1 Chronicles", "1chronik": "1 Chronicles",
    "2 chronik": "2 Chronicles", "2chronik": "2 Chronicles",
    "esra": "Ezra",
    "nehemia": "Nehemiah",
    "ester": "Esther",
    "hiob": "Job",
    "psalmen": "Psalms",
    "sprueche": "Proverbs", "sprüche": "Proverbs",
    "prediger": "Ecclesiastes",
    "hohelied": "Song of Solomon", "hoheslied": "Song of Solomon",
    "jesaja": "Isaiah",
    "jeremia": "Jeremiah",
    "klagelieder": "Lamentations",
    "hesekiel": "Ezekiel", "ezekiel": "Ezekiel",
    "daniel": "Daniel",
    "hosea": "Hosea",
    "joel": "Joel",
    "amos": "Amos",
    "obadja": "Obadiah",
    "jona": "Jonah",
    "micha": "Micah",
    "nahum": "Nahum",
    "habakuk": "Habakkuk",
    "zefanja": "Zephaniah",
    "haggai": "Haggai",
    "sacharja": "Zechariah",
    "maleachi": "Malachi",
    "matthäus": "Matthew", "matthaeus": "Matthew",
    "markus": "Mark",
    "lukas": "Luke",
    "johannes": "John",
    "apostelgeschichte": "Acts",
    "römer": "Romans", "roemer": "Romans",
    "1 korinther": "1 Corinthians", "1korinther": "1 Corinthians",
    "2 korinther": "2 Corinthians", "2korinther": "2 Corinthians",
    "galater": "Galatians",
    "epheser": "Ephesians",
    "philipper": "Philippians",
    "kolosser": "Colossians",
    "1 thessalonicher": "1 Thessalonians", "1thessalonicher": "1 Thessalonians",
    "2 thessalonicher": "2 Thessalonians", "2thessalonicher": "2 Thessalonians",
    "1 timotheus": "1 Timothy", "1timotheus": "1 Timothy",
    "2 timotheus": "2 Timothy", "2timotheus": "2 Timothy",
    "titus": "Titus",
    "philemon": "Philemon",
    "hebräer": "Hebrews", "hebraeer": "Hebrews",
    "jakobus": "James",
    "1 petrus": "1 Peter", "1petrus": "1 Peter",
    "2 petrus": "2 Peter", "2petrus": "2 Peter",
    "1 johannes": "1 John", "1johannes": "1 John",
    "2 johannes": "2 John", "2johannes": "2 John",
    "3 johannes": "3 John", "3johannes": "3 John",
    "judas": "Jude",
    "offenbarung": "Revelation"
  };

  // Portuguese book names (Brazilian and European Portuguese)
  const PORTUGUESE_MAP = {
    "gênesis": "Genesis", "genesis": "Genesis",
    "êxodo": "Exodus", "exodo": "Exodus",
    "levítico": "Leviticus", "levitico": "Leviticus",
    "números": "Numbers", "numeros": "Numbers",
    "deuteronômio": "Deuteronomy", "deuteronomio": "Deuteronomy",
    "josue": "Joshua", "josué": "Joshua",
    "juízes": "Judges", "juizes": "Judges",
    "rute": "Ruth", "rut": "Ruth",
    "1 samuel": "1 Samuel", "1samuel": "1 Samuel",
    "2 samuel": "2 Samuel", "2samuel": "2 Samuel",
    "1 reis": "1 Kings", "1reis": "1 Kings",
    "2 reis": "2 Kings", "2reis": "2 Kings",
    "1 crônicas": "1 Chronicles", "1cronicas": "1 Chronicles", "1 cronicas": "1 Chronicles",
    "2 crônicas": "2 Chronicles", "2cronicas": "2 Chronicles", "2 cronicas": "2 Chronicles",
    "esdras": "Ezra",
    "neemias": "Nehemiah",
    "ester": "Esther",
    "jó": "Job", "job": "Job",
    "salmos": "Psalms",
    "provérbios": "Proverbs", "proverbios": "Proverbs",
    "eclesiastes": "Ecclesiastes",
    "cântico de salomão": "Song of Solomon", "cantico de salomao": "Song of Solomon",
    "cânticos": "Song of Solomon", "canticos": "Song of Solomon",
    "isaías": "Isaiah", "isaias": "Isaiah",
    "jeremias": "Jeremiah",
    "lamentações": "Lamentations", "lamentacoes": "Lamentations",
    "ezequiel": "Ezekiel",
    "daniel": "Daniel",
    "oseias": "Hosea",
    "joel": "Joel",
    "amós": "Amos", "amos": "Amos",
    "obadias": "Obadiah",
    "jonas": "Jonah",
    "miqueias": "Micah",
    "naum": "Nahum",
    "habacuque": "Habakkuk",
    "sofonias": "Zephaniah",
    "ageu": "Haggai",
    "zacarias": "Zechariah",
    "malaquias": "Malachi",
    "mateus": "Matthew",
    "marcos": "Mark",
    "lucas": "Luke",
    "joão": "John", "joao": "John",
    "atos": "Acts",
    "romanos": "Romans",
    "1 coríntios": "1 Corinthians", "1corintios": "1 Corinthians", "1 corintios": "1 Corinthians",
    "2 coríntios": "2 Corinthians", "2corintios": "2 Corinthians", "2 corintios": "2 Corinthians",
    "gálatas": "Galatians", "galatas": "Galatians",
    "efésios": "Ephesians", "efesios": "Ephesians",
    "filipenses": "Philippians",
    "colossenses": "Colossians",
    "1 tessalonicenses": "1 Thessalonians", "1tessalonicenses": "1 Thessalonians",
    "2 tessalonicenses": "2 Thessalonians", "2tessalonicenses": "2 Thessalonians",
    "1 timóteo": "1 Timothy", "1timoteo": "1 Timothy", "1 timoteo": "1 Timothy",
    "2 timóteo": "2 Timothy", "2timoteo": "2 Timothy", "2 timoteo": "2 Timothy",
    "tito": "Titus",
    "filémon": "Philemon", "filemon": "Philemon",
    "hebreus": "Hebrews",
    "tiago": "James",
    "1 pedro": "1 Peter", "1pedro": "1 Peter",
    "2 pedro": "2 Peter", "2pedro": "2 Peter",
    "1 joão": "1 John", "1joao": "1 John", "1 joao": "1 John",
    "2 joão": "2 John", "2joao": "2 John", "2 joao": "2 John",
    "3 joão": "3 John", "3joao": "3 John", "3 joao": "3 John",
    "judas": "Jude",
    "apocalipse": "Revelation"
  };

  // Spanish book names
  const SPANISH_MAP = {
    "génesis": "Genesis", "genesis": "Genesis",
    "éxodo": "Exodus", "exodo": "Exodus",
    "levítico": "Leviticus", "levitico": "Leviticus",
    "números": "Numbers", "numeros": "Numbers",
    "deuteronomio": "Deuteronomy",
    "josue": "Joshua", "josué": "Joshua",
    "jueces": "Judges",
    "rut": "Ruth",
    "1 samuel": "1 Samuel", "1samuel": "1 Samuel",
    "2 samuel": "2 Samuel", "2samuel": "2 Samuel",
    "1 reyes": "1 Kings", "1reyes": "1 Kings",
    "2 reyes": "2 Kings", "2reyes": "2 Kings",
    "1 crónicas": "1 Chronicles", "1cronicas": "1 Chronicles", "1 cronicas": "1 Chronicles",
    "2 crónicas": "2 Chronicles", "2cronicas": "2 Chronicles", "2 cronicas": "2 Chronicles",
    "esdras": "Ezra",
    "nehemías": "Nehemiah", "nehemias": "Nehemiah",
    "ester": "Esther",
    "job": "Job",
    "salmos": "Psalms",
    "proverbios": "Proverbs",
    "eclesiastés": "Ecclesiastes", "eclesiastes": "Ecclesiastes",
    "cantares": "Song of Solomon", "cantar de los cantares": "Song of Solomon",
    "isaías": "Isaiah", "isaias": "Isaiah",
    "jeremías": "Jeremiah", "jeremias": "Jeremiah",
    "lamentaciones": "Lamentations",
    "ezequiel": "Ezekiel",
    "daniel": "Daniel",
    "oseas": "Hosea",
    "joel": "Joel",
    "amós": "Amos", "amos": "Amos",
    "abdías": "Obadiah", "abdias": "Obadiah",
    "jonás": "Jonah", "jonas": "Jonah",
    "miqueas": "Micah",
    "nahúm": "Nahum", "nahum": "Nahum",
    "habacuc": "Habakkuk",
    "sofonías": "Zephaniah", "sofonias": "Zephaniah",
    "hageo": "Haggai",
    "zacarías": "Zechariah", "zacarias": "Zechariah",
    "malaquías": "Malachi", "malaquias": "Malachi",
    "mateo": "Matthew",
    "marcos": "Mark",
    "lucas": "Luke",
    "juan": "John",
    "hechos": "Acts",
    "romanos": "Romans",
    "1 corintios": "1 Corinthians", "1corintios": "1 Corinthians",
    "2 corintios": "2 Corinthians", "2corintios": "2 Corinthians",
    "gálatas": "Galatians", "galatas": "Galatians",
    "efesios": "Ephesians",
    "filipenses": "Philippians",
    "colosenses": "Colossians",
    "1 tesalonicenses": "1 Thessalonians", "1tesalonicenses": "1 Thessalonians",
    "2 tesalonicenses": "2 Thessalonians", "2tesalonicenses": "2 Thessalonians",
    "1 timoteo": "1 Timothy", "1timoteo": "1 Timothy",
    "2 timoteo": "2 Timothy", "2timoteo": "2 Timothy",
    "tito": "Titus",
    "filemón": "Philemon", "filemon": "Philemon",
    "hebreos": "Hebrews",
    "santiago": "James",
    "1 pedro": "1 Peter", "1pedro": "1 Peter",
    "2 pedro": "2 Peter", "2pedro": "2 Peter",
    "1 juan": "1 John", "1juan": "1 John",
    "2 juan": "2 John", "2juan": "2 John",
    "3 juan": "3 John", "3juan": "3 John",
    "judas": "Jude",
    "apocalipsis": "Revelation"
  };

  // =============================================================================
  // BUILD NORMALIZER MAP
  // =============================================================================
  const BOOK_NAME_NORMALIZER = new Map();
  
  function buildNormalizer() {
    // Add English names (canonical)
    BOOK_NAMES.forEach(name => {
      const lower = name.toLowerCase();
      BOOK_NAME_NORMALIZER.set(lower, name);
      BOOK_NAME_NORMALIZER.set(lower.replace(/\s+/g, ''), name);
    });
    
    // Add all language maps
    [FRENCH_MAP, GERMAN_MAP, PORTUGUESE_MAP, SPANISH_MAP].forEach(map => {
      Object.entries(map).forEach(([key, val]) => {
        BOOK_NAME_NORMALIZER.set(key, val);
        const noAccent = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (noAccent !== key) BOOK_NAME_NORMALIZER.set(noAccent, val);
      });
    });
  }
  
  buildNormalizer();

  // =============================================================================
  // BOOK NAME NORMALIZATION
  // =============================================================================
  function normalizeBookName(raw) {
    if (raw == null) return null;
    
    // Handle numeric book references (1-66)
    if (typeof raw === 'number') {
      if (raw >= 1 && raw <= 66) return BOOK_NAMES[raw - 1];
    }
    if (/^\d+$/.test(String(raw))) {
      const num = parseInt(raw);
      if (num >= 1 && num <= 66) return BOOK_NAMES[num - 1];
    }
    
    let key = String(raw).toLowerCase().trim();
    
    // Direct lookup
    if (BOOK_NAME_NORMALIZER.has(key)) return BOOK_NAME_NORMALIZER.get(key);
    
    // Try without accents
    const noAccent = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (BOOK_NAME_NORMALIZER.has(noAccent)) return BOOK_NAME_NORMALIZER.get(noAccent);
    
    // Try without spaces
    const noSpace = key.replace(/\s+/g, '');
    if (BOOK_NAME_NORMALIZER.has(noSpace)) return BOOK_NAME_NORMALIZER.get(noSpace);
    
    // Fuzzy matching
    for (const [variant, canonical] of BOOK_NAME_NORMALIZER) {
      if (key.includes(variant) || variant.includes(key)) {
        return canonical;
      }
    }
    
    console.warn(`[BibleConverter] Unrecognized book name: "${raw}"`);
    return raw;
  }

  // =============================================================================
  // JSON REPAIR UTILITY
  // =============================================================================
  function lenientParse(jsonStr) {
    if (typeof jsonStr !== 'string') return jsonStr;
    
    let str = jsonStr.trim();
    if (str.charCodeAt(0) === 0xFEFF) str = str.slice(1);
    
    // Remove trailing commas
    str = str.replace(/,\s*([}\]])/g, '$1');
    
    // Balance brackets
    const stack = [];
    let fixed = '';
    for (let char of str) {
      fixed += char;
      if (char === '{' || char === '[') stack.push(char);
      else if (char === '}' || char === ']') {
        if (stack.length) stack.pop();
      }
    }
    while (stack.length) {
      fixed += stack.pop() === '{' ? '}' : ']';
    }
    
    try {
      return JSON.parse(fixed);
    } catch (e) {
      console.error('[BibleConverter] JSON parse failed:', e.message);
      throw e;
    }
  }

  // =============================================================================
  // FORMAT DETECTION
  // =============================================================================
  function detectFormat(data) {
    if (!data || typeof data !== 'object') return 'unknown';
    
    // Check for flat array at root (WEB style)
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      if (first && (first.book_name || first.book || first.chapter || first.verse || first.text)) {
        return 'flat_array';
      }
    }
    
    // Check for flat verses with metadata (ASV, KJV, Luther, Segond style)
    if (data.verses && Array.isArray(data.verses)) {
      const first = data.verses[0];
      if (first && (first.book_name || first.book || first.chapter !== undefined)) {
        return 'flat_verses';
      }
    }
    
    // Check for nested books (Daby/Darby style)
    if (data.books && Array.isArray(data.books)) {
      const firstBook = data.books[0];
      if (firstBook && firstBook.chapters && Array.isArray(firstBook.chapters)) {
        return 'nested_books';
      }
    }
    
    // Check for YouVersion style
    if (data.Testaments && Array.isArray(data.Testaments)) {
      return 'youversion';
    }
    
    // Check for deep nested object (Douay-Rheims style)
    if (!Array.isArray(data) && typeof data === 'object') {
      const keys = Object.keys(data);
      const bookKeys = keys.filter(k => {
        if (['metadata', 'verses', 'name', 'version', 'abbreviation', 'language'].includes(k.toLowerCase())) return false;
        const norm = normalizeBookName(k);
        return norm && BOOK_NAMES.includes(norm);
      });
      if (bookKeys.length >= 5) return 'deep_nested';
    }
    
    // Check for Scrollmapper
    if (data.resultset && Array.isArray(data.resultset.row)) {
      return 'scrollmapper';
    }
    
    return 'unknown';
  }

  // =============================================================================
  // CONVERTERS
  // =============================================================================
  
  function sortBooks(books) {
    return books.sort((a, b) => {
      const idxA = BOOK_NAMES.indexOf(a.name);
      const idxB = BOOK_NAMES.indexOf(b.name);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }

  // Convert flat verses with metadata wrapper
  function convertFlatVerses(data, versionCode) {
    console.log('[BibleConverter] Converting flat verses format...');
    
    const result = {
      version: versionCode || (data.metadata && data.metadata.shortname) || 
               (data.metadata && data.metadata.name) || 'UNKNOWN',
      books: []
    };
    
    const bookMap = new Map();
    
    for (const v of data.verses || []) {
      const bookRaw = v.book_name || v.book || v.book_id || v.bk || '';
      const bookName = normalizeBookName(bookRaw);
      if (!bookName) continue;
      
      const chapterNum = parseInt(v.chapter || v.c || v.chap) || 1;
      const verseNum = parseInt(v.verse || v.v || v.ver) || 1;
      const text = v.text || v.t || v.content || v.body || "";
      
      if (!bookMap.has(bookName)) {
        bookMap.set(bookName, { name: bookName, chapters: new Map() });
      }
      
      const book = bookMap.get(bookName);
      if (!book.chapters.has(chapterNum)) {
        book.chapters.set(chapterNum, []);
      }
      
      book.chapters.get(chapterNum).push({ verse: verseNum, text: String(text) });
    }
    
    for (const [name, book] of bookMap) {
      const sortedChapters = Array.from(book.chapters.keys()).sort((a, b) => a - b);
      const chapters = [];
      
      for (const chNum of sortedChapters) {
        const verses = book.chapters.get(chNum);
        verses.sort((a, b) => a.verse - b.verse);
        chapters.push({ chapter: chNum, verses });
      }
      
      result.books.push({ name, chapters });
    }
    
    result.books = sortBooks(result.books);
    return result;
  }

  // Convert flat array at root
  function convertFlatArray(data, versionCode) {
    console.log('[BibleConverter] Converting flat array format...');
    return convertFlatVerses({ verses: data }, versionCode);
  }

  // Convert nested books (Daby/Darby style)
  function convertNestedBooks(data, versionCode) {
    console.log('[BibleConverter] Converting nested books format...');
    
    const result = {
      version: versionCode || data.version || 'UNKNOWN',
      books: []
    };
    
    for (const bookData of data.books || []) {
      const bookName = normalizeBookName(bookData.name);
      if (!bookName) continue;
      
      const book = { name: bookName, chapters: [] };
      
      for (const chData of bookData.chapters || []) {
        const chapterNum = parseInt(chData.chapter || chData.ch) || book.chapters.length + 1;
        const chapter = { chapter: chapterNum, verses: [] };
        
        for (const vData of chData.verses || []) {
          const verseNum = parseInt(vData.verse || vData.v || vData.number) || chapter.verses.length + 1;
          const text = vData.text || vData.t || vData.content || "";
          chapter.verses.push({ verse: verseNum, text: String(text) });
        }
        
        book.chapters.push(chapter);
      }
      
      result.books.push(book);
    }
    
    result.books = sortBooks(result.books);
    return result;
  }

  // Convert deep nested object (Douay-Rheims)
  function convertDeepNested(data, versionCode) {
    console.log('[BibleConverter] Converting deep nested format...');
    
    const result = {
      version: versionCode || 'UNKNOWN',
      books: []
    };
    
    for (const [bookKey, chaptersData] of Object.entries(data)) {
      if (['metadata', 'name', 'version'].includes(bookKey.toLowerCase())) continue;
      
      const bookName = normalizeBookName(bookKey);
      if (!bookName || !BOOK_NAMES.includes(bookName)) {
        console.warn(`[BibleConverter] Skipping unrecognized book key: ${bookKey}`);
        continue;
      }
      
      const book = { name: bookName, chapters: [] };
      
      if (typeof chaptersData === 'object' && chaptersData !== null) {
        const chapterKeys = Object.keys(chaptersData).sort((a, b) => parseInt(a) - parseInt(b));
        
        for (const chKey of chapterKeys) {
          const chNum = parseInt(chKey) || book.chapters.length + 1;
          const versesData = chaptersData[chKey];
          const chapter = { chapter: chNum, verses: [] };
          
          if (typeof versesData === 'object' && versesData !== null) {
            const verseKeys = Object.keys(versesData).sort((a, b) => parseInt(a) - parseInt(b));
            
            for (const vKey of verseKeys) {
              const verseNum = parseInt(vKey) || chapter.verses.length + 1;
              const text = versesData[vKey];
              chapter.verses.push({ verse: verseNum, text: String(text || "") });
            }
          }
          
          book.chapters.push(chapter);
        }
      }
      
      result.books.push(book);
    }
    
    result.books = sortBooks(result.books);
    return result;
  }

  // Convert YouVersion format
  function convertYouVersion(data, versionCode) {
    console.log('[BibleConverter] Converting YouVersion format...');
    
    const result = {
      version: versionCode || data.Abbreviation || 'UNKNOWN',
      books: []
    };
    
    let bookIndex = 0;
    
    for (const testament of data.Testaments || []) {
      for (const bookData of testament.Books || []) {
        if (bookIndex >= BOOK_NAMES.length) break;
        
        const bookName = BOOK_NAMES[bookIndex++];
        const book = { name: bookName, chapters: [] };
        
        for (const chData of bookData.Chapters || []) {
          const chapterNum = parseInt(chData.ID) || book.chapters.length + 1;
          const chapter = { chapter: chapterNum, verses: [] };
          
          for (const vData of chData.Verses || []) {
            const verseNum = parseInt(vData.ID) || chapter.verses.length + 1;
            const text = vData.Text || "";
            chapter.verses.push({ verse: verseNum, text: String(text) });
          }
          
          book.chapters.push(chapter);
        }
        
        result.books.push(book);
      }
    }
    
    return result;
  }

  // Convert Scrollmapper
  function convertScrollmapper(data, versionCode) {
    console.log('[BibleConverter] Converting Scrollmapper format...');
    return convertFlatVerses({ verses: data.resultset.row }, versionCode);
  }

  // =============================================================================
  // MAIN CONVERT FUNCTION
  // =============================================================================
  async function convert(input, versionCode) {
    try {
      let data = typeof input === 'string' ? lenientParse(input) : input;
      
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid input: expected object or JSON string');
      }
      
      const format = detectFormat(data);
      console.log(`[BibleConverter] Detected format: ${format}`);
      
      let result;
      switch (format) {
        case 'flat_verses':
          result = convertFlatVerses(data, versionCode);
          break;
        case 'flat_array':
          result = convertFlatArray(data, versionCode);
          break;
        case 'nested_books':
          result = convertNestedBooks(data, versionCode);
          break;
        case 'deep_nested':
          result = convertDeepNested(data, versionCode);
          break;
        case 'youversion':
          result = convertYouVersion(data, versionCode);
          break;
        case 'scrollmapper':
          result = convertScrollmapper(data, versionCode);
          break;
        default:
          throw new Error(`Unsupported format: "${format}"`);
      }
      
      if (!result.books || !Array.isArray(result.books) || result.books.length === 0) {
        throw new Error('Conversion failed: no books found');
      }
      
      console.log(`[BibleConverter] Conversion successful: ${result.books.length} books`);
      return result;
      
    } catch (err) {
      console.error('[BibleConverter] Conversion error:', err.message);
      throw err;
    }
  }

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================
  
  async function convertFile(file, versionCode) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = lenientParse(e.target.result);
          resolve(convert(data, versionCode));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  async function convertFromURL(url, versionCode) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = lenientParse(text);
    return convert(data, versionCode);
  }

  function saveToCache(bible, versionCode) {
    try {
      localStorage.setItem(`sangocast_bible_${versionCode.toLowerCase()}`, JSON.stringify(bible));
      return true;
    } catch (e) {
      console.warn('[BibleConverter] Cache save failed:', e);
      return false;
    }
  }

  function loadFromCache(versionCode) {
    try {
      const json = localStorage.getItem(`sangocast_bible_${versionCode.toLowerCase()}`);
      return json ? JSON.parse(json) : null;
    } catch (e) {
      return null;
    }
  }

  // =============================================================================
  // AUTO-INTEGRATION
  // =============================================================================
  if (typeof SangocastBibleLookup !== 'undefined') {
    console.log('[BibleConverter v3.0] Auto-integrating with BibleLookup...');
    
    const originalLoad = SangocastBibleLookup.loadBible;
    
    SangocastBibleLookup.loadBible = async function(version) {
      const cached = loadFromCache(version);
      if (cached) {
        console.log(`[BibleConverter] Loaded ${version} from cache`);
        return cached;
      }
      
      const paths = SangocastBibleLookup.getAvailableBibles();
      const path = paths[version.toUpperCase()];
      
      if (!path) throw new Error(`Bible ${version} not registered`);
      
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const text = await res.text();
      const raw = lenientParse(text);
      
      console.log(`[BibleConverter] Auto-converting ${version}...`);
      const converted = await convert(raw, version);
      saveToCache(converted, version);
      
      return converted;
    };
  }

  // =============================================================================
  // PUBLIC API
  // =============================================================================
  return {
    convert,
    convertFile,
    convertFromURL,
    detectFormat,
    normalizeBookName,
    saveToCache,
    loadFromCache,
    BOOK_NAMES,
    LANGUAGE_MAPS: {
      FRENCH_MAP,
      GERMAN_MAP,
      PORTUGUESE_MAP,
      SPANISH_MAP
    }
  };
})();