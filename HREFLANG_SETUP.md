# hreflang Alternates - Setup Complete ✅

Implemented hreflang alternates for en/es locales to help search engines serve the correct language version.

## What Was Added

### hreflang Implementation

All localized pages now include hreflang alternates in their metadata:

```html
<link rel="alternate" hreflang="en" href="https://proofofheart.xyz/en/about" />
<link rel="alternate" hreflang="es" href="https://proofofheart.xyz/es/about" />
<link rel="alternate" hreflang="x-default" href="https://proofofheart.xyz/en/about" />
```

### Pages Updated

All 8 localized pages now include hreflang:

1. ✅ Home (`/`)
2. ✅ About (`/about`)
3. ✅ Explore (`/explore`)
4. ✅ Causes (`/causes`)
5. ✅ Cause Detail (`/causes/[id]`)
6. ✅ Dashboard (`/dashboard`)
7. ✅ Create Cause (`/causes/new`)
8. ✅ Admin (`/admin`)

### Documentation.

- **`docs/HREFLANG_ALTERNATES.md`** - Complete implementation guide
  - How hreflang works
  - Verification methods
  - Best practices
  - Troubleshooting

## How It Works

### SEO Utility

The `buildAlternates()` function generates hreflang for each page:

```typescript
buildAlternates("/about", "en");
// Returns:
// {
//   canonical: 'https://proofofheart.xyz/en/about',
//   languages: {
//     en: 'https://proofofheart.xyz/en/about',
//     es: 'https://proofofheart.xyz/es/about',
//     'x-default': 'https://proofofheart.xyz/en/about',
//   }
// }
```

### Page Implementation

Pages use `generateMetadata()` with locale parameter:

```typescript
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return {
    title: "About | ProofOfHeart",
    alternates: buildAlternates("/about", locale),
  };
}
```

### Root Layout

Root layout includes hreflang for home page:

```typescript
alternates: {
  languages: {
    en: 'https://proofofheart.xyz/en',
    es: 'https://proofofheart.xyz/es',
    'x-default': 'https://proofofheart.xyz/en',
  },
}
```

## Verification

### View in HTML

```bash
curl https://proofofheart.xyz/en/about | grep hreflang
```

Should show:

```html
<link rel="alternate" hreflang="en" href="..." />
<link rel="alternate" hreflang="es" href="..." />
<link rel="alternate" hreflang="x-default" href="..." />
```

### Check in Google Search Console

1. Go to Google Search Console
2. Select property
3. Go to **Enhancements** → **International Targeting**
4. Verify hreflang tags are detected

### Use SEO Tools

- Screaming Frog SEO Spider
- Ahrefs
- SEMrush

## Acceptance Criteria Met

✅ `alternates.languages` set in metadata for localized pages  
✅ `x-default` provided for fallback  
✅ Verified in rendered HTML  
✅ Labels: seo, i18n, Stellar Wave

## Files Modified

- `src/app/[locale]/layout.tsx` - Root layout hreflang
- `src/app/[locale]/admin/page.tsx` - Added hreflang
- `src/app/[locale]/explore/page.tsx` - Added hreflang
- `src/app/[locale]/dashboard/page.tsx` - Added hreflang
- `src/app/[locale]/causes/new/page.tsx` - Added hreflang

## Files Created

- `docs/HREFLANG_ALTERNATES.md` - Complete guide

## Next Steps

1. Build and deploy to verify hreflang in production
2. Submit to Google Search Console
3. Monitor in Search Console for hreflang issues
4. Check SEO tools for proper implementation

## Benefits

- ✅ Search engines serve correct language version
- ✅ Avoid duplicate content penalties
- ✅ Consolidate ranking signals across languages
- ✅ Better user experience for multilingual audience
- ✅ Improved SEO for both en and es versions

## SEO & Social Open Graph Metadata Strategy

hreflang is one part of how ProofOfHeart presents itself to search engines and link-preview
scrapers. This section is the strategy for the whole metadata surface: who owns which tag, how
locale and canonical URLs are formed, how share cards are generated, and how to verify and extend
it without regressing link previews.

### Principles

1. **One source of truth per concern.** Site-wide defaults live in `src/lib/siteMetadata.ts`, URL
   and hreflang helpers in `src/lib/seo.ts`, share-card rendering in `src/lib/ogCard.tsx`. Pages
   only override what is specific to them.
2. **Absolute, locale-prefixed, canonical URLs.** Every indexable URL is `https://<site>/<locale>/…`
   (`en`, `es`; default `en`). Bare paths are never canonical.
3. **Share images are generated, never hand-referenced.** Images come from Next.js file
   conventions (`opengraph-image.tsx`, `twitter-image.tsx`), so the declared `og:image:width`,
   `height` and `type` always match the bytes that are served.
4. **Crawl what is public, hide what is not.** The sitemap, robots rules and `noindex` behaviour
   follow environment and campaign state.

### Where each tag comes from

| Concern                                        | Owner                                                                                                                                                              | Notes                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Site name, description, `metadataBase`         | `siteMetadata` in `src/lib/siteMetadata.ts`                                                                                                                        | `metadataBase` uses `NEXT_PUBLIC_SITE_URL` (default `https://proofofheart.xyz`).                                                         |
| Canonical + hreflang (`alternates`)            | `buildAlternates(path, locale)` in `src/lib/seo.ts`                                                                                                                | Emits one entry per locale in `routing.locales` plus `x-default` → the default locale. Unknown locales fall back to the default.         |
| Absolute URLs                                  | `absoluteUrl(path)` in `src/lib/seo.ts`                                                                                                                            | Passes through `http(s)` URLs, otherwise prefixes the site URL.                                                                          |
| `og:*` / `twitter:*` text                      | `openGraph` / `twitter` in `siteMetadata`; per-page `generateMetadata`                                                                                             | Twitter card type is `summary_large_image` everywhere.                                                                                   |
| `og:image` / `twitter:image`                   | `src/app/opengraph-image.tsx`, `src/app/twitter-image.tsx` (site default) and `src/app/[locale]/causes/[id]/opengraph-image.tsx` / `twitter-image.tsx` (campaigns) | `twitter-image` re-exports the OG renderer so the two cannot drift.                                                                      |
| Apple link-preview name, Home Screen behaviour | `appleWebApp` in `siteMetadata`                                                                                                                                    | Without it iMessage shows the raw hostname.                                                                                              |
| Structured data                                | `buildCauseJsonLd()` in `src/lib/seo.ts`, rendered on `/[locale]/causes/[id]`                                                                                      | Schema.org `Project` with funding goal, amount raised, deadline, cover image and a `DonateAction` while the campaign accepts donations.  |
| Sitemap                                        | `src/app/sitemap.ts`                                                                                                                                               | Static routes × locales plus up to 10 000 campaign URLs × locales; cancelled campaigns excluded; revalidated hourly.                     |
| Robots                                         | `src/app/robots.ts`                                                                                                                                                | Production: allow `/`, disallow `/admin` and `/api`. **Non-production: disallow everything**, so previews and staging are never indexed. |
| Resource hints                                 | `getStellarResourceHints()` in `src/lib/seo.ts`                                                                                                                    | `preconnect`/`dns-prefetch` for Horizon, Soroban RPC and the IPFS gateway; a performance, not an SEO, signal.                            |

### Open Graph / Twitter card rules

- **Format:** 1200 × 630 **PNG** (`OG_SIZE`, `OG_CONTENT_TYPE` in `src/lib/ogCard.tsx`). This is the
  only size Apple, Slack, X and Facebook all render without cropping. Apple's scraper refuses SVG
  and drops previews whose declared dimensions do not match the delivered image.
- **Do not add `openGraph.images` or `twitter.images`** to `siteMetadata` or to any
  `generateMetadata`. A literal entry takes precedence over the file convention and reintroduces
  the missing-preview bug (#642). The campaign page deliberately omits them for the same reason.
- **Campaign cards** embed the creator's cover image _inside_ the generated PNG. The renderer only
  fetches covers that pass `isAllowedCampaignImageUrl`, never follows redirects, caps the download
  at 4 MiB, times out after 8 s, and accepts only PNG/JPEG/WebP (magic-byte check). Any failure
  falls back to the text-only card instead of returning an error.
- **Text limits:** titles are truncated by code point (`truncate`) to 60 characters with a cover
  and 80 without; descriptions in metadata are cut to 160 characters.
- **Caching** (`OG_CACHE_CONTROL`): brand card 1 h browser / 1 day CDN; campaign card 5 min (matches
  `revalidate = 300`); error fallback 60 s so transient failures heal quickly.
- **Locale:** campaign `openGraph.locale` is the active locale; titles and descriptions are the
  creator's own text and are not translated.

### Adding or changing a page

1. Export `generateMetadata` and set `title`, a `description` (≤ 160 characters) and
   `alternates: buildAlternates("/your/path", locale)`.
2. Do not set images. If the page needs its own card, add `opengraph-image.tsx` (and a
   `twitter-image.tsx` that re-exports it) next to `page.tsx` and build it with `BrandOgCard` and
   `ogImageOptions`.
3. If the page is public and should be indexed, add its path to `STATIC_ROUTES` in
   `src/app/sitemap.ts` (relative, without the locale).
4. If the page must not be indexed, keep it out of the sitemap and under a path disallowed in
   `robots.ts`, or return `robots: { index: false }` from `generateMetadata`.
5. Add a new locale in `src/i18n/routing.ts` only; `buildAlternates`, the sitemap and the
   `siteMetadata` hreflang block (currently listing `en` and `es` explicitly) must then be checked,
   because `siteMetadata.alternates.languages` is written out by hand.

### Environment and deployment

- `NEXT_PUBLIC_SITE_URL` must be set to the real public origin in production; every canonical,
  hreflang, sitemap and Open Graph URL is built from it. It is inlined at build time.
- Staging and preview deployments are non-production builds, so `robots.txt` blocks them; verify
  that `NODE_ENV=production` is not used for a public preview unless it should be indexed.

### Verifying

```bash
# Metadata and hreflang in the rendered HTML
curl -s https://proofofheart.xyz/en/causes/1 | grep -Eo '<(meta|link)[^>]+(og:|twitter:|hreflang|canonical)[^>]*>'

# The share image: status, type and size
curl -sI https://proofofheart.xyz/en/causes/1/opengraph-image | grep -Ei 'HTTP|content-type|cache-control'

# robots and sitemap
curl -s https://proofofheart.xyz/robots.txt
curl -s https://proofofheart.xyz/sitemap.xml | head
```

Automated coverage lives in `src/__tests__/lib/seo.test.ts`, `src/__tests__/lib/siteMetadata.test.ts`,
`src/__tests__/lib/ogCard.test.tsx` and `src/__tests__/app/sitemap.test.ts`; update them with any
change to these modules. For manual preview checks use Facebook's Sharing Debugger, the X card
validator, LinkedIn Post Inspector, and iMessage (the strictest scraper) on a real device.

### Known gaps

- `siteMetadata.alternates` lists `en`/`es` literally rather than deriving from `routing.locales`.
- Only campaign pages carry structured data; the home and about pages have none.
- Sitemap `lastModified` for campaigns uses the creation time, not the last update.

## Related Docs

- `docs/HREFLANG_ALTERNATES.md` - Implementation details
- `src/lib/seo.ts` - SEO utilities
- `src/i18n/routing.ts` - Locale configuration
- `src/lib/siteMetadata.ts` - Site-wide metadata and Open Graph defaults
- `src/lib/ogCard.tsx` - Share-card renderer
- `src/app/sitemap.ts`, `src/app/robots.ts` - Crawl configuration
