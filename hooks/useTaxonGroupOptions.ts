import { useQuery } from "@tanstack/react-query";

import { fetchTaxonGroupOptions } from "../util/fetches";
import { StaleTime } from "../constants/staleTime";
import { useLanguage } from "../store/language-context";
import { AppError, DropdownItem, TaxonTraitFilters } from "../types";

/**
 * The choices for the group filter's three dropdowns — orders, then the
 * families under the picked order, then the genera under the picked family —
 * and the names its chips show. The sheet and the chips row read the same
 * keys, so a chip costs no request once the sheet has been opened.
 *
 * Families are listed even with no order picked (all ~250 of them): a family
 * is a name people know without its order. Genera wait for a family — there
 * are ~2500 of them and only the Latin name to go by.
 */
export const useTaxonGroupOptions = (
  traits: TaxonTraitFilters,
  enabled = true,
) => {
  const { language } = useLanguage();
  const order = traits.order ?? null;
  const family = traits.family ?? null;

  const orders = useQuery<DropdownItem[], AppError>({
    queryKey: ["TaxonGroupOptions", 2, null, language],
    queryFn: () => fetchTaxonGroupOptions(2),
    staleTime: StaleTime.ONE_DAY,
    enabled,
  });

  const families = useQuery<DropdownItem[], AppError>({
    queryKey: ["TaxonGroupOptions", 3, order, language],
    queryFn: () =>
      fetchTaxonGroupOptions(3, order ? { segment: order, rank: 2 } : null),
    staleTime: StaleTime.ONE_DAY,
    enabled,
  });

  const genera = useQuery<DropdownItem[], AppError>({
    queryKey: ["TaxonGroupOptions", 4, family, language],
    queryFn: () =>
      fetchTaxonGroupOptions(4, family ? { segment: family, rank: 3 } : null),
    staleTime: StaleTime.ONE_DAY,
    enabled: enabled && !!family,
  });

  return { orders, families, genera };
};

// The display name of a picked group, or a placeholder until its list is in.
export const groupLabel = (
  options: DropdownItem[] | undefined,
  segment: string,
): string => options?.find((item) => item.value === segment)?.label ?? "…";
