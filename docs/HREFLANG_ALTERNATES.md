# hreflang Alternates for Localized Pages

Implements hreflang alternates for en/es locales to help search engines serve the correct language version.

## Overview

hreflang is an HTML attribute that tells search engines about alternate language versions of a page. This helps:

- **Search engines** understand which version to serve to users in different locales
- **Users** see content in their preferred language
- **SEO** by consolidating ranking signals across language versions
- **Avoid duplicate content** penalties

## Implementation

### What Was Added

All localized pages now include hreflang alternates in their metadata:

```html
<link rel="alternate" hreflang="en" href="https://proofofheart.xyz/en/about" />
<link rel="alternate" hreflang="es" href="https://proofofheart.xyz/es/about" />
<link rel="alternate" hreflang="x-default" href="https://proofofheart.xyz/en/about" />
```

### Pages with hreflang

All localized pages now include hreflang alternates:

| Page         | Path           | Alternates        |
| ------------ | -------------- | ----------------- |
| Home         | `/`            | en, es, x-default |
| About        | `/about`       | en, es, x-default |
| Explore      | `/explore`     | en, es, x-default |
| Causes       | `/causes`      | en, es, x-default |
| Cause Detail | `/causes/[id]` | en, es, x-default |
| Dashboard    | `/dashboard`   | en, es, x-default |
| Create Cause | `/causes/new`  | en, es, x-default |
| Admin        | `/admin`       | en, es, x-default |

## How It Works

### SEO Utility Function

The `buildAlternates()` function in `src/lib/seo.ts` generates hreflang alternates:

```typescript
export function buildAlternates(path: string, locale: string = routing.defaultLocale) {
  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = `${SITE_URL}/${locale}${path}`;
  }
  languages["x-default"] = `${SITE_URL}/${routing.defaultLocale}${path}`;
  return {
    canonical: `${SITE_URL}/${locale}${path}`,
    languages,
  };
}
```

### Usage in Pages

Pages use `generateMetadata()` with the locale parameter:

```typescript
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;

  return {
    title: "About | ProofOfHeart",
    description: "...",
    alternates: buildAlternates("/about", locale),
  };
}
```

### Root Layout

The root layout includes hreflang for the home page:

```typescript
alternates: {
  languages: {
    en: `${SITE_URL}/en`,
    es: `${SITE_URL}/es`,
    "x-default": `${SITE_URL}/en`,
  },
}
```

## Verification

### In HTML

View page source to verify hreflang tags are present:

```bash
# View rendered HTML
curl https://proofofheart.xyz/en/about | grep hreflang
```

Expected output:

```html
<link rel="alternate" hreflang="en" href="https://proofofheart.xyz/en/about" />
<link rel="alternate" hreflang="es" href="https://proofofheart.xyz/es/about" />
<link rel="alternate" hreflang="x-default" href="https://proofofheart.xyz/en/about" />
```

### In Next.js Metadata

Check the metadata object in page components:

```typescript
// Should include alternates with languages
const metadata = {
  title: "...",
  alternates: {
    canonical: "https://proofofheart.xyz/en/about",
    languages: {
      en: "https://proofofheart.xyz/en/about",
      es: "https://proofofheart.xyz/es/about",
      "x-default": "https://proofofheart.xyz/en/about",
    },
  },
};
```

### Using Google Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property
3. Go to **Enhancements** → **International Targeting**
4. Verify hreflang tags are detected

### Using SEO Tools

- [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/) - Crawl and verify hreflang
- [Ahrefs](https://ahrefs.com/) - Check hreflang implementation
- [SEMrush](https://www.semrush.com/) - Audit hreflang tags

## hreflang Best Practices

### ✅ Do

- Include hreflang on all localized pages
- Use correct language codes (en, es, not eng, spa)
- Include x-default for fallback
- Use absolute URLs (not relative)
- Ensure bidirectional links (if en links to es, es should link to en)
- Keep hreflang consistent across all versions

### ❌ Don't

- Use incorrect language codes
- Mix relative and absolute URLs
- Forget x-default
- Create one-way hreflang links
- Use hreflang for non-localized content
- Include hreflang on pages without alternates

## Language Codes

| Language | Code      | Used |
| -------- | --------- | ---- |
| English  | en        | ✅   |
| Spanish  | es        | ✅   |
| Default  | x-default | ✅   |

## Troubleshooting

### hreflang not appearing in HTML

1. Check page uses `generateMetadata()` with locale parameter
2. Verify `buildAlternates()` is called with correct path and locale
3. Ensure page is in `src/app/[locale]/` directory
4. Check Next.js build output

### Incorrect URLs in hreflang

1. Verify `NEXT_PUBLIC_SITE_URL` environment variable is set
2. Check path parameter is correct (e.g., `/about` not `about`)
3. Ensure locale parameter is passed to `buildAlternates()`

### x-default not set

1. Verify `buildAlternates()` includes x-default
2. Check it points to default locale (en)
3. Ensure it's included in all pages

## Files Modified

- `src/app/[locale]/layout.tsx` - Root layout with hreflang
- `src/app/[locale]/page.tsx` - Home page (already had hreflang)
- `src/app/[locale]/about/page.tsx` - About page (already had hreflang)
- `src/app/[locale]/explore/page.tsx` - Explore page (added hreflang)
- `src/app/[locale]/causes/page.tsx` - Causes page (already had hreflang)
- `src/app/[locale]/causes/[id]/page.tsx` - Cause detail (already had hreflang)
- `src/app/[locale]/dashboard/page.tsx` - Dashboard (added hreflang)
- `src/app/[locale]/causes/new/page.tsx` - New cause (added hreflang)
- `src/app/[locale]/admin/page.tsx` - Admin (added hreflang)

## Related Docs

- [SEO Guide](./SEO.md) - General SEO best practices
- [i18n Routing](../src/i18n/routing.ts) - Locale configuration
- [Next.js Metadata](https://nextjs.org/docs/app/building-your-application/optimizing/metadata) - Metadata API

## References

- [Google: Localized versions of pages](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Moz: hreflang](https://moz.com/learn/seo/hreflang)
- [Next.js: alternates](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#alternates)
