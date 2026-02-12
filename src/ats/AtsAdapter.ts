import type { Page } from "playwright";
import type { ApplicationResult, UserProfile } from "../types";

export interface AtsAdapter {
  readonly id: string;
  canHandle(page: Page): Promise<boolean>;
  apply(page: Page, profile: UserProfile): Promise<ApplicationResult>;
}
