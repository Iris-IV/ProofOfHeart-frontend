import type { Preview } from "@storybook/react";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import "../src/app/globals.css";
import enMessages from "../messages/en.json";

const preview: Preview = {
  decorators: [
    (Story) => (
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Story />
      </NextIntlClientProvider>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;
