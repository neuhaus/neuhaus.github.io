/**
 * UDDF 3.2 XML Parser
 * Parses UDDF XML format into JavaScript Dive Log state object
  Copyright (C) 2026 Sven Neuhaus

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as
  published by the Free Software Foundation, either version 3 of the
  License, or (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
(function(window) {
  const { CONVERSIONS, UNITS } = window.UDDF_SCHEMA;

  function parseUddfXml(xmlString, targetUnits = UNITS.METRIC) {
    const isImperial = targetUnits === UNITS.IMPERIAL;
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid XML file: ' + parseError.textContent);
    }

    const getText = (selector, parent = xmlDoc) => {
      const el = parent.querySelector(selector);
      return el ? el.textContent.trim() : '';
    };

    const getFloat = (selector, parent = xmlDoc) => {
      const val = getText(selector, parent);
      return val !== '' ? parseFloat(val) : null;
    };

    // Dive Site
    const siteName = getText('divesite site > name') || getText('site > name');
    const siteLocation = getText('geography > location');
    const siteCountry = getText('geography > country');
    const latitude = getText('geography > latitude');
    const longitude = getText('geography > longitude');

    // Diver & Buddy
    const diverFirstName = getText('diver owner personal > firstnames');
    const diverLastName = getText('diver owner personal > lastname');
    const buddyName = getText('diver buddy personal > firstnames') || getText('diver buddy personal > name');

    // Gas definitions
    const gasName = getText('gasdefinitions mix > name') || 'Air';
    const o2Fraction = getFloat('gasdefinitions mix > o2') ?? 0.21;
    const heFraction = getFloat('gasdefinitions mix > he') ?? 0.0;
    const gasO2 = Math.round(o2Fraction * 100);
    const gasHe = Math.round(heFraction * 100);

    // Info before dive
    const diveNumber = getText('informationbeforedive > divenumber');
    const dateTime = getText('informationbeforedive > datetime');
    const apparatus = getText('informationbeforedive > apparatus') || 'open-scuba';
    const purpose = getText('informationbeforedive > purpose') || 'sightseeing';

    const airTempK = getFloat('informationbeforedive > airtemperature');
    let airTemp = '';
    if (airTempK !== null) {
      airTemp = isImperial
        ? Math.round(CONVERSIONS.kelvinToFahrenheit(airTempK))
        : Math.round(CONVERSIONS.kelvinToCelsius(airTempK));
    }

    // Info after dive
    const greatestDepthM = getFloat('informationafterdive > greatestdepth') ?? getFloat('waypoint > depth');
    let maxDepth = '0';
    if (greatestDepthM !== null) {
      maxDepth = isImperial
        ? CONVERSIONS.metresToFeet(greatestDepthM).toFixed(1)
        : greatestDepthM.toFixed(1);
    }

    const waterTempK = getFloat('informationafterdive > lowesttemperature');
    let waterTemp = '';
    if (waterTempK !== null) {
      waterTemp = isImperial
        ? Math.round(CONVERSIONS.kelvinToFahrenheit(waterTempK))
        : Math.round(CONVERSIONS.kelvinToCelsius(waterTempK));
    }

    const visibilityM = getFloat('informationafterdive > visibility');
    let visibility = '';
    if (visibilityM !== null) {
      visibility = isImperial
        ? CONVERSIONS.metresToFeet(visibilityM).toFixed(1)
        : visibilityM.toFixed(1);
    }

    const notes = getText('informationafterdive notes > para') || getText('informationafterdive > notes');

    // Tank Data
    const tankVolM3 = getFloat('tankdata > tankvolume');
    let tankVolume = isImperial ? '80' : '12';
    if (tankVolM3 !== null && tankVolM3 > 0) {
      tankVolume = isImperial
        ? CONVERSIONS.cubicMetersToCuft(tankVolM3).toFixed(0)
        : CONVERSIONS.cubicMetersToLitres(tankVolM3).toFixed(1);
    }

    const pStartPa = getFloat('tankdata > tankpressurebegin') ?? getFloat('waypoint:first-child > tankpressure');
    let startPressure = isImperial ? '3000' : '200';
    if (pStartPa !== null && pStartPa > 0) {
      startPressure = isImperial
        ? Math.round(CONVERSIONS.pascalToPsi(pStartPa)).toString()
        : Math.round(CONVERSIONS.pascalToBar(pStartPa)).toString();
    }

    const pEndPa = getFloat('tankdata > tankpressureend') ?? getFloat('waypoint:last-child > tankpressure');
    let endPressure = isImperial ? '700' : '50';
    if (pEndPa !== null && pEndPa > 0) {
      endPressure = isImperial
        ? Math.round(CONVERSIONS.pascalToPsi(pEndPa)).toString()
        : Math.round(CONVERSIONS.pascalToBar(pEndPa)).toString();
    }

    // Equipment: Suit & Ballast Weight
    const rawSuitType = getText('suittype') || getText('suit > suittype') || 'wetsuit_5mm';
    let suitType = 'wetsuit_5mm';
    if (rawSuitType.includes('dry')) suitType = 'drysuit';
    else if (rawSuitType.includes('short')) suitType = 'shorty';
    else if (rawSuitType.includes('7') || rawSuitType.includes('semi')) suitType = 'wetsuit_7mm';
    else if (rawSuitType.includes('3')) suitType = 'wetsuit_3mm';
    else if (rawSuitType.includes('none') || rawSuitType.includes('nosuit')) suitType = 'none';

    const leadKg = getFloat('leadquantity') ?? 6.0;
    const leadQuantity = isImperial
      ? (CONVERSIONS.kgToLbs(leadKg)).toFixed(1)
      : leadKg.toFixed(1);

    // Preserve raw profile waypoints from dive computer / imported file
    const waypointsNodes = Array.from(xmlDoc.querySelectorAll('samples > waypoint'));
    let duration = '45';
    const customWaypoints = waypointsNodes.map(wp => ({
      time: getFloat('divetime', wp) ?? 0,
      depth: getFloat('depth', wp) ?? 0,
      temp: getFloat('temperature', wp),
      pressure: getFloat('tankpressure', wp)
    }));

    if (waypointsNodes.length > 0) {
      const lastWp = waypointsNodes[waypointsNodes.length - 1];
      const lastTimeSec = getFloat('divetime', lastWp);
      if (lastTimeSec !== null && lastTimeSec > 0) {
        duration = Math.round(lastTimeSec / 60).toString();
      }
    }

    return {
      diveNumber,
      dateTime: dateTime ? dateTime.substring(0, 16) : new Date().toISOString().substring(0, 16),
      siteName,
      siteLocation,
      siteCountry,
      latitude,
      longitude,
      diverFirstName,
      diverLastName,
      buddyName,
      gasName,
      gasO2,
      gasHe,
      apparatus,
      purpose,
      suitType,
      leadQuantity,
      maxDepth,
      duration,
      tankVolume,
      startPressure,
      endPressure,
      airTemp,
      waterTemp,
      visibility,
      notes,
      customWaypoints
    };
  }

  window.UDDF_PARSER = { parseUddfXml };
})(window);
