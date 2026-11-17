// Reviewed percentage-of-a-whole questions from the daily bank. Use stable IDs,
// not wording or hidden answers: rates and ratios can legitimately exceed 100%.
// Onboarding and future question snapshots can also declare an explicit max.
const percentageShares = new Set([
  "aebe46a2-a2ed-43a2-bd90-1ce4a57ca150", // Renewable electricity
  "6597b4e9-424f-4d6c-a2b9-4e569265de6d", // China's share of world GDP
  "ec174a81-6e73-47bd-a702-6c32fbbfb135", // Solar electricity
  "1e15c9c3-bb3d-4ce2-b9f9-11e1771ad95b", // Dutch land below sea level
  "c76389bc-23e4-4475-969c-2d605abe4587", // Vegetarian adults
  "a7678325-444d-46b3-9843-12557494f22b", // US share of world GDP
  "33ebe4f4-400a-47b0-87a3-27739a723e85", // Calories from rice
  "1f57b72c-2f54-40bb-9152-5d3239349138", // Myopia prevalence
  "72ae7693-7798-48e1-9265-8941cd874ceb", // Women in parliament
  "bcf42117-9ef4-4756-826e-dafd392f2ae4", // Smoking prevalence
  "53ac3dae-3cc4-4c3f-8598-f4c247461953", // Unemployment
  "c58405a5-d624-4f8c-9867-e8c6e600e07e", // Atmospheric nitrogen
  "bf6193f7-e025-4c82-9951-886cd1f205f4", // Bot traffic
  "42e9ce1c-61b4-4786-8efc-05f223b25849", // EV share of car sales
  "147d2cbf-961f-43e7-91e7-5652fe615271", // Lactose malabsorption
  "4dfa49cd-fbbe-4914-a410-a57a43c12c3e", // Cement emissions
  "a1b5ddc6-979c-4e00-8a42-75fcaa85ceda", // Nuclear electricity
]);

export function questionMaximum(question: { id: string; unit?: string; max?: number }) {
  if (question.unit === "%" && percentageShares.has(question.id))
    return Math.min(question.max ?? 100, 100);
  return question.max;
}
