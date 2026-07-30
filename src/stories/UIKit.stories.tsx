import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Input,
  TabPanel,
  Tabs,
  Textarea,
  type BadgeTone,
  type ButtonVariant,
} from "../components/ui";

const meta: Meta = {
  title: "UI/Design System",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The shared primitives every screen builds from. Tokens live in `src/app/globals.css`; see `docs/DESIGN_SYSTEM.md`.",
      },
    },
  },
};

export default meta;

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger", "success"];
const TONES: BadgeTone[] = ["neutral", "brand", "accent", "success", "warning", "danger", "info"];

export const Buttons: StoryObj = {
  render: () => (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <Button isLoading loadingLabel="Posting…">
          Post Update
        </Button>
        <Button disabled>Disabled</Button>
      </div>
    </div>
  ),
};

export const Badges: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-2 items-center">
      {TONES.map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
};

export const Cards: StoryObj = {
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Standard surface</CardTitle>
          <Badge tone="success">Funded</Badge>
        </CardHeader>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          One border, one radius, one shadow — in both themes.
        </p>
      </Card>
      <Card interactive>
        <CardHeader>
          <CardTitle>Interactive</CardTitle>
        </CardHeader>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Hover lift — only for cards that are themselves a link or button.
        </p>
      </Card>
    </div>
  ),
};

export const Fields: StoryObj = {
  render: () => (
    <div className="space-y-4 max-w-md">
      <Input label="Signer address" placeholder="G…" hint="Stellar public key of a co-signer." />
      <Input label="Funding goal" defaultValue="-5" error="Goal must be greater than zero." />
      <Textarea label="Update" rows={4} placeholder="Share progress…" hint="Markdown supported." />
    </div>
  ),
};

const DEMO_TABS = [
  { id: "updates" as const, label: "Updates", count: 3 },
  { id: "comments" as const, label: "Comments / Q&A" },
];

function TabsDemo() {
  const [active, setActive] = useState<"updates" | "comments">("updates");

  return (
    <div className="max-w-xl space-y-4">
      <Tabs
        tabs={DEMO_TABS}
        activeId={active}
        onChange={setActive}
        label="Campaign sections"
        idPrefix="story"
      />
      <TabPanel tabId="updates" idPrefix="story" active={active === "updates"}>
        <Card>Updates panel — arrow keys move between tabs.</Card>
      </TabPanel>
      <TabPanel tabId="comments" idPrefix="story" active={active === "comments"}>
        <Card>Comments panel — the inactive panel is unmounted, not hidden.</Card>
      </TabPanel>
    </div>
  );
}

export const TabsStory: StoryObj = {
  name: "Tabs",
  render: () => <TabsDemo />,
};
