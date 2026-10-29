import type { ThemeConfig, IntegrationConfig } from './types'

export const themeConfig: ThemeConfig = {
  // SITE INFO ///////////////////////////////////////////////////////////////////////////////////////////
  site: {
    website: 'https://example.com/', // Site domain
    title: 'My Blog', // Site title
    author: 'Your Name', // Author name
    description: '记录技术实践、生活思考与个人项目。', // Site description
    language: 'zh_CN', // Default language
    startDate: '2026-01-01' // Site launch date (YYYY-MM-DD), used for footer running-days counter
  },

  // GENERAL SETTINGS ////////////////////////////////////////////////////////////////////////////////////
  general: {
    contentWidth: '30rem', // Content area width
    centeredLayout: true, // Use centered layout (false for left-aligned)
    themeToggle: true, // Show theme toggle button (uses system theme by default)
    postListDottedDivider: false, // Show dotted divider in post list
    footer: true // Show footer
  },

  // DATE SETTINGS ///////////////////////////////////////////////////////////////////////////////////////
  date: {
    dateFormat: 'YYYY-MM-DD', // Date format: YYYY-MM-DD, MM-DD-YYYY, DD-MM-YYYY, MONTH DAY YYYY, DAY MONTH YYYY
    dateSeparator: '.', // Date separator: . - / (except for MONTH DAY YYYY and DAY MONTH YYYY)
    dateOnRight: true // Date position in post list (true for right, false for left)
  },

  // POST SETTINGS ///////////////////////////////////////////////////////////////////////////////////////
  post: {
    readingTime: true, // Show reading time in posts
    toc: true, // Show table of contents (when there is enough page width)
    imageViewer: {
      enabled: true, // Enable image viewer
      maxScale: 4, // Maximum zoom scale (minimum is fixed at 1)
      doubleTapScale: 2 // Zoom scale for double-click / double-tap
    },
    copyCode: true, // Enable copy button in code blocks
    linkCard: true // Enable link card
  }
}

// Public settings only. Keep admin passcodes and R2 credentials in environment variables.
export const integrationConfig: IntegrationConfig = {
  profile: {
    tagline: '记录、分享与探索。',
    authorUrl: '/',
    quickLinks: [{ href: 'https://github.com/', label: 'GitHub', description: '代码与项目' }]
  },
  giscus: {
    enabled: false,
    repo: '',
    repoId: '',
    category: 'General',
    categoryId: ''
  },
  highlights: {
    mediaOrigin: 'https://media.example.com'
  }
}
