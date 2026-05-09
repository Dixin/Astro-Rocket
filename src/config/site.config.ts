import { SITE_URL, GOOGLE_SITE_VERIFICATION, BING_SITE_VERIFICATION } from 'astro:env/server';

export interface SiteConfig {
  name: string;
  description: string;
  url: string;
  ogImage: string;
  author: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  socialLinks: string[];
  twitter?: {
    site: string;
    creator: string;
  };
  verification?: {
    google?: string;
    bing?: string;
  };
  /** Path to author photo (relative to site root, e.g. '/avatar.jpg'). Used in Person schema. */
  authorImage?: string;
  /**
   * Set to false if your blog post images already match your theme color
   * and you don't want the brand color overlay applied on top of them.
   */
  blogImageOverlay?: boolean;
  /**
   * Article features — opt-in modules for blog posts.
   * Each is OFF by default so the theme stays as light as it is today
   * for users who don't enable them.
   */
  articleFeatures?: {
    /** Table of contents shown on blog posts (auto-generated from headings) */
    toc?: {
      /** Master switch — set to true to enable site-wide */
      enabled: boolean;
      /** Minimum headings before the TOC renders (avoid TOCs on short posts) */
      minHeadings?: number;
      /** Deepest heading level to include (2 = H2 only, 3 = H2+H3, etc.) */
      maxDepth?: 2 | 3 | 4;
    };
    /** Comments at the bottom of blog posts (powered by Giscus) */
    comments?: {
      /** Master switch — set to true to enable site-wide */
      enabled: boolean;
      /** Comments provider. Currently only 'giscus' is supported. */
      provider?: 'giscus';
      /** Giscus configuration. Get values from https://giscus.app */
      giscus?: {
        repo: `${string}/${string}`;
        repoId: string;
        category: string;
        categoryId: string;
        mapping?: 'pathname' | 'url' | 'title' | 'og:title' | 'specific' | 'number';
        strict?: boolean;
        reactionsEnabled?: boolean;
        emitMetadata?: boolean;
        inputPosition?: 'top' | 'bottom';
        theme?: string;
        lang?: string;
      };
    };
  };
  /**
   * Branding configuration
   * Logo files: Replace SVGs in src/assets/branding/
   * Favicon: Replace in public/favicon.svg
   */
  branding: {
    /** Logo alt text for accessibility */
    logo: {
      alt: string;
      /** Path to logo image for structured data (e.g. '/logo.png'). Add a PNG to public/ and set this. */
      imageUrl?: string;
    };
    /** Favicon path (lives in public/) */
    favicon: {
      svg: string;
    };
    /** Theme colors for manifest and browser UI */
    colors: {
      /** Browser toolbar color (hex) */
      themeColor: string;
      /** PWA splash screen background (hex) */
      backgroundColor: string;
    };
  };
}

const siteConfig: SiteConfig = {
  name: 'Astro Rocket',
  description:
    'Astro Rocket — A production-ready Astro 6 starter with 12 beautiful themes, 57+ components, built-in i18n, dark mode and a fast, modern foundation to build anything on.',
  url: SITE_URL || 'https://astrorocket.dev',
  ogImage: '/og-default.svg',
  author: 'Hans Martens',
  email: 'hello@hansmartens.dev',
  address: {
    street: '',
    city: 'Veghel',
    state: '',
    zip: '',
    country: 'the Netherlands',
  },
  socialLinks: [
    'https://github.com/hansmartens68/Astro-Rocket',
    'https://x.com/hansmartens_dev',
    'https://www.linkedin.com',
    'https://bsky.app/profile/hansmartens-online.bsky.social',
  ],
  twitter: {
    site: 'https://x.com/hansmartens_dev',
    creator: '@hansmartens_dev',
  },
  verification: {
    google: GOOGLE_SITE_VERIFICATION,
    bing: BING_SITE_VERIFICATION,
  },
  authorImage: '/avatar.svg',
  blogImageOverlay: true,
  articleFeatures: {
    toc: {
      enabled: false,
      minHeadings: 3,
      maxDepth: 3,
    },
    comments: {
      enabled: false,
      provider: 'giscus',
      giscus: {
        repo: 'owner/repo',
        repoId: '',
        category: 'General',
        categoryId: '',
        mapping: 'pathname',
        strict: false,
        reactionsEnabled: true,
        emitMetadata: false,
        inputPosition: 'bottom',
        theme: 'preferred_color_scheme',
        lang: 'en',
      },
    },
  },
  branding: {
    logo: {
      alt: 'Astro Rocket',
      imageUrl: '/favicon.svg',
    },
    favicon: {
      svg: '/favicon.svg',
    },
    colors: {
      themeColor: '#3b82f6',
      backgroundColor: '#ffffff',
    },
  },
};

export default siteConfig;
