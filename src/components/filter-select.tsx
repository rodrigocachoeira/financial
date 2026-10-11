"use client";

import { ChevronDownIcon } from "./icons";
import { SelectMenu, type SelectOption } from "./select-menu";

const FIELD =
  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-border bg-surface py-2.5 pl-3 pr-2.5 text-left text-sm font-medium text-foreground shadow-sm transition hover:border-accent/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-expanded:border-accent sm:w-48";

/** A labeled field that opens a `SelectMenu`. Used for the filters above lists and reports. */
export function FilterSelect(props: {
  label: string;
  value: string;
  options: SelectOption[];
  className?: string;
  searchable?: boolean;
  onChange: (value: string) => void;
}) {
  const current = props.options.find((option) => option.value === props.value);
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${props.className ?? ""}`}>
      <span className="text-xs font-medium text-muted" aria-hidden="true">
        {props.label}
      </span>
      <SelectMenu
        label={props.label}
        value={props.value}
        options={props.options}
        onChange={props.onChange}
        searchable={props.searchable}
        triggerClassName={FIELD}
      >
        <span className="flex min-w-0 items-center gap-2">
          {current?.color && (
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: current.color }} aria-hidden="true" />
          )}
          <span className="truncate">{current?.label}</span>
        </span>
        <ChevronDownIcon className="shrink-0 text-base text-muted" />
      </SelectMenu>
    </div>
  );
}
