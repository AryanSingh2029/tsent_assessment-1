export function renderTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}
