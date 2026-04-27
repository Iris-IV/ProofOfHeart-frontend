import { buildAlternates } from "@/lib/seo";
import CausesClient from "./CausesClient";

export function generateMetadata() {
  return {
    alternates: buildAlternates("/causes"),
  };
}

export default CausesClient;
