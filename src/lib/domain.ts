// Static directory data shared by the API, the seed script and the demo UI.
// In production these would come from SSO (people/teams) and the customer DB (clients).

export const ENVIRONMENTS = ["dev", "staging", "prod"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const TEAMS = ["billing", "frontend"] as const;
export type Team = (typeof TEAMS)[number];

export interface DemoUser {
  id: string;
  name: string;
  team: Team;
}

export const USERS: DemoUser[] = [
  { id: "aisyah", name: "Aisyah Rahman", team: "billing" },
  { id: "dimas", name: "Dimas Pratama", team: "billing" },
  { id: "budi", name: "Budi Santoso", team: "frontend" },
  { id: "citra", name: "Citra Lestari", team: "frontend" },
];

export interface DemoClient {
  id: string;
  name: string;
  plan: string;
  city: string;
}

export const CLIENTS: DemoClient[] = [
  { id: "client_A", name: "Nusantara Logistics", plan: "Enterprise", city: "Jakarta" },
  { id: "client_B", name: "Kopi Kenangan Group", plan: "Growth", city: "Bandung" },
  { id: "client_C", name: "Batik Prima", plan: "Growth", city: "Yogyakarta" },
  { id: "client_D", name: "Surya Energi", plan: "Enterprise", city: "Surabaya" },
  { id: "client_E", name: "Bali Retreats", plan: "Starter", city: "Denpasar" },
];

export const CLIENT_IDS = CLIENTS.map((c) => c.id);

export function clientName(id: string | null | undefined): string {
  if (!id) return "";
  return CLIENTS.find((c) => c.id === id)?.name ?? id;
}

/** Header names used to simulate auth. A real deployment would derive these from an SSO session. */
export const ACTOR_HEADER = "x-acting-user";
export const TEAM_HEADER = "x-acting-team";
