import { Star } from "@phosphor-icons/react";
import type { EnrichedItem } from "../types";
import { ItemRow } from "./ItemRow";

export function FavoritesGroup({
  favorites, onSelect, onToggleFavorite, updates, selected, describing,
}: {
  favorites: EnrichedItem[];
  onSelect: (it: EnrichedItem) => void;
  onToggleFavorite: (it: EnrichedItem) => void;
  updates: Record<string, { current: string; latest: string }>;
  selected?: EnrichedItem | null;
  describing?: Set<string>;
}) {
  if (favorites.length === 0) return null;
  return (
    <section className="favorites">
      <div className="fav-head">
        <span className="fav-star"><Star weight="fill" size={13} /></span>
        <span>Favorites</span>
      </div>
      {favorites.map((it) => (
        <ItemRow key={it.id} item={it} onSelect={onSelect} onToggleFavorite={onToggleFavorite} outdated={!!updates[it.id]} active={selected?.id === it.id} describing={describing?.has(it.id)} />
      ))}
    </section>
  );
}
