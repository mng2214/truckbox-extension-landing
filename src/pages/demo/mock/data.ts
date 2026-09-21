export type DemoLoad = {
  id: string;

  ageMinutes: number;
  origin: string;
  destination: string;

  deadheadMiles: number;
  tripMiles: number;
  pickupFrom: string;
  pickupTo: string;
  equipment: string;
  lengthFt: number;
  weightLbs: number;
  capacity: "Full" | "Partial";
  company: string;

  contactEmail?: string;
  contactPhone?: string;
  mcNumber: string;
  referenceId: string;
  commodity: string;
  rate?: number;

  marketRate: number;
  marketLow: number;
  marketHigh: number;

  creditStars: number;
  creditReviews: number;
  daysToPay: number;
  comments?: string;
};

const BROKERS = [
  { company: "Northline Freight Systems", mc: "MC#482917", domain: "northlinefs.com", stars: 4, reviews: 128, dtp: 27 },
  { company: "Blue Ridge Logistics Group", mc: "MC#733104", domain: "blueridgelg.com", stars: 3, reviews: 94, dtp: 34 },
  { company: "Cascade Transport Partners", mc: "MC#215880", domain: "cascadetp.com", stars: 5, reviews: 212, dtp: 21 },
  { company: "Harborlight Freight Co", mc: "MC#604471", domain: "harborlightfc.com", stars: 2, reviews: 61, dtp: 44 },
  { company: "Prairie Star Logistics", mc: "MC#391265", domain: "prairiestarlog.com", stars: 4, reviews: 173, dtp: 30 },
  { company: "Ironwood Carriers Exchange", mc: "MC#118093", domain: "ironwoodcx.com", stars: 3, reviews: 87, dtp: 38 },
];

type Seed = {
  origin: string;
  destination: string;
  dh: number;
  miles: number;
  equipment: string;
  lengthFt: number;
  weightLbs: number;
  capacity: "Full" | "Partial";
  rate?: number;
  commodity: string;
  broker: number;

  contact: "email" | "phone";
  comments?: string;
};

const SEEDS: Seed[] = [
  { origin: "Reeseville, WI", destination: "Nanticoke, PA", dh: 141, miles: 843, equipment: "V", lengthFt: 53, weightLbs: 8148, capacity: "Full", rate: 2600, commodity: "Palletized goods", broker: 0, contact: "email", comments: "Drop trailer available at pickup. Appointment 08:00-14:00, no weekend delivery." },
  { origin: "Chicago, IL", destination: "Oakdale, MN", dh: 40, miles: 396, equipment: "V", lengthFt: 53, weightLbs: 35000, capacity: "Full", rate: 1450, commodity: "Canned food", broker: 2, contact: "phone" },
  { origin: "Des Plaines, IL", destination: "N Charleston, SC", dh: 25, miles: 933, equipment: "VA", lengthFt: 53, weightLbs: 2500, capacity: "Partial", rate: 700, commodity: "Machine parts", broker: 1, contact: "phone" },
  { origin: "Milwaukee, WI", destination: "Lexington, NC", dh: 95, miles: 826, equipment: "V", lengthFt: 53, weightLbs: 43950, capacity: "Full", commodity: "Paper rolls", broker: 4, contact: "email", comments: "Tarps not required. Live load, 2 hours free." },
  { origin: "Michigan City, IN", destination: "Eau Claire, WI", dh: 97, miles: 381, equipment: "VR", lengthFt: 53, weightLbs: 5000, capacity: "Full", rate: 1100, commodity: "Frozen bakery", broker: 3, contact: "phone" },
  { origin: "E Troy, WI", destination: "Hunt Valley, MD", dh: 64, miles: 811, equipment: "V", lengthFt: 53, weightLbs: 12119, capacity: "Full", commodity: "Retail freight", broker: 0, contact: "phone" },
  { origin: "Rochelle, IL", destination: "Columbia, SC", dh: 66, miles: 879, equipment: "V", lengthFt: 53, weightLbs: 39976, capacity: "Full", rate: 2900, commodity: "Bottled water", broker: 2, contact: "email" },
  { origin: "Burlington, WI", destination: "Manassas, VA", dh: 55, miles: 795, equipment: "V", lengthFt: 53, weightLbs: 37282, capacity: "Full", commodity: "Building materials", broker: 5, contact: "phone" },
  { origin: "Channahon, IL", destination: "Woodland, PA", dh: 47, miles: 554, equipment: "V", lengthFt: 53, weightLbs: 17655, capacity: "Full", commodity: "Plastic resin", broker: 1, contact: "email" },
  { origin: "Ottawa, IL", destination: "Winona, MN", dh: 67, miles: 307, equipment: "V", lengthFt: 53, weightLbs: 42714, capacity: "Full", rate: 1200, commodity: "Grain products", broker: 4, contact: "phone" },
  { origin: "Ottawa, IL", destination: "Winona, MN", dh: 67, miles: 307, equipment: "V", lengthFt: 53, weightLbs: 42714, capacity: "Full", rate: 1250, commodity: "Grain products", broker: 4, contact: "phone" },
  { origin: "Bolingbrook, IL", destination: "Ft Mill, SC", dh: 36, miles: 798, equipment: "V", lengthFt: 53, weightLbs: 41420, capacity: "Full", commodity: "Packaged consumer goods", broker: 0, contact: "email" },
  { origin: "Chicago, IL", destination: "Jamaica, NY", dh: 40, miles: 807, equipment: "V", lengthFt: 53, weightLbs: 11700, capacity: "Partial", rate: 2600, commodity: "Printed material", broker: 3, contact: "email" },
  { origin: "Normal, IL", destination: "Easley, SC", dh: 130, miles: 711, equipment: "V", lengthFt: 53, weightLbs: 25000, capacity: "Full", commodity: "Auto parts", broker: 5, contact: "email" },
  { origin: "Normal, IL", destination: "Mebane, NC", dh: 130, miles: 762, equipment: "V", lengthFt: 53, weightLbs: 25000, capacity: "Full", commodity: "Auto parts", broker: 5, contact: "email" },
  { origin: "Mt Prospect, IL", destination: "Madison, WI", dh: 22, miles: 128, equipment: "V", lengthFt: 53, weightLbs: 35000, capacity: "Full", rate: 1000, commodity: "Beverages", broker: 2, contact: "email", comments: "Driver assist unload. Pallet exchange." },
  { origin: "University Pk, IL", destination: "Windsor, WI", dh: 66, miles: 181, equipment: "V", lengthFt: 53, weightLbs: 41000, capacity: "Full", commodity: "Industrial supplies", broker: 1, contact: "email" },
  { origin: "Joliet, IL", destination: "Wausau, WI", dh: 42, miles: 289, equipment: "V", lengthFt: 53, weightLbs: 21000, capacity: "Full", rate: 1200, commodity: "Steel coils", broker: 3, contact: "phone" },
  { origin: "Franksville, WI", destination: "Franksville, WI", dh: 76, miles: 24, equipment: "VM", lengthFt: 53, weightLbs: 21000, capacity: "Full", commodity: "Local shuttle", broker: 4, contact: "email" },
  { origin: "Peru, IL", destination: "Olyphant, PA", dh: 90, miles: 778, equipment: "V", lengthFt: 53, weightLbs: 25000, capacity: "Full", rate: 2933, commodity: "Packaging film", broker: 0, contact: "phone" },
];

const AGES = [20, 34, 38, 41, 44, 45, 46, 50, 51, 57, 62, 68, 74, 79, 86, 94, 103, 121, 140, 168];

function hashUnit(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function phoneFor(seed: string): string {
  const area = [312, 773, 630, 414, 262, 847][Math.floor(hashUnit(seed) * 6)];
  const mid = 200 + Math.floor(hashUnit(seed + "m") * 700);
  const last = 1000 + Math.floor(hashUnit(seed + "l") * 8000);
  return `(${area}) ${mid}-${last}`;
}

function emailFor(seed: Seed): string {
  const broker = BROKERS[seed.broker];
  const names = ["dispatch", "loads", "ops", "carriers", "booking"];
  return `${names[Math.floor(hashUnit(seed.origin + seed.destination) * names.length)]}@${broker.domain}`;
}

export const DEMO_LOADS: DemoLoad[] = SEEDS.map((seed, i) => {
  const broker = BROKERS[seed.broker];
  const unit = hashUnit(seed.origin + seed.destination + seed.equipment);

  const market = Math.round(((seed.rate ?? seed.miles * 2.6) * (1.06 + unit * 0.22)) / 5) * 5;
  return {
    id: `L${1000 + i}`,
    ageMinutes: AGES[i % AGES.length],
    origin: seed.origin,
    destination: seed.destination,
    deadheadMiles: seed.dh,
    tripMiles: seed.miles,
    pickupFrom: "9/20",
    pickupTo: i % 5 === 0 ? "9/22" : "9/21",
    equipment: seed.equipment,
    lengthFt: seed.lengthFt,
    weightLbs: seed.weightLbs,
    capacity: seed.capacity,
    company: broker.company,
    contactEmail: seed.contact === "email" ? emailFor(seed) : undefined,
    contactPhone: seed.contact === "phone" ? phoneFor(seed.origin + seed.destination) : undefined,
    mcNumber: broker.mc,
    referenceId: String(31000000 + Math.floor(unit * 900000)),
    commodity: seed.commodity,
    rate: seed.rate,
    marketRate: market,
    marketLow: Math.round((market * 0.94) / 5) * 5,
    marketHigh: Math.round((market * 1.07) / 5) * 5,
    creditStars: broker.stars,
    creditReviews: broker.reviews,
    daysToPay: broker.dtp,
    comments: seed.comments,
  };
});

export function ratePerMile(load: DemoLoad): number | null {
  return load.rate ? load.rate / load.tripMiles : null;
}

export function formatAge(minutes: number): string {
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
}

export function laneHistory(load: DemoLoad, days = 14) {
  const base = load.marketRate;
  const unit = hashUnit(load.origin + load.destination);
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const wave = Math.sin((i + unit * 6) / 2.4) * 0.05;
    const drift = ((days - i) / days) * 0.04;
    const avg = Math.round((base * (0.95 + wave + drift)) / 5) * 5;
    out.push({
      day: day.toISOString().slice(0, 10),
      avgPrice: avg,
      minPrice: Math.round((avg * 0.93) / 5) * 5,
      maxPrice: Math.round((avg * 1.08) / 5) * 5,
      lastPrice: avg,
      cnt: 3 + Math.floor(hashUnit(load.id + i) * 9),
    });
  }
  return out;
}

export function laneIntraday(load: DemoLoad) {
  const out = [];
  for (let hour = 6; hour <= 18; hour += 2) {
    const unit = hashUnit(load.id + hour);
    out.push({
      at: `${String(hour).padStart(2, "0")}:00`,
      price: Math.round((load.marketRate * (0.9 + unit * 0.16)) / 5) * 5,
    });
  }
  return out;
}

export const DEMO_USER = {
  email: "demo@truckbox.app",
  name: "Demo Dispatcher",
  mcNumber: "MC#000000",
  company: "Demo Dispatch LLC",
};

export const DEMO_TEMPLATES = [
  {
    id: 1,
    name: "Rate request",

    active: true,
    mailboxId: 1,
    subject: "{origin} → {destination}, {equipment} {length}ft — available?",
    body:
      "Hi,\n\nI have a truck near {origin} for your {origin} → {destination} load ({miles} mi, {weight} lbs).\n" +
      "Is it still available, and what's the rate?\n\nThanks,\n{name}\n{company} · {mc}",
  },
  {
    id: 2,
    name: "Short and fast",
    active: false,
    mailboxId: 2,
    subject: "{origin} → {destination} — still open?",
    body: "Hi! Is the {origin} → {destination} load still open? Truck is empty nearby.\n\n{name}\n{mc}",
  },
  {
    id: 4,
    name: "Reefer desk",
    active: false,
    mailboxId: 3,
    subject: "Reefer {origin} → {destination} — temp and rate?",
    body:
      "Hi,\n\nReefer truck open near {origin}. What temp does your {origin} → {destination} run at, " +
      "and what's it paying?\n\n{name}\n{company} · {mc}",
  },
  {
    id: 3,
    name: "Lane inquiry",
    active: false,
    mailboxId: 1,
    subject: "Who covers {origin} → {destination}?",
    body:
      "Hi,\n\nWe run {origin} → {destination} weekly. Who handles this lane for you, and how often does it post?\n\n" +
      "{name}\n{company}",
  },
];

export const DEMO_MAILBOXES = [
  {
    id: 1,
    address: "demo@truckbox.app",
    email: "demo@truckbox.app",
    provider: "GOOGLE",
    status: "ACTIVE",
    loginMailbox: true,
  },
  {
    id: 2,
    address: "night.desk@truckbox.app",
    email: "night.desk@truckbox.app",
    provider: "MICROSOFT",
    status: "ACTIVE",
    loginMailbox: false,
  },
  {
    id: 3,
    address: "reefer.desk@truckbox.app",
    email: "reefer.desk@truckbox.app",
    provider: "GOOGLE",
    status: "ACTIVE",
    loginMailbox: false,
  },
];

export function seedSavedLoads() {
  const pick = [DEMO_LOADS[0], DEMO_LOADS[6], DEMO_LOADS[12]];
  const notes = [
    "Broker asked for a 22nd pickup — call Mike before 4pm.",
    "They run this lane every Monday. Ask for the whole week next time.",
    "Said 2,800 is possible with a drop trailer.",
  ];
  return pick.map((load, i) => {
    const savedAt = new Date(Date.now() - (i + 1) * 36 * 3600 * 1000);
    return {
      id: 9000 + i,
      platform: "DAT",
      externalKey: `DAT:${load.referenceId}`,
      origin: load.origin,
      destination: load.destination,
      equipment: load.equipment,
      lengthFt: load.lengthFt,
      weightLbs: load.weightLbs,
      pickupDate: `${load.pickupFrom} - ${load.pickupTo}`,
      tripMiles: load.tripMiles,
      offerPrice: load.rate ?? null,
      brokerName: load.company,
      brokerEmail: load.contactEmail ?? null,
      brokerPhone: load.contactPhone ?? null,
      brokerMc: load.mcNumber,
      referenceId: load.referenceId,
      note: notes[i],
      createdAt: savedAt.toISOString(),
      currentAvgPrice: load.marketRate,
      priceDelta: load.rate ? load.marketRate - load.rate : null,
    };
  });
}
