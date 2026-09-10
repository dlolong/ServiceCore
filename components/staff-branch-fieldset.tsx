"use client";

import { useState } from "react";

export function StaffBranchFieldset({ id, branches, selected, label }: {
  id: string;
  branches: { id: string; name: string }[];
  selected: string[];
  label: string;
}) {
  const [allBranches, setAllBranches] = useState(!selected.length);
  const [branchIds, setBranchIds] = useState(selected);
  const unavailableIds = branchIds.filter((branchId) => !branches.some((branch) => branch.id === branchId));

  return <fieldset id={id} className="rounded-xl border border-slate-300 p-3 sm:col-span-2">
    <legend className="px-1 text-sm font-semibold">{label}</legend>
    <label className="flex min-h-9 items-center gap-2 text-sm">
      <input id={`${id}-all-checkbox`} type="checkbox" name="allBranches" checked={allBranches} onChange={(event) => {
        setAllBranches(event.target.checked);
        setBranchIds([]);
      }}/> All current and future branches
    </label>
    <div className="grid gap-1 sm:grid-cols-2">{branches.map((branch, index) => <label className="flex min-h-9 items-center gap-2 text-sm" key={branch.id}>
      <input id={`${id}-${branch.id}-checkbox`} type="checkbox" name="branchIds" value={branch.id}
        checked={branchIds.includes(branch.id)} required={!allBranches && !branchIds.length && index === 0}
        onChange={(event) => {
          setAllBranches(false);
          setBranchIds(event.target.checked ? [...branchIds, branch.id] : branchIds.filter((value) => value !== branch.id));
        }}/>{branch.name}
    </label>)}</div>
    {unavailableIds.map((branchId) => <input key={branchId} type="hidden" name="branchIds" value={branchId}/>)}
    {unavailableIds.length ? <p className="mt-2 text-xs text-slate-600">This profile includes unavailable branches. Choose all branches to clear them, then select the branches you need.</p> : null}
    {!allBranches && !branchIds.length ? <p id={`${id}-selection-help`} className="mt-2 text-xs text-slate-600">Select at least one branch, or choose all branches.</p> : null}
  </fieldset>;
}
