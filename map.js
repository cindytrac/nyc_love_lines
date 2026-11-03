const mapElement = document.querySelector('#map');
const mapStatus = document.querySelector('#map-status');

if (!mapElement || !mapStatus) {
  throw new Error('The map page is missing its map or status element.');
}

if (!window.L) {
  throw new Error('Leaflet did not load. Check the Leaflet script in index.html.');
}

const map = L.map(mapElement, { zoomControl: false });
L.control.zoom({ position: 'bottomleft' }).addTo(map);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

const liveStreamIds = {
  // lindustrie_wv: 'F8C-oG5Kuxu_Kw3DEF_A_VGV',
  // salt_hanks: 'EutKhNJTdi6naH-Lr4GQkbJp',
  // salts_cure_wv: 'SSKOBN91BjQHoW1kimL_QwQB',
  // banh_anh_em: 'xsMI9rZXTjH7lP7XcqikhhXZ',
  // lucindas: 'Y74QkxEz2u2UBfBLBa25vcph',
  // johns_on_bleecker: 'Lc2vjzA_ZqnsTW2EF6ADk24K',

  lindustrie_wv: 'GrlJAcmo5PREJRoLKy0aNa9r',
  salts_cure_wv: '9HKEN8G_Hsc1-27sJNAo4XHb',
  johns_on_bleecker: 'Lc2vjzA_ZqnsTW2EF6ADk24K',
  salt_hanks: 'EutKhNJTdi6naH-Lr4GQkbJp',
  banh_anh_em: 'xsMI9rZXTjH7lP7XcqikhhXZ',
  lucindas: 'Y74QkxEz2u2UBfBLBa25vcph',
  the_halal_guys: '2B23W9jHrTZDqR1xpjrMaFdV',
  golden_diner: 'QQU284T7Z0cxexGAX8XaCbS6',
  caffe_panna: 'otqYNTL4u1tl0iTG1YVPJ8VZ',
};
const bestTimeEmbedIds = {
  lindustrie_wv: 'DHqJswpk9nfDzDdpRrYEF9q6',
  salts_cure_wv: 'xQuA5uyeAJqa1pKnOzxxJHTI',
  johns_on_bleecker: 'CxF6bxreppmE8h5AiVT_zwa8',
  salt_hanks: 'EmzPbIesVki3dct4ySpEvb9h',
  banh_anh_em: 'vYA1GaA6pguxs2XZgJ_KtIL8',
  lucindas: 'N2wnrXR5974Pdt-w29I2Q27R',
  the_halal_guys: '26JaP-KXqokcHmIRDCP25MJs',
  golden_diner: '6YyAXsVyuya4PQkvhDeR6g13',
  caffe_panna: 'tIfcbnYXr9FQE9Q5vh6UDj6k',
};

const DATA_REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const SCHEDULE_CHECK_INTERVAL_MS = 60 * 1000;
const STATUS_MAX_AGE_MS = DATA_REFRESH_INTERVAL_MS * 2;
const markersBySlug = new Map();
let hasFittedInitialBounds = false;
let isLoadingLocations = false;
let selectedLocationSlug = null;

function appendEmbed(popup, location, embedId, title) {
  const embed = document.createElement('iframe');
  embed.src = `https://damnlines.com/embed/c/${embedId}`;
  embed.width = '460';
  embed.height = '360';
  embed.frameBorder = '0';
  embed.loading = 'lazy';
  embed.referrerPolicy = 'strict-origin-when-cross-origin';
  embed.title = `${title} at ${location.display_name}`;
  embed.style.cssText = 'display:block;border:0;width:100%;height:360px;';
  popup.append(embed);
}

function makePopup(location) {
  const popup = document.createElement('section');
  popup.className = 'location-popup';

  const name = document.createElement('h2');
  name.textContent = location.display_name;
  popup.append(name);

  const address = document.createElement('p');
  address.textContent = location.address;
  popup.append(address);

  // const status = document.createElement('p');
  // status.className = `location-popup__status ${
  //   location.status.is_open ? 'is-open' : 'is-closed'
  // }`;
  // status.textContent = location.status.is_open ? 'OPEN NOW' : 'CLOSED NOW';
  // popup.append(status);

  // if (location.status.is_open && location.status.current_count != null) {
  //   const line = document.createElement('p');
  //   const count = location.status.current_count;
  //   const wait = location.status.wait_minutes;
  //   line.textContent = `${count} People in Line${
  //     wait == null ? '' : ` · Estimated ${wait} Minute Wait`
  //   }`;
  //   popup.append(line);
  // }

  if (liveStreamIds[location.slug]) {
    appendEmbed(popup, location, liveStreamIds[location.slug], 'Live line');
  }

  if (bestTimeEmbedIds[location.slug]) {
    appendEmbed(
      popup,
      location,
      bestTimeEmbedIds[location.slug],
      'Best time to go',
    );
  }

  return popup;
}

const locationPanel = document.createElement('aside');
locationPanel.className = 'location-panel';
locationPanel.setAttribute('aria-label', 'Selected location details');
locationPanel.hidden = true;

const closePanelButton = document.createElement('button');
closePanelButton.className = 'location-panel__close';
closePanelButton.type = 'button';
closePanelButton.setAttribute('aria-label', 'Close location details');
closePanelButton.textContent = '×';

const locationPanelContent = document.createElement('div');
locationPanel.append(closePanelButton, locationPanelContent);
mapElement.append(locationPanel);
L.DomEvent.disableClickPropagation(locationPanel);
L.DomEvent.disableScrollPropagation(locationPanel);

function closeLocationPanel() {
  locationPanel.hidden = true;
  locationPanelContent.replaceChildren();
  selectedLocationSlug = null;
}

closePanelButton.addEventListener('click', closeLocationPanel);
map.on('click', closeLocationPanel);

function validateLocations(locations) {
  if (!Array.isArray(locations) || locations.length === 0) {
    throw new Error('datapull.json must contain a non-empty array of locations.');
  }

  for (const [index, location] of locations.entries()) {
    if (
      typeof location.slug !== 'string' ||
      typeof location.display_name !== 'string' ||
      typeof location.address !== 'string' ||
      typeof location.timezone !== 'string' ||
      typeof location.hours !== 'object' ||
      location.hours === null ||
      typeof location.geo?.lat !== 'number' ||
      typeof location.geo?.lng !== 'number' ||
      typeof location.status?.is_open !== 'boolean'
    ) {
      throw new Error(`Location at index ${index} is missing required map data.`);
    }
  }
}

function isOpenBySchedule(location, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: location.timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const weekdayIndexes = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  const dayIndex = weekdayIndexes[values.weekday.toLowerCase()];
  const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const currentMinutes = Number(values.hour) * 60 + Number(values.minute);
  const toMinutes = (time) => {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
  };
  const todayHours = location.hours?.[weekdayKeys[dayIndex]] ?? [];
  const yesterdayHours =
    location.hours?.[weekdayKeys[(dayIndex + 6) % weekdayKeys.length]] ?? [];

  const openToday = todayHours.some((interval) => {
    const opens = toMinutes(interval.open);
    const closes = toMinutes(interval.close);
    return closes < opens
      ? currentMinutes >= opens
      : currentMinutes >= opens && currentMinutes < closes;
  });
  const openFromYesterday = yesterdayHours.some((interval) => {
    const opens = toMinutes(interval.open);
    const closes = toMinutes(interval.close);
    return closes < opens && currentMinutes < closes;
  });

  return openToday || openFromYesterday;
}

function getLastScheduleBoundary(location, now = new Date()) {
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: location.timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const boundaries = [];

  function localTimeToTimestamp(year, month, day, time) {
    const [hour, minute] = time.split(':').map(Number);
    const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
    let timestamp = targetUtc;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const localParts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
          timeZone: location.timezone,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })
          .formatToParts(new Date(timestamp))
          .filter((part) => part.type !== 'literal')
          .map((part) => [part.type, Number(part.value)]),
      );
      const actualUtc = Date.UTC(
        localParts.year,
        localParts.month - 1,
        localParts.day,
        localParts.hour,
        localParts.minute,
      );
      const difference = targetUtc - actualUtc;
      timestamp += difference;
      if (difference === 0) break;
    }

    return timestamp;
  }

  for (let offset = -7; offset <= 0; offset += 1) {
    const date = new Date(
      Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + offset),
    );
    const weekday = weekdayKeys[date.getUTCDay()];
    const intervals = location.hours?.[weekday] ?? [];
    for (const interval of intervals) {
      const [openHour, openMinute] = interval.open.split(':').map(Number);
      const [closeHour, closeMinute] = interval.close.split(':').map(Number);
      const overnight =
        closeHour * 60 + closeMinute < openHour * 60 + openMinute;
      const closeDate = overnight
        ? new Date(date.getTime() + 24 * 60 * 60 * 1000)
        : date;
      boundaries.push(
        localTimeToTimestamp(
          date.getUTCFullYear(),
          date.getUTCMonth() + 1,
          date.getUTCDate(),
          interval.open,
        ),
        localTimeToTimestamp(
          closeDate.getUTCFullYear(),
          closeDate.getUTCMonth() + 1,
          closeDate.getUTCDate(),
          interval.close,
        ),
      );
    }
  }

  const pastBoundaries = boundaries.filter((boundary) => boundary <= now.getTime());
  return pastBoundaries.length ? Math.max(...pastBoundaries) : null;
}

function isLocationOpen(location, now = new Date()) {
  const scheduledOpen = isOpenBySchedule(location, now);
  const capturedAt = Date.parse(location.status.captured_at ?? '');
  if (!Number.isFinite(capturedAt)) {
    return scheduledOpen;
  }

  const lastBoundary = getLastScheduleBoundary(location, now);
  const captureIsCurrent =
    now.getTime() - capturedAt <= STATUS_MAX_AGE_MS &&
    (lastBoundary === null || capturedAt >= lastBoundary);
  if (captureIsCurrent) {
    return location.status.is_open;
  }
  return scheduledOpen;
}

function updateMarkerStatus(markerRecord, now = new Date()) {
  const isOpen = isLocationOpen(markerRecord.location, now);
  const changed = markerRecord.isOpen !== isOpen;
  markerRecord.isOpen = isOpen;
  markerRecord.marker.setStyle({
    fillColor: isOpen ? '#2f855a' : '#718096',
  });
  return changed;
}

function checkScheduledTransitions() {
  const now = new Date();
  let selectedLocationChanged = false;
  for (const [slug, markerRecord] of markersBySlug) {
    if (updateMarkerStatus(markerRecord, now) && slug === selectedLocationSlug) {
      selectedLocationChanged = true;
    }
  }

  if (selectedLocationChanged && !locationPanel.hidden) {
    const selectedLocation = markersBySlug.get(selectedLocationSlug)?.location;
    if (selectedLocation) {
      locationPanelContent.replaceChildren(makePopup(selectedLocation));
    }
  }
}

async function loadLocations() {
  try {
    const response = await fetch('./datapull.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Could not load datapull.json (${response.status}).`);
    }

    const locations = await response.json();
    validateLocations(locations);

    const bounds = [];
    for (const location of locations) {
      // Temporarily hide The Halal Guys marker.
      if (location.slug === 'the_halal_guys') {
        continue;
      }

      const { lat, lng } = location.geo;
      const isOpen = isLocationOpen(location);
      const title =
        !location.status.is_open && !location.status.captured_at && isOpen
          ? `${location.display_name} (scheduled open; no live status)`
          : location.display_name;
      let markerRecord = markersBySlug.get(location.slug);
      if (markerRecord) {
        markerRecord.location = location;
        markerRecord.isOpen = isOpen;
        markerRecord.marker.setStyle({ fillColor: isOpen ? '#2f855a' : '#718096' });
        markerRecord.marker.options.title = title;
      } else {
        const marker = L.circleMarker([lat, lng], {
          radius: 8,
          color: '#fff',
          weight: 2,
          fillColor: isOpen ? '#2f855a' : '#718096',
          fillOpacity: 1,
          title,
          alt: location.display_name,
          bubblingMouseEvents: false,
        }).addTo(map);

        markerRecord = { marker, location, isOpen };
        marker.on('click', () => {
          selectedLocationSlug = markerRecord.location.slug;
          locationPanelContent.replaceChildren(makePopup(markerRecord.location));
          locationPanel.hidden = false;
        });
        markersBySlug.set(location.slug, markerRecord);
      }
      bounds.push([lat, lng]);
    }

    const currentSlugs = new Set(locations.map((location) => location.slug));
    for (const [slug, markerRecord] of markersBySlug) {
      if (!currentSlugs.has(slug)) {
        map.removeLayer(markerRecord.marker);
        markersBySlug.delete(slug);
      }
    }

    if (selectedLocationSlug && !locationPanel.hidden) {
      const selectedLocation = markersBySlug.get(selectedLocationSlug)?.location;
      if (selectedLocation) {
        locationPanelContent.replaceChildren(makePopup(selectedLocation));
      } else {
        closeLocationPanel();
      }
    }

    if (!hasFittedInitialBounds) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
      hasFittedInitialBounds = true;
    }
    mapStatus.textContent = `data source - damnlines`;

    mapStatus.classList.remove('map-status--error');
  } catch (error) {
    mapStatus.textContent =
      error instanceof Error ? error.message : 'Unable to load locations.';
    mapStatus.classList.add('map-status--error');
    console.error('Unable to load map locations:', error);
  } finally {
    isLoadingLocations = false;
  }
}

async function refreshLocations() {
  if (isLoadingLocations) {
    return;
  }
  isLoadingLocations = true;
  await loadLocations();
}

refreshLocations();
window.setInterval(refreshLocations, DATA_REFRESH_INTERVAL_MS);
window.setInterval(checkScheduledTransitions, SCHEDULE_CHECK_INTERVAL_MS);
