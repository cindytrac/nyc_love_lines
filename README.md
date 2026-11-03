# nyc_love_lines

Taking the livestream data from damnlines.com and plotting it on a map.

data_pull.py script fetches locations immediately and repeats every 15 minutes while it
is running. It writes the latest response data to `datapull.json`.

Map reads `datapull.json` for its location markers and open/closed line details, refreshing the data and any selected location feeds every 15 minutes.
It also checks business hours every minute so markers and selected feeds update
at scheduled opening and closing times.
