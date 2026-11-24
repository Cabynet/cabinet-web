export type Density = "comfortable" | "compact" | "visual"

export const densityOptions: { value: Density; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
  // Gallery cards: the preview fills the card and only the title sits below it. List view treats it as comfortable.
  { value: "visual", label: "Visual" },
]

export const isDensity = (value: unknown): value is Density =>
  densityOptions.some((option) => option.value === value)

export interface DisplayPreferences {
  density: Density
  showTitle: boolean
  showDescription: boolean
  showImage: boolean
  showWebsite: boolean
  showFolder: boolean
  showDate: boolean
  /** Clicking a link card opens the original page in a new tab instead of the preview. */
  openLinksDirectly: boolean
}

export const defaultDisplayPreferences: DisplayPreferences = {
  density: "comfortable",
  showTitle: true,
  showDescription: true,
  showImage: true,
  showWebsite: true,
  showFolder: true,
  showDate: true,
  openLinksDirectly: false,
}

/** Only Compact lets people pick which details show; the other densities have a fixed layout. */
export const hasVisibleDetails = (density: Density) => density === "compact"

/** The preferences cards actually render with: visibility choices apply in Compact only, and are kept for when it's chosen again. */
export const effectiveDisplayPreferences = (preferences: DisplayPreferences): DisplayPreferences =>
  hasVisibleDetails(preferences.density) ? preferences : { ...defaultDisplayPreferences, density: preferences.density, openLinksDirectly: preferences.openLinksDirectly }

/** Phones start in Compact (two columns) so more of the library fits on screen; a saved choice always wins. */
export const deviceDefaultDisplayPreferences = (): DisplayPreferences =>
  typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches
    ? { ...defaultDisplayPreferences, density: "compact" }
    : defaultDisplayPreferences
