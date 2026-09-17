"""STAGE 11 entry point. Run: python run_milp.py

Also compares MILP's exact Pareto trace vs the NSGA-II/QBHO CSVs produced
by run_nsga2.py / run_qbho.py (run those first for a full comparison
printout; MILP still runs standalone otherwise).
"""
from __future__ import annotations

import json
import os
import time

import pandas as pd

from scenario_setup import build_evaluated_legs
from milp_model import MILPModel


def main():
    legs, evaluated = build_evaluated_legs(seed=0)
    t0 = time.time()
    model = MILPModel(legs)
    front = model.trace_pareto_front(n_weight_samples=15)
    runtime = time.time() - t0

    rows = [{"solution_id": i, "fuel": s.fuel, "cost": s.cost, "ghg": s.ghg,
             "all_feasible": s.all_feasible, "selection": json.dumps(s.selection)}
            for i, s in enumerate(front)]
    df = pd.DataFrame(rows)
    df.to_csv("milp_results.csv", index=False)
    print(f"MILP (exact, scalarized weight fan): {len(front)} distinct Pareto-traced solutions, runtime={runtime:.2f}s")

    for fname, label in [("nsga2_pareto.csv", "NSGA-II"), ("qbho_pareto.csv", "QBHO")]:
        if os.path.exists(fname):
            other = pd.read_csv(fname)
            print(f"  vs {label}: {len(other)} solutions, MILP best fuel={df['fuel'].min():.4f} "
                  f"vs {label} best fuel={other['fuel'].min():.4f}")


if __name__ == "__main__":
    main()
