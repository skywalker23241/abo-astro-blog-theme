// Date format types
export type DateFormat =
  | 'YYYY-MM-DD'
  | 'MM-DD-YYYY'
  | 'DD-MM-YYYY'
  | 'MONTH DAY YYYY'
  | 'DAY MONTH YYYY'

// Site info configuration type
export interface SiteInfo {
  website: string
  title: string
  author: string
  description: string
  language: string
  startDate: string
}

// General settings configuration type
export interface GeneralSettings {
  contentWidth: string
  centeredLayout: boolean
  themeToggle: boolean
  postListDottedDivider: boolean
  footer: boolean
}

// Date settings configuration type
export interface DateSettings {
  dateFormat: DateFormat
  dateSeparator: string
  dateOnRight: boolean
}

// Image viewer settings configuration type
export interface ImageViewerSettings {
  enabled: boolean
  maxScale: number
  doubleTapScale: number
}

// Post settings configuration type
export interface PostSettings {
  readingTime: boolean
  toc: boolean
  imageViewer: ImageViewerSettings
  copyCode: boolean
  linkCard: boolean
}

// Theme configuration type
export interface ThemeConfig {
  site: SiteInfo
  general: GeneralSettings
  date: DateSettings
  post: PostSettings
}

export interface IntegrationConfig {
  profile: {
    tagline: string
    authorUrl: string
    quickLinks: { href: string; label: string; description: string }[]
  }
  giscus: {
    enabled: boolean
    repo: string
    repoId: string
    category: string
    categoryId: string
  }
  highlights: { mediaOrigin: string }
}
