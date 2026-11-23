# NYC Loves Line

🗺️ #30DayMapChallenge Day 2 - Lines!

🧍🏻‍♀️ NYC loves (or hates?) a line! 
How long would you wait for a NY slice? Caffe Panna? Banh Anh Em?

📍Assess the line before you get in line: https://cindytrac.github.io/nyc_love_lines/

I mapped the data damnlines.com provides on popular NYC spots. Using the damnlines API, I pulled both the live cam of the line and when it thinks the best time for you to go is. 

damnlines only supports live view on 9 spots (had to take Halal Guys out because the embedded live feed doesn't auto-update right now), but they're always taking suggestions!

## Technical Details
Taking the livestream data from damnlines.com and plotting it on a map.

data_pull.py script fetches locations immediately and repeats every 15 minutes while it
is running. It writes the latest response data to `datapull.json`.

Map reads `datapull.json` for its location markers and open/closed line details, refreshing the data and any selected location feeds every 15 minutes. It also checks business hours every minute so markers and selected feeds update
at scheduled opening and closing times.
