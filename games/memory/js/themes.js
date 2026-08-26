/**
 * Memory — card themes.
 *
 * ADDING A THEME
 * --------------
 * Copy any block below and change the four fields. That's the whole job —
 * the theme picker, the card faces and the shuffle all read from this list,
 * so nothing else needs editing.
 *
 *   id     unique lowercase key, no spaces (used to remember your last choice)
 *   name   what the button says
 *   icon   a single emoji shown on the button
 *   cards  the card faces — each one becomes a matching pair
 *
 * Every face in a theme must be DIFFERENT, or two unrelated cards would look
 * like a match. Give a theme at least 12 faces to unlock every board size;
 * with fewer, the larger sizes are simply hidden for that theme.
 *
 * Faces are plain text, so emoji, letters, numbers or short words all work —
 * "A" / "7" / "cat" are all valid faces.
 */
window.MemoryThemes = [
  {
    id: "animals",
    name: "Animals",
    icon: "🐾",
    cards: ["🐶", "🐱", "🐭", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷"],
  },
  {
    id: "food",
    name: "Food",
    icon: "🍎",
    cards: ["🍎", "🍌", "🍇", "🍓", "🍕", "🍔", "🌮", "🍩", "🍪", "🧁", "🍿", "🥕"],
  },
  {
    id: "space",
    name: "Space",
    icon: "🚀",
    cards: ["🚀", "🛸", "🪐", "🌙", "☄️", "👽", "🔭", "🌌", "⭐", "🛰️", "🌞", "🌍"],
  },
  {
    id: "ocean",
    name: "Ocean",
    icon: "🐙",
    cards: ["🐙", "🐠", "🐟", "🐬", "🐳", "🦈", "🐡", "🦀", "🦞", "🐚", "🌊", "🐢"],
  },
  {
    id: "vehicles",
    name: "Vehicles",
    icon: "🚗",
    cards: ["🚗", "🚕", "🚌", "🚑", "🚒", "🚓", "🚜", "🏎️", "🚂", "🚁", "✈️", "🚢"],
  },
  {
    id: "shapes",
    name: "Shapes",
    icon: "🔷",
    cards: ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "🔶", "🔷", "⭐", "❤️"],
  },
];
