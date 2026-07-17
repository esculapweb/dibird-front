import { asc } from "drizzle-orm";

import { db } from "../../services/db/client";
import { countryTable, timezoneTable } from "../../services/db/schema";
import { CountryItem, DropdownItem, TerritoryDropdownItem } from "../../types";
import { isoToFlagEmoji } from "../../util/helpers";

type CountryRow = typeof countryTable.$inferSelect;

export const cacheCountries = (items: CountryItem[]) => {
  db.transaction((tx) => {
    tx.delete(countryTable).run();
    for (const item of items) {
      tx.insert(countryTable)
        .values({
          value: item.territory_id,
          label: item.name,
          code: item.code,
          favourite: item.favourite,
        })
        .run();
    }
  });
};

const sortCountryRows = (rows: CountryRow[], order: string): CountryRow[] => {
  const byLabel = (a: CountryRow, b: CountryRow) => a.label.localeCompare(b.label);
  const sorted = [...rows];

  switch (order) {
    case "-favourite,name":
      sorted.sort(
        (a, b) => Number(b.favourite) - Number(a.favourite) || byLabel(a, b),
      );
      break;
    case "favourite,name":
      sorted.sort(
        (a, b) => Number(a.favourite) - Number(b.favourite) || byLabel(a, b),
      );
      break;
    case "-name":
      sorted.sort((a, b) => byLabel(b, a));
      break;
    default:
      sorted.sort(byLabel);
  }

  return sorted;
};

export const getCachedCountries = (order: string): TerritoryDropdownItem[] =>
  sortCountryRows(db.select().from(countryTable).all(), order).map((row) => ({
    value: row.value,
    label: row.label,
    code: row.code,
    icon: isoToFlagEmoji(row.code),
    iconLabelRight: row.favourite ? ("flag" as const) : undefined,
  }));

export const cacheTimezones = (items: DropdownItem[]) => {
  db.transaction((tx) => {
    tx.delete(timezoneTable).run();
    items.forEach((item, index) => {
      tx.insert(timezoneTable)
        .values({
          value: String(item.value),
          label: item.label,
          sortOrder: index,
        })
        .run();
    });
  });
};

export const getCachedTimezones = (): DropdownItem[] =>
  db
    .select()
    .from(timezoneTable)
    .orderBy(asc(timezoneTable.sortOrder))
    .all()
    .map((row) => ({ value: row.value, label: row.label }));

// countryTable carries a per-user `favourite` flag (see cacheCountries
// above), so it shouldn't survive a logout — left behind, it'd show the
// previous account's favourite countries to whoever logs in next on this
// device. timezoneTable isn't user-specific, but there's no separate cache
// to keep it around for once countries are gone, so it's cleared alongside.
export const clearReferenceData = () => {
  db.transaction((tx) => {
    tx.delete(countryTable).run();
    tx.delete(timezoneTable).run();
  });
};
