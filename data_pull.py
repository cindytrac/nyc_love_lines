import os
import httpx
import json

token = os.environ["DAMNLINES_API_TOKEN"]
r = httpx.get(
    "https://api.damnlines.com/v1/locations",
    headers={"Authorization": f"Bearer {token}"},
    timeout=10.0,
)
r.raise_for_status()
print(r.json()["data"])

with open('datapull.json', 'w') as file:
    # serialize and save the data
    json.dump(r.json()["data"], file)
