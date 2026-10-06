"""Pipeline orchestrator: executes the notebooks in order (outputs are saved back into the notebooks).

Usage:
    python main.py                 # run all steps
    python main.py features train  # run selected steps
"""
import logging
import sys
import time
from pathlib import Path

import nbformat
from nbclient import NotebookClient

ROOT = Path(__file__).resolve().parent
STEPS = {
    "preprocess": "notebooks/01_preprocessing.ipynb",
    "features": "notebooks/02_feature_engineering.ipynb",
    "train": "notebooks/03_training_phase1.ipynb",
    "feature_sets": "notebooks/04_feature_set_comparison.ipynb",
}

log = logging.getLogger("pipeline")


def run(path: Path) -> None:
    nb = nbformat.read(path, as_version=4)
    start = time.time()
    try:
        NotebookClient(nb, timeout=None, kernel_name="python3", resources={"metadata": {"path": str(ROOT)}}).execute()
    finally:
        nbformat.write(nb, path)
    log.info("%s done in %.0f min", path.name, (time.time() - start) / 60)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    selected = sys.argv[1:] or list(STEPS)
    unknown = set(selected) - set(STEPS)
    if unknown:
        sys.exit(f"Unknown step(s) {sorted(unknown)}; choose from {list(STEPS)}")
    for step in selected:
        run(ROOT / STEPS[step])
