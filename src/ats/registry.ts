import type { AtsAdapter } from "./AtsAdapter";
import { AcmeAdapter } from "./acme.adapter";
import { GlobexAdapter } from "./globex.adapter";
import { TsentAdapter } from "./tsenta.adapter";
import { DroprAdapter } from "./dropr.adapter";

export const ATS_REGISTRY: AtsAdapter[] = [
  new AcmeAdapter(),
  new GlobexAdapter(),
  new TsentAdapter(),
  new DroprAdapter(),

];
