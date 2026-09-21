import { DEMO_LOADS, formatAge, ratePerMile, type DemoLoad } from "../mock/data";

export type BoardOptions = {
  rows?: number;

  interactive?: boolean;

  autoplaySeconds?: number;
  onRowOpen?: (load: DemoLoad) => void;
};

export type BoardHandle = {
  el: HTMLElement;
  open: (id: string) => void;
  close: () => void;
  destroy: () => void;
};

const money = (n: number) => "$" + n.toLocaleString("en-US");
const usdCents = (n: number) => "$" + n.toFixed(2);

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function tag(name: string, className?: string): HTMLElement {
  const node = document.createElement(name);
  if (className) node.className = className;
  return node;
}

const COLUMNS = [
  { key: "age", label: "Age", sortable: true },
  { key: "rate", label: "Rate", sortable: true },
  { key: "trip", label: "Trip", sortable: true },
  { key: "origin", label: "Origin" },
  { key: "dho", label: "DH-O" },
  { key: "destination", label: "Destination" },
  { key: "dhd", label: "DH-D" },
  { key: "pickup", label: "Pick Up" },
  { key: "eq", label: "EQ" },
  { key: "length", label: "Length" },
  { key: "weight", label: "Weight" },
  { key: "capacity", label: "Capacity" },
  { key: "company", label: "Company" },
  { key: "contact", label: "Contact" },
];

export function mountBoard(host: HTMLElement, options: BoardOptions = {}): BoardHandle {
  const limit = options.rows ?? DEMO_LOADS.length;
  let loads = DEMO_LOADS.slice(0, limit);
  let sort: { key: string; dir: 1 | -1 } = { key: "age", dir: 1 };
  let openId: string | null = null;

  let freshId: string | null = null;
  let autoplayTimer: ReturnType<typeof setInterval> | null = null;

  const root = el("div", "db-board");
  root.setAttribute("data-demo-board", "1");

  const top = el("div", "db-top");
  const count = el("div", "db-count");
  count.innerHTML = `<b>${loads.length} Results</b><span>+652 Similar Results</span>`;
  const sortLabel = el("div", "db-sortby");
  sortLabel.innerHTML = `Sort by <b>Age - Newest</b>`;
  const actions = el("div", "db-actions");
  ["LANE RATE", "TRI-HAUL (NO ROUTES)", "MARKET CONDITIONS"].forEach((label) => {
    actions.appendChild(el("span", "db-action", label));
  });
  top.append(count, sortLabel, actions);

  const search = el("div", "db-search");
  type Field = HTMLLabelElement & { input: HTMLInputElement };
  const field = (label: string, value = ""): Field => {
    const box = el("label", "db-field") as Field;
    box.appendChild(el("span", "db-field-label", label));
    const input = el("input", "db-field-input");
    input.value = value;
    box.appendChild(input);
    box.input = input;
    return box;
  };

  const originField = field("Origin", "Chicago, IL");
  originField.input.setAttribute("data-test", "origin-input");
  const dhField = field("DH-O", "150");
  dhField.classList.add("db-field-narrow");
  const destField = field("Destination", "");

  [originField, dhField, destField].forEach((f) => {
    f.input.readOnly = true;
    f.input.tabIndex = -1;
  });
  const swap = el("button", "db-swap", "⇄");
  swap.tabIndex = -1;
  const searchBtn = el("button", "db-search-go", "Search");
  search.append(originField, dhField, swap, destField, searchBtn);

  const originInput = originField.input;
  const destInput = destField.input;

  swap.addEventListener("click", () => {
    const from = originInput.value;
    originInput.value = destInput.value;
    destInput.value = from;
  });

  const pills = el("div", "db-pills");
  ["Load requirements", "Search back - 24 hrs", "Company", "Private loads", "Book/Bid"].forEach((label) => {
    const pill = el("button", "db-pill", label);
    pill.appendChild(el("span", "db-pill-caret", "▾"));
    pills.appendChild(pill);
  });

  const head = el("div", "db-head");
  head.appendChild(el("span", "db-cell db-cell-check"));
  COLUMNS.forEach((col) => {
    if (col.key === "destination") head.appendChild(el("span", "db-cell db-cell-arrow db-th"));
    const cell = el("span", `db-cell db-cell-${col.key} db-th`, col.label);
    if (col.sortable) {
      cell.classList.add("is-sortable");
      cell.addEventListener("click", () => {
        sort = { key: col.key, dir: sort.key === col.key && sort.dir === 1 ? -1 : 1 };
        renderRows();
      });
    }
    head.appendChild(cell);
  });
  head.appendChild(el("span", "db-cell db-cell-dtp db-th"));

  const body = el("div", "db-body");
  body.setAttribute("data-test", "search-loads-results");

  root.append(search, pills, top, head, body);
  host.appendChild(root);

  function sorted(): DemoLoad[] {
    const dir = sort.dir;
    const value = (l: DemoLoad) =>
      sort.key === "rate" ? l.rate ?? 0 : sort.key === "trip" ? l.tripMiles : l.ageMinutes;
    return [...loads].sort((a, b) => (value(a) - value(b)) * dir);
  }

  function buildRow(load: DemoLoad, index: number): HTMLElement {
    const row = el("div", "row-container db-row");
    row.id = `table-row-${index}`;
    row.dataset.loadId = load.id;
    if (load.id === freshId) row.classList.add("is-new");

    const cells = el("div", "row-cells");

    const check = el("span", "db-cell db-cell-check");
    check.appendChild(el("input", "db-check"));
    (check.firstChild as HTMLInputElement).type = "checkbox";

    const age = el("span", "db-cell db-cell-age cell-age", formatAge(load.ageMinutes));

    const rate = el("span", "db-cell db-cell-rate cell-rate");
    const rpm = ratePerMile(load);
    rate.innerHTML = load.rate
      ? `<b>${money(load.rate)}</b><i>${rpm ? usdCents(rpm) + "*/mi" : ""}</i>`
      : `<b class="db-dash">–</b>`;
    rate.setAttribute("data-testid", "posted-rate");

    const trip = el("span", "db-cell db-cell-trip", String(load.tripMiles));
    trip.setAttribute("data-test", "load-trip-cell");
    trip.setAttribute("data-testid", "distance");

    const origin = el("span", "db-cell db-cell-origin", load.origin);
    origin.setAttribute("data-test", "load-origin-cell");

    const dho = el("span", "db-cell db-cell-dho", `(${load.deadheadMiles})`);
    dho.setAttribute("data-testid", "origin-deadhead");

    const arrow = el("span", "db-cell db-cell-arrow", "o··▸");

    const destination = el("span", "db-cell db-cell-destination", load.destination);
    destination.setAttribute("data-test", "load-destination-cell");

    const dhd = el("span", "db-cell db-cell-dhd", "");

    const pickup = el("span", "db-cell db-cell-timing cell-timing");
    pickup.setAttribute("data-test", "load-pick-up-cell");
    pickup.innerHTML = `${load.pickupFrom} -<br>${load.pickupTo}`;

    const eq = el("span", "db-cell db-cell-eq cell-equipment", load.equipment);
    const length = el("span", "db-cell db-cell-length cell-length", `${load.lengthFt} ft`);
    const weight = el("span", "db-cell db-cell-weight cell-weight", `${load.weightLbs.toLocaleString("en-US")} lbs`);
    const capacity = el("span", "db-cell db-cell-capacity", load.capacity);

    const company = el("span", "db-cell db-cell-company cell-company", load.company);

    const contact = el("span", "db-cell db-cell-contact");
    contact.setAttribute("data-test", "load-contact-cell");
    if (load.contactEmail) {
      const link = el("a", "db-link", load.contactEmail);
      link.setAttribute("href", `mailto:${load.contactEmail}`);
      contact.appendChild(link);
    } else if (load.contactPhone) {
      const link = el("a", "db-link", load.contactPhone);
      link.setAttribute("href", `tel:${load.contactPhone.replace(/\D/g, "")}`);
      contact.appendChild(link);
    }

    const dtp = el("span", "db-cell db-cell-dtp");
    dtp.setAttribute("data-test", "load-cs-dtp-cell");

    cells.append(
      check, age, rate, trip, origin, dho, arrow, destination, dhd, pickup,
      eq, length, weight, capacity, company, contact, dtp,
    );
    row.appendChild(cells);

    if (options.interactive !== false) {
      row.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest("a, input, button, [data-datx-injected]")) return;
        toggle(load.id);
      });
    }
    return row;
  }

  function line(parent: HTMLElement, node: HTMLElement): HTMLElement {
    parent.appendChild(node);
    parent.appendChild(document.createTextNode(" "));
    return node;
  }

  function dataRow(label: string, value: string): HTMLElement {
    const row = el("div", "data-row db-data-row");
    row.appendChild(el("span", "data-label", label));
    row.appendChild(el("span", "data-item", value));
    row.appendChild(document.createTextNode(" "));
    return row;
  }

  function buildDetails(load: DemoLoad): HTMLElement {
    const detail = el("div", "table-row-detail db-detail");
    const panel = tag("dat-load-details", "db-detail-inner");

    const tripCol = el("div", "details-column db-col db-col-trip");
    const tripHeader = el("div", "details-header");
    tripHeader.appendChild(el("span", "label", "Trip"));
    tripCol.appendChild(tripHeader);

    const mileage = el("div", "details-subheader-mileage db-mileage");
    mileage.appendChild(el("span", "trip-miles", `${load.tripMiles.toLocaleString("en-US")} mi `));
    tripCol.appendChild(mileage);

    const route = tag("dat-route", "db-route");
    route.setAttribute("data-test", "route-details");
    const originBlock = el("div", "route-origin trip-place");
    originBlock.appendChild(el("div", "city", `${load.origin} (${load.deadheadMiles})`));
    originBlock.appendChild(el("div", "date", `Sep 20 - Sep 21`));
    const destBlock = el("div", "route-destination trip-place");
    destBlock.appendChild(el("div", "city", load.destination));
    route.append(originBlock, destBlock);
    tripCol.appendChild(route);

    const equipment = tag("dat-equipment", "db-equipment");
    equipment.appendChild(el("div", "db-block-title", "Equipment"));
    [
      ["Load", load.capacity],
      ["Truck", load.equipment === "VR" ? "Van Reefer" : load.equipment === "VA" ? "Van Air-Ride" : "Van"],
      ["Length", `${load.lengthFt} ft`],
      ["Weight", `${load.weightLbs.toLocaleString("en-US")} lbs`],
      ["Commodity", load.commodity],
      ["Reference ID", load.referenceId],
    ].forEach(([label, value]) => equipment.appendChild(dataRow(label, value)));
    tripCol.appendChild(equipment);

    const contacts = el("div", "contacts db-contacts");
    contacts.setAttribute("data-test", "contact-information-container");
    contacts.appendChild(el("div", "db-block-title", "Contact Information"));
    if (load.contactPhone) {
      const phone = el("a", "db-link", load.contactPhone);
      phone.setAttribute("href", `tel:${load.contactPhone.replace(/\D/g, "")}`);
      contacts.appendChild(phone);
    }
    if (load.contactEmail) {
      const mail = el("a", "db-link", load.contactEmail);
      mail.setAttribute("href", `mailto:${load.contactEmail}`);
      contacts.appendChild(mail);
    }
    tripCol.appendChild(contacts);

    const comments = el("div", "notes-contents db-comments");
    comments.appendChild(el("div", "db-block-title", "Comments"));
    if (load.comments) comments.appendChild(el("div", "db-comment-text", load.comments));
    tripCol.appendChild(comments);

    const rateCol = el("div", "details-column db-col db-col-rate");
    const rateBlock = tag("dat-rate", "db-rate");
    const rateHeader = el("div", "details-header");
    rateHeader.appendChild(el("span", "label", "Rate"));
    rateBlock.appendChild(rateHeader);

    const rateTotal = el("div", "db-rate-line");
    rateTotal.appendChild(el("span", "data-label", "Total"));
    const total = el("span", "data-item-total", load.rate ? money(load.rate) : "–");
    rateTotal.appendChild(total);
    rateBlock.appendChild(rateTotal);

    const tripLine = el("div", "db-rate-line");
    tripLine.appendChild(el("span", "data-label", "Trip"));
    tripLine.appendChild(el("span", "data-item", `${load.tripMiles} mi`));
    rateBlock.appendChild(tripLine);

    const rpmLine = el("div", "db-rate-line");
    rpmLine.appendChild(el("span", "data-label", "Rate / mile"));
    const rpm = ratePerMile(load);
    rpmLine.appendChild(el("span", "data-item", rpm ? usdCents(rpm) : "–"));
    rateBlock.appendChild(rpmLine);
    rateCol.appendChild(rateBlock);

    const market = el("div", "db-market");
    market.appendChild(el("div", "db-block-title", "Market rates"));
    const spot = el("div", "db-market-spot");
    spot.innerHTML =
      `<b>${money(load.marketRate)}</b> <i>(${usdCents(load.marketRate / load.tripMiles)}/mi)</i>` +
      `<span>Range: ${money(load.marketLow)} - ${money(load.marketHigh)}</span>`;
    market.appendChild(spot);
    rateCol.appendChild(market);

    const companyCol = el("div", "details-column db-col db-col-company");
    const companyHeader = el("div", "details-header");
    companyHeader.appendChild(el("span", "label", "Company"));
    companyCol.appendChild(companyHeader);

    const company = tag("dat-company", "db-company");
    line(company, el("div", "db-company-name", load.company));
    if (load.contactPhone) {
      line(company, el("div", "db-company-line", load.contactPhone));
    }
    const mc = el("div", "db-company-line", load.mcNumber);
    mc.setAttribute("data-testid", "contact-broker-mc");
    line(company, mc);
    line(company, el("div", "db-company-line db-muted", "Demo data"));

    const ratings = tag("dat-company-ratings", "db-ratings");
    ratings.innerHTML =
      `<span class="db-stars">${"★".repeat(load.creditStars)}${"☆".repeat(5 - load.creditStars)}</span>` +
      `<span class="db-muted">(${load.creditReviews})</span>`;
    company.appendChild(ratings);
    companyCol.appendChild(company);

    panel.append(tripCol, rateCol, companyCol);
    detail.appendChild(panel);
    return detail;
  }

  function renderRows() {
    body.replaceChildren();
    sorted().forEach((load, index) => {
      const row = buildRow(load, index);
      body.appendChild(row);
      if (load.id === openId) {
        row.classList.add("is-open");
        body.appendChild(buildDetails(load));
      }
    });
    count.innerHTML = `<b>${loads.length} Results</b><span>+652 Similar Results</span>`;
  }

  function toggle(id: string) {
    openId = openId === id ? null : id;
    renderRows();
    const load = loads.find((l) => l.id === openId);
    if (load && options.onRowOpen) options.onRowOpen(load);
  }

  function runSearch() {
    const pool = DEMO_LOADS.slice(0, limit);
    loads = pool.map((l) => ({ ...l, ageMinutes: l.ageMinutes + 1 + Math.floor(Math.random() * 3) }));
    if (loads.length) {
      const revived = loads[loads.length - 1];
      loads = [
        { ...revived, id: revived.id + "r" + Date.now().toString(36), ageMinutes: 1 },
        ...loads.slice(0, -1),
      ];
    }
    openId = null;
    renderRows();
  }

  searchBtn.addEventListener("click", runSearch);

  renderRows();

  if (options.autoplaySeconds) {
    let next = limit % DEMO_LOADS.length;
    autoplayTimer = setInterval(() => {
      if (document.hidden || !root.isConnected) return;
      const source = DEMO_LOADS[next % DEMO_LOADS.length];
      next += 1;
      const arrival = { ...source, id: `${source.id}-new-${next}`, ageMinutes: 1 };
      loads = [arrival, ...loads.slice(0, limit - 1)].map((l, i) =>
        i === 0 ? l : { ...l, ageMinutes: l.ageMinutes + 1 },
      );
      freshId = arrival.id;
      renderRows();

      setTimeout(() => {
        freshId = null;
      }, 2600);
    }, options.autoplaySeconds * 1000);
  }

  return {
    el: root,
    open: (id: string) => {
      openId = id;
      renderRows();
    },
    close: () => {
      openId = null;
      renderRows();
    },
    destroy: () => {
      if (autoplayTimer) clearInterval(autoplayTimer);
      root.remove();
    },
  };
}
