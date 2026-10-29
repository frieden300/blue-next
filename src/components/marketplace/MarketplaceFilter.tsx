"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import "./MarketplaceFilter.css";

interface FilterOption {
  label: string;
  value: string;
}

interface MarketplaceFilterProps {
  categories: FilterOption[];
  placeholder?: string;
  defaultCategory?: string;
}

export default function MarketplaceFilter({
  categories,
  placeholder = "Search equipment...",
  defaultCategory = "all",
}: MarketplaceFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentCategory = searchParams.get("type") || defaultCategory;
  const currentQuery = searchParams.get("q") || "";
  const [searchVal, setSearchVal] = useState(currentQuery);

  const applyFilters = (newCategory?: string, newQuery?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const cat = newCategory !== undefined ? newCategory : currentCategory;
    const q = newQuery !== undefined ? newQuery : searchVal;

    if (cat && cat !== "all") {
      params.set("type", cat);
    } else {
      params.delete("type");
    }

    if (q.trim()) {
      params.set("q", q.trim());
    } else {
      params.delete("q");
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(undefined, searchVal);
  };

  const handleClear = () => {
    setSearchVal("");
    applyFilters(undefined, "");
  };

  return (
    <div className="marketplace-filter-bar">
      <form onSubmit={handleSearchSubmit} className="marketplace-search-form">
        <div className="search-input-wrap">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder={placeholder}
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
          />
          {searchVal && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClear}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <button type="submit" className="search-submit-btn" disabled={isPending}>
          {isPending ? "Filtering..." : "Search"}
        </button>
      </form>

      <div className="filter-chips-scroll" role="tablist" aria-label="Category filters">
        {categories.map((cat) => {
          const isActive = currentCategory === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`filter-chip ${isActive ? "active" : ""}`}
              onClick={() => applyFilters(cat.value, undefined)}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
