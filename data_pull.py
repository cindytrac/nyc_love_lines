import json
import logging
import os
import time
from pathlib import Path

import httpx


PULL_INTERVAL_SECONDS = 15 * 60
OUTPUT_FILE = Path(__file__).with_name("datapull.json")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)


def pull_data(token: str) -> None:
    response = httpx.get(
        "https://api.damnlines.com/v1/locations",
        headers={"Authorization": f"Bearer {token}"},
        timeout=10.0,
    )
    response.raise_for_status()
    locations = response.json()["data"]
    if not isinstance(locations, list):
        raise TypeError("The locations API response data must be a list.")

    with OUTPUT_FILE.open("w", encoding="utf-8") as file:
        json.dump(locations, file, ensure_ascii=False)

    logging.info("Saved %d locations to %s", len(locations), OUTPUT_FILE)


def main() -> None:
    token = os.environ["DAMNLINES_API_TOKEN"]

    while True:
        started_at = time.monotonic()
        try:
            pull_data(token)
        except (
            httpx.HTTPError,
            OSError,
            json.JSONDecodeError,
            KeyError,
            TypeError,
        ):
            logging.exception("Data pull failed; it will retry on the next interval.")

        sleep_seconds = max(
            0, PULL_INTERVAL_SECONDS - (time.monotonic() - started_at)
        )
        logging.info("Next data pull in %.1f minutes.", sleep_seconds / 60)
        try:
            time.sleep(sleep_seconds)
        except KeyboardInterrupt:
            logging.info("Stopping scheduled data pulls.")
            return


if __name__ == "__main__":
    main()
