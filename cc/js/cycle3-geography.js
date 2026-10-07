/**
 * Cycle 3 geography — the United States.
 *
 * Capitals are two cards' worth of knowledge in one line on the sheet
 * ("Augusta, ME"), and the useful direction is state to capital: nobody is
 * ever asked "what state is Augusta in." So each is asked that way round,
 * and the whole section can still be recited in order from the labels.
 *
 * Every name here is a plain geographic fact.
 */
(function () {
  "use strict";

  const add = window.CC_ADD;

  /**
   * Every state and capital, in the sheet's order, for the map. Kept as data
   * rather than read back out of the card text, so the map can never drift
   * from what the cards say.
   */
  window.CC_CYCLE3.capitals = [];

  /** Capitals: ask for the capital, answer gives it with the state. */
  const capitals = function (section, rows) {
    rows.forEach(function (row) {
      window.CC_CYCLE3.capitals.push({ section: section, capital: row[0], state: row[1], abbr: row[2] });
    });
    add("geography", section, "States and Capitals", rows.map(function (row) {
      return ["Capital of " + row[1] + "?", row[0] + ", " + row[2]];
    }));
  };

  capitals(1, [
    ["Augusta", "Maine", "ME"], ["Concord", "New Hampshire", "NH"], ["Boston", "Massachusetts", "MA"],
    ["Providence", "Rhode Island", "RI"], ["Hartford", "Connecticut", "CT"],
  ]);
  capitals(2, [
    ["Montpelier", "Vermont", "VT"], ["Albany", "New York", "NY"], ["Trenton", "New Jersey", "NJ"],
    ["Harrisburg", "Pennsylvania", "PA"], ["Dover", "Delaware", "DE"],
  ]);
  capitals(3, [
    ["Annapolis", "Maryland", "MD"], ["Richmond", "Virginia", "VA"], ["Charleston", "West Virginia", "WV"],
    ["Raleigh", "North Carolina", "NC"], ["Columbia", "South Carolina", "SC"],
  ]);
  add("geography", 3, "States and Capitals", [
    ["Capital of the United States?", "Washington, DC"],
  ]);
  window.CC_CYCLE3.capitals.push({ section: 3, capital: "Washington", state: "District of Columbia", abbr: "DC" });
  capitals(4, [
    ["Atlanta", "Georgia", "GA"], ["Tallahassee", "Florida", "FL"], ["Montgomery", "Alabama", "AL"],
    ["Jackson", "Mississippi", "MS"], ["Baton Rouge", "Louisiana", "LA"],
  ]);
  capitals(5, [
    ["Lansing", "Michigan", "MI"], ["Columbus", "Ohio", "OH"], ["Indianapolis", "Indiana", "IN"],
    ["Frankfort", "Kentucky", "KY"], ["Nashville", "Tennessee", "TN"],
  ]);
  capitals(6, [
    ["Madison", "Wisconsin", "WI"], ["Springfield", "Illinois", "IL"], ["Des Moines", "Iowa", "IA"],
    ["Jefferson City", "Missouri", "MO"], ["Little Rock", "Arkansas", "AR"],
  ]);
  capitals(7, [
    ["St. Paul", "Minnesota", "MN"], ["Bismarck", "North Dakota", "ND"], ["Pierre", "South Dakota", "SD"],
    ["Cheyenne", "Wyoming", "WY"], ["Lincoln", "Nebraska", "NE"],
  ]);
  capitals(8, [
    ["Topeka", "Kansas", "KS"], ["Oklahoma City", "Oklahoma", "OK"], ["Austin", "Texas", "TX"],
    ["Denver", "Colorado", "CO"], ["Santa Fe", "New Mexico", "NM"],
  ]);
  capitals(9, [
    ["Salt Lake City", "Utah", "UT"], ["Phoenix", "Arizona", "AZ"], ["Carson City", "Nevada", "NV"],
    ["Sacramento", "California", "CA"], ["Honolulu", "Hawaii", "HI"],
  ]);
  capitals(10, [
    ["Helena", "Montana", "MT"], ["Boise", "Idaho", "ID"], ["Olympia", "Washington", "WA"],
    ["Salem", "Oregon", "OR"], ["Juneau", "Alaska", "AK"],
  ]);

  /** Features: the section is the question, the list is the answer. */
  const features = function (section, label, items) {
    add("geography", section, label, [["Name the " + label.toLowerCase() + ".", items.join(", ")]]);
  };

  features(11, "Northern Appalachian Mountains",
    ["White Mountains", "Green Mountains", "Adirondack Mountains", "Allegheny Mountains"]);
  features(12, "Southern Appalachian Mountains",
    ["The Great Valley", "Blue Ridge Mountains", "Great Smoky Mountains", "Cumberland Mountains",
     "Mt. Mitchell"]);
  features(13, "Western Mountains",
    ["Rocky Mountains", "Pikes Peak", "Mt. Elbert", "Sierra Nevadas", "Mt. Whitney"]);
  features(14, "Northwest Mountains",
    ["Cascade Mountains", "Mt. Rainier", "Mt. St. Helens", "Denali"]);
  features(15, "Great Lakes", ["Huron", "Ontario", "Michigan", "Erie", "Superior"]);
  features(16, "Bays",
    ["Chesapeake Bay", "Hudson Bay", "San Francisco Bay", "Puget Sound", "Pamlico Sound"]);
  features(17, "Rivers (East)",
    ["St. Lawrence River", "Ohio River", "Mississippi River", "Missouri River", "Arkansas River"]);
  features(18, "Rivers (West)",
    ["Colorado River", "Red River", "Rio Grande River", "Columbia River", "Great Salt Lake"]);
  features(19, "Trails",
    ["Cumberland Road", "Santa Fe Trail", "Mormon Trail", "Gila Trail", "Old Spanish Trail",
     "California Trail", "Oregon Trail"]);
  features(20, "Canals",
    ["Erie Canal", "Pennsylvania Canal", "Chesapeake and Ohio Canal", "Ohio and Erie Canal",
     "Miami and Erie Canal"]);
  features(21, "Native American Regions",
    ["Eastern Woodlands", "Plains", "Plateau", "Northwest Coast", "California", "Great Basin",
     "Southwest"]);
  features(22, "Deserts",
    ["Mojave Desert", "Sonoran Desert", "Colorado Desert", "Painted Desert", "Great Salt Lake Desert"]);
  features(23, "Prominent Features",
    ["Grand Canyon", "Black Hills", "Ozark Highlands", "Okefenokee Swamp", "Olympic rainforests",
     "Niagara Falls"]);
  features(24, "More Prominent Features",
    ["Mississippi River Delta", "Mammoth Cave", "San Andreas Fault", "Gulf of Mexico", "Death Valley"]);

  // The Great Lakes spell HOMES, which is the whole reason they are taught in
  // that order rather than by size or position.
  window.CC_CYCLE3.cards.forEach(function (card) {
    if (card.strand === "geography" && card.label === "Great Lakes") {
      card.note = "Their first letters spell HOMES.";
    }
    // Section 8 of the proof sheet prints "Sante Fe, NM". That is a misprint:
    // Classical Conversations' own map on page 244 labels it Santa Fe, which
    // is the city's name. Said here so a parent checking against the sheet
    // knows the difference is deliberate.
    if (card.strand === "geography" && card.a === "Santa Fe, NM") {
      card.note = "The proof sheet prints “Sante Fe” — a misprint. CC’s own map says Santa Fe.";
    }
  });
})();
