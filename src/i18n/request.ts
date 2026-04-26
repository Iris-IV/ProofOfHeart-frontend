import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ requestLocale }) => {
  // Use a fallback locale if the value is unknown
  // In a real app we might validate it
  const locale = (await requestLocale) || "en";

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
