/**
 * Cycle 3 timeline — 161 cards in order, then the presidents.
 *
 * The timeline is sung start to finish, so the thing worth drilling is the
 * SEQUENCE, not the cards in isolation: knowing that "Egyptians" is card 5
 * is useless, knowing what follows it is the whole skill. So each card asks
 * what comes next, and the very first asks how the song starts.
 *
 * Sections here are the twenty-three timeline weeks, seven cards each --
 * 23 x 7 = 161, which is how the proof sheet brackets them -- plus section
 * 24, the presidents, which are learnt four at a time.
 *
 * These are event names in chronological order. The order is history's, not
 * anyone's invention, and the names are the plain names of the things.
 */
(function () {
  "use strict";

  const ORDER = [
    "Age of Ancient Empires", "Creation and the Fall", "The Flood and the Tower of Babel",
    "Mesopotamia and Sumer", "Egyptians", "Indus River Valley Civilization",
    "Minoans and Mycenaeans",

    "Seven Wonders of the Ancient World", "Patriarchs of Israel", "Hittites and Canaanites",
    "Kush", "Assyrians", "Babylonians", "China’s Shang Dynasty",

    "Hinduism in India", "Phoenicians and the Alphabet", "Olmecs of Mesoamerica",
    "Israelite Exodus and Desert Wandering", "Israelite Conquest and Judges", "Greek Dark Ages",
    "Israel’s United Kingdom",

    "Early Native Americans", "Israel Divides into Two Kingdoms", "Homer and Hesiod",
    "Rome Founded by Romulus and Remus", "Israel Falls to Assyria", "Assyria Falls to Babylon",
    "Lao-Tzu, Confucius, Buddha",

    "Judah Falls to Babylon, Temple Destroyed", "Babylon Falls to Persia",
    "Jews Return and Rebuild the Temple", "Roman Republic", "Golden Age of Greece",
    "Peloponnesian Wars", "Persia Falls to Alexander the Great",

    "India’s Mauryan Empire", "Mayans of Mesoamerica", "Punic Wars", "Rome Conquers Greece",
    "Roman Dictator Julius Caesar", "Caesar Augustus and the Pax Romana", "John the Baptist",

    "Jesus the Messiah", "Pentecost and the Early Church", "Persecution Spreads the Gospel",
    "Herod’s Temple Destroyed by Titus", "Diocletian Divides the Roman Empire",
    "Constantine Legalizes Christianity", "India’s Gupta Dynasty",

    "Council of Nicea", "Augustine of Hippo", "Jerome Completes the Vulgate",
    "Visigoths Sack Rome", "The Middle Ages", "Council of Chalcedon",
    "Western Roman Empire Falls to Barbarians",

    "Byzantine Emperor Justinian", "Benedict and Monasticism", "Muhammad Founds Islam",
    "Zanj and Early Ghana in Africa", "Franks Defeat Muslims at the Battle of Tours",
    "Golden Age of Islam", "Vikings Raid and Trade",

    "Japan’s Heian Period", "Charlemagne Crowned Emperor of Europe", "Alfred the Great of England",
    "Erik the Red and Leif Eriksson, Norse Explorers", "Vladimir I of Kiev",
    "Byzantine Emperor Basil II", "East-West Schism of the Church",

    "Norman Conquest and Feudalism in Europe", "The Crusades", "Zimbabwe and Early Mali in Africa",
    "Aztecs of Mesoamerica", "Francis of Assisi and Thomas Aquinas", "Japan’s Shoguns",
    "Incas of South America",

    "Genghis Khan Rules the Mongols", "England’s Magna Carta", "Ottoman Empire",
    "Marco Polo’s Journey to China", "The Hundred Years’ War and Black Death", "The Renaissance",
    "China’s Ming Dynasty",

    "Age of Exploration", "Prince Henry Founds School of Navigation", "Slave Trade in Africa",
    "Gutenberg’s Printing Press", "Songhai in Africa", "Czar Ivan the Great of Russia",
    "The Spanish Inquisition",

    "Columbus Sails to the Caribbean", "Age of Absolute Monarchs", "Protestant Reformation",
    "Spanish Conquistadors in the Americas", "Calvin’s Institutes of the Christian Religion",
    "Council of Trent", "Baroque Period of the Arts",

    "Japan’s Isolation", "Jamestown and Plymouth Colony Founded", "Age of Enlightenment",
    "Hudson’s Bay Company", "First Great Awakening", "Classical Period of the Arts",
    "The Seven Years’ War",

    "Age of Industry", "James Cook Sails to Australia and Antarctica",
    "American Revolution and General George Washington",
    "Madison’s Constitution and the Bill of Rights", "French Revolution",
    "Second Great Awakening", "Louisiana Purchase and Lewis and Clark Expedition",

    "Napoleon Crowned Emperor of France", "Liberation of South America", "The War of 1812",
    "The Missouri Compromise", "Immigrants Flock to America", "The Monroe Doctrine",
    "Romantic Period of the Arts",

    "Cherokee Trail of Tears", "U.S. Westward Expansion", "Marx Publishes The Communist Manifesto",
    "The Compromise of 1850 and the Dred Scott Decision", "U.S. Restores Trade with Japan",
    "British Queen Victoria’s Rule Over India", "Darwin Publishes The Origin of Species",

    "Lincoln’s War Between the States", "Reconstruction of the Southern States",
    "Dominion of Canada", "Otto von Bismarck Unifies Germany", "Boer Wars in Africa",
    "The Spanish-American War", "The Progressive Era",

    "Australia Becomes a Commonwealth", "Mexican Revolution", "World War I and President Wilson",
    "Lenin and the Bolshevik Revolution in Russia", "U.S. Evangelist Billy Graham",
    "Modern Period of the Arts", "The Great Depression and the New Deal",

    "World War II and President Franklin D. Roosevelt",
    "Stalin of the USSR and the Katyn Massacre", "The United Nations Formed", "The Cold War",
    "Gandhi and India’s Independence", "Jewish State Established",
    "Mao and Communist Victory in China",

    "North Atlantic Treaty Organization", "The Korean War",
    "Martin Luther King, Jr. and the Civil Rights Movement",
    "Jim and Elisabeth Elliot, Missionaries to Ecuador", "The Antarctic Treaty",
    "The Vietnam War", "U.S. Astronauts Walk on the Moon",

    "Age of Information and Globalization", "Watergate, President Nixon Resigns",
    "Fall of Communism in Eastern Europe", "European Union Formed",
    "Apartheid Abolished in South Africa", "September 11, 2001", "Rising Tide of Freedom",
  ];

  const pairs = {};
  ORDER.forEach(function (name, i) {
    const week = Math.floor(i / 7) + 1;
    if (!pairs[week]) pairs[week] = [];
    pairs[week].push(i === 0
      ? ["Start the timeline", name]
      : ["After “" + ORDER[i - 1] + "”", name]);
  });
  Object.keys(pairs).forEach(function (week) {
    window.CC_ADD("timeline", Number(week), "Timeline week " + week, pairs[week]);
  });

  /* 24: the presidents, four to a card, in office order. */
  window.CC_ADD("timeline", 24, "U.S. Presidents", [
    ["Presidents 1–4", "Washington, Adams, Jefferson, Madison"],
    ["Presidents 5–8", "Monroe, Adams, Jackson, Van Buren"],
    ["Presidents 9–12", "Harrison, Tyler, Polk, Taylor"],
    ["Presidents 13–16", "Fillmore, Pierce, Buchanan, Lincoln"],
    ["Presidents 17–20", "Johnson, Grant, Hayes, Garfield"],
    ["Presidents 21–24", "Arthur, Cleveland, Harrison, Cleveland"],
    ["Presidents 25–28", "McKinley, Roosevelt, Taft, Wilson"],
    ["Presidents 29–32", "Harding, Coolidge, Hoover, Roosevelt"],
    ["Presidents 33–36", "Truman, Eisenhower, Kennedy, Johnson"],
    ["Presidents 37–40", "Nixon, Ford, Carter, Reagan"],
    ["Presidents 41–44", "Bush, Clinton, Bush, Obama"],
    ["Presidents 45 on", "Trump"],
  ]);

  window.CC_CYCLE3.timelineOrder = ORDER;
})();
