import { buildAlternates } from "@/lib/seo";
import HomeClient from "./HomeClient";

export function generateMetadata() {
  return {
    alternates: buildAlternates(""),
  };
}

export default HomeClient;
