# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Anti-slop rules (apply to every screen, component, and file you write here)

AI slop is generic filler that reads as machine-generated. Everything below is
binding for this project:

1. **No decorative emoji in UI chrome.** Icons come from `@expo/vector-icons`
   (Material Community). Emoji are allowed only as user-chosen *content* (e.g.
   the avatar picker), never as section markers, feature icons, or decoration.
2. **Copy is plain and specific.** No marketing filler ("supercharge",
   "unleash", "seamless", "blazing"), no em-dash-heavy breathless phrasing, no
   exclamation marks in UI text. Say what the thing does in one short sentence.
3. **No invented data or fake stats.** Empty states show guidance, not
   placeholder numbers dressed up as real values.
4. **Restraint in effects.** One accent color, no gradient banners, no glow, no
   long shadow stacks, no bouncy gratuitous animation. The intro animation is
   the only flourish and it is short.
5. **Density over padding walls.** Prefer tight, information-dense layouts with
   consistent spacing from the theme (4/8/12/16/24) over airy padded cards with
   three lines of centered text.
6. **Honest states.** Loading, empty, and error states are explicit. No
   skeleton-but-actually-fake data, no silent catches that leave the UI blank.
7. **Naming is literal.** Components and files describe what they contain
   (`WaterScreen`, `EntryConfirmScreen`), not vibes (`Hero`, `Blaze`, `Pulse`).
