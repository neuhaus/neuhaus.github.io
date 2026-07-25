/**
 * UDDF 3.2 XML Exporter
 * Serialises dive log state to valid UDDF 3.2.0 XML
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

  function escapeXml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function exportToUddf(diveLogData, displayUnits = UNITS.METRIC) {
    const isImperial = displayUnits === UNITS.IMPERIAL;

    const depthSI = isImperial
      ? CONVERSIONS.feetToMetres(parseFloat(diveLogData.maxDepth || 0))
      : parseFloat(diveLogData.maxDepth || 0);

    const durationMin = parseFloat(diveLogData.duration || 0);
    const durationSec = durationMin * 60;

    const startPressureSI = isImperial
      ? CONVERSIONS.psiToPascal(parseFloat(diveLogData.startPressure || 0))
      : CONVERSIONS.barToPascal(parseFloat(diveLogData.startPressure || 0));

    const endPressureSI = isImperial
      ? CONVERSIONS.psiToPascal(parseFloat(diveLogData.endPressure || 0))
      : CONVERSIONS.barToPascal(parseFloat(diveLogData.endPressure || 0));

    const tankVolSI = isImperial
      ? CONVERSIONS.cuftToCubicMeters(parseFloat(diveLogData.tankVolume || 0))
      : CONVERSIONS.litresToCubicMeters(parseFloat(diveLogData.tankVolume || 0));

    const leadKg = isImperial
      ? CONVERSIONS.lbsToKg(parseFloat(diveLogData.leadQuantity || 0))
      : parseFloat(diveLogData.leadQuantity || 0);

    const airTempSI = diveLogData.airTemp !== '' && diveLogData.airTemp !== undefined
      ? (isImperial ? CONVERSIONS.fahrenheitToKelvin(parseFloat(diveLogData.airTemp)) : CONVERSIONS.celsiusToKelvin(parseFloat(diveLogData.airTemp)))
      : null;

    const waterTempSI = diveLogData.waterTemp !== '' && diveLogData.waterTemp !== undefined
      ? (isImperial ? CONVERSIONS.fahrenheitToKelvin(parseFloat(diveLogData.waterTemp)) : CONVERSIONS.celsiusToKelvin(parseFloat(diveLogData.waterTemp)))
      : null;

    const visibilitySI = diveLogData.visibility !== '' && diveLogData.visibility !== undefined
      ? (isImperial ? CONVERSIONS.feetToMetres(parseFloat(diveLogData.visibility)) : parseFloat(diveLogData.visibility))
      : null;

    const o2Fraction = (parseFloat(diveLogData.gasO2 || 21) / 100).toFixed(4);
    const heFraction = (parseFloat(diveLogData.gasHe || 0) / 100).toFixed(4);
    const n2Fraction = (1.0 - parseFloat(o2Fraction) - parseFloat(heFraction)).toFixed(4);

    const gasId = `gas_${(diveLogData.gasName || 'air').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const siteId = 'site_1';
    const ownerId = 'diver_owner';
    const buddyId = 'diver_buddy';
    const tankId = 'tank_1';
    const suitId = 'suit_1';

    const nowIso = new Date().toISOString().split('.')[0];
    const diveDateTime = diveLogData.dateTime ? new Date(diveLogData.dateTime).toISOString().split('.')[0] : nowIso;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<uddf version="3.2.0" xmlns="http://www.streit.cc/uddf/3.2/">\n`;

    // 1. Generator
    xml += `  <generator>\n`;
    xml += `    <name>divelog-editor</name>\n`;
    xml += `    <type>logbook</type>\n`;
    xml += `    <manufacturer>\n`;
    xml += `      <name>divelog-editor</name>\n`;
    xml += `    </manufacturer>\n`;
    xml += `    <version>1.0.0</version>\n`;
    xml += `    <datetime>${nowIso}</datetime>\n`;
    xml += `  </generator>\n`;

    // 2. Diver
    xml += `  <diver>\n`;
    xml += `    <owner id="${ownerId}">\n`;
    xml += `      <personal>\n`;
    xml += `        <firstnames>${escapeXml(diveLogData.diverFirstName || 'Diver')}</firstnames>\n`;
    xml += `        <lastname>${escapeXml(diveLogData.diverLastName || '')}</lastname>\n`;
    xml += `      </personal>\n`;
    xml += `    </owner>\n`;
    if (diveLogData.buddyName) {
      xml += `    <buddy id="${buddyId}">\n`;
      xml += `      <personal>\n`;
      xml += `        <firstnames>${escapeXml(diveLogData.buddyName)}</firstnames>\n`;
      xml += `      </personal>\n`;
      xml += `    </buddy>\n`;
    }
    xml += `  </diver>\n`;

    // 3. Divesite
    xml += `  <divesite>\n`;
    xml += `    <site id="${siteId}">\n`;
    xml += `      <name>${escapeXml(diveLogData.siteName || 'Unknown Dive Site')}</name>\n`;
    if (diveLogData.siteLocation || diveLogData.siteCountry || diveLogData.latitude || diveLogData.longitude) {
      xml += `      <geography>\n`;
      if (diveLogData.siteLocation) xml += `        <location>${escapeXml(diveLogData.siteLocation)}</location>\n`;
      if (diveLogData.siteCountry) xml += `        <country>${escapeXml(diveLogData.siteCountry)}</country>\n`;
      if (diveLogData.latitude) xml += `        <latitude>${parseFloat(diveLogData.latitude).toFixed(6)}</latitude>\n`;
      if (diveLogData.longitude) xml += `        <longitude>${parseFloat(diveLogData.longitude).toFixed(6)}</longitude>\n`;
      xml += `      </geography>\n`;
    }
    xml += `    </site>\n`;
    xml += `  </divesite>\n`;

    // 4. Gas Definitions
    xml += `  <gasdefinitions>\n`;
    xml += `    <mix id="${gasId}">\n`;
    xml += `      <name>${escapeXml(diveLogData.gasName || 'Air')}</name>\n`;
    xml += `      <o2>${o2Fraction}</o2>\n`;
    xml += `      <n2>${n2Fraction}</n2>\n`;
    xml += `      <he>${heFraction}</he>\n`;
    xml += `    </mix>\n`;
    xml += `  </gasdefinitions>\n`;

    // 5. Equipment Definitions (Suit & Protection)
    if (diveLogData.suitType && diveLogData.suitType !== 'none') {
      let suitName = 'Wetsuit';
      let suitCategory = 'wetsuit';
      if (diveLogData.suitType === 'drysuit') { suitName = 'Drysuit'; suitCategory = 'drysuit'; }
      else if (diveLogData.suitType === 'shorty') { suitName = 'Shorty Wetsuit'; suitCategory = 'shorty'; }
      else if (diveLogData.suitType === 'wetsuit_3mm') { suitName = '3mm Wetsuit'; suitCategory = 'wetsuit'; }
      else if (diveLogData.suitType === 'wetsuit_5mm') { suitName = '5mm Wetsuit'; suitCategory = 'wetsuit'; }
      else if (diveLogData.suitType === 'wetsuit_7mm') { suitName = '7mm Semi-Dry Wetsuit'; suitCategory = 'wetsuit'; }

      xml += `  <equipment>\n`;
      xml += `    <suit id="${suitId}">\n`;
      xml += `      <name>${suitName}</name>\n`;
      xml += `      <suittype>${suitCategory}</suittype>\n`;
      xml += `    </suit>\n`;
      xml += `  </equipment>\n`;
    }

    // 6. Profile Data
    xml += `  <profiledata>\n`;
    xml += `    <repetitiongroup id="rg_1">\n`;
    xml += `      <dive id="dive_1">\n`;

    // Information Before Dive
    xml += `        <informationbeforedive>\n`;
    xml += `          <link ref="${siteId}"/>\n`;
    xml += `          <link ref="${ownerId}"/>\n`;
    if (diveLogData.buddyName) {
      xml += `          <link ref="${buddyId}"/>\n`;
    }
    if (diveLogData.diveNumber) {
      xml += `          <divenumber>${parseInt(diveLogData.diveNumber, 10)}</divenumber>\n`;
    }
    xml += `          <datetime>${diveDateTime}</datetime>\n`;
    if (airTempSI !== null) {
      xml += `          <airtemperature>${airTempSI.toFixed(2)}</airtemperature>\n`;
    }
    xml += `          <apparatus>${escapeXml(diveLogData.apparatus || 'open-scuba')}</apparatus>\n`;
    xml += `          <purpose>${escapeXml(diveLogData.purpose || 'sightseeing')}</purpose>\n`;
    xml += `        </informationbeforedive>\n`;

    // Waypoints (Preserve imported profile waypoints or generate 5-point profile)
    xml += `        <samples>\n`;
    let waypoints = diveLogData.customWaypoints;
    if (!waypoints || waypoints.length === 0) {
      const pStart = startPressureSI > 0 ? startPressureSI : 20000000;
      const pEnd = endPressureSI > 0 ? endPressureSI : 5000000;
      const pDiff = pStart - pEnd;
      const tTotal = Math.max(durationSec, 300);
      const tempVal = waterTempSI !== null ? waterTempSI : 293.15;
      const safetyStopDepth = depthSI >= 9 ? 5.0 : Math.min(depthSI, 3.0);

      waypoints = [
        { time: 0, depth: 0.0, pressure: pStart, temp: tempVal },
        { time: 120, depth: depthSI, pressure: pStart - pDiff * 0.1, temp: tempVal },
        { time: Math.max(120, tTotal - 360), depth: depthSI, pressure: pStart - pDiff * 0.75, temp: tempVal },
        { time: Math.max(180, tTotal - 180), depth: safetyStopDepth, pressure: pStart - pDiff * 0.9, temp: tempVal },
        { time: tTotal, depth: 0.0, pressure: pEnd, temp: tempVal }
      ];
    }

    waypoints.forEach((wp) => {
      xml += `          <waypoint>\n`;
      xml += `            <divetime>${Math.round(wp.time)}</divetime>\n`;
      xml += `            <depth>${parseFloat(wp.depth).toFixed(2)}</depth>\n`;
      if (wp.temp !== null && wp.temp !== undefined) {
        xml += `            <temperature>${parseFloat(wp.temp).toFixed(2)}</temperature>\n`;
      }
      xml += `            <switchmix ref="${gasId}"/>\n`;
      if (wp.pressure) {
        xml += `            <tankpressure tank="${tankId}">${Math.round(wp.pressure)}</tankpressure>\n`;
      }
      xml += `          </waypoint>\n`;
    });

    xml += `        </samples>\n`;

    // Tank Data
    xml += `        <tankdata id="${tankId}">\n`;
    xml += `          <link ref="${gasId}"/>\n`;
    if (tankVolSI > 0) {
      xml += `          <tankvolume>${tankVolSI.toFixed(4)}</tankvolume>\n`;
    }
    xml += `          <tankpressurebegin>${Math.round(startPressureSI)}</tankpressurebegin>\n`;
    xml += `          <tankpressureend>${Math.round(endPressureSI)}</tankpressureend>\n`;
    xml += `        </tankdata>\n`;

    // Equipment Used (Suit link & Lead ballast quantity)
    xml += `        <equipmentused>\n`;
    if (diveLogData.suitType && diveLogData.suitType !== 'none') {
      xml += `          <link ref="${suitId}"/>\n`;
    }
    if (leadKg > 0) {
      xml += `          <leadquantity>${leadKg.toFixed(1)}</leadquantity>\n`;
    }
    xml += `        </equipmentused>\n`;

    // Information After Dive
    xml += `        <informationafterdive>\n`;
    xml += `          <greatestdepth>${depthSI.toFixed(2)}</greatestdepth>\n`;
    if (waterTempSI !== null) {
      xml += `          <lowesttemperature>${waterTempSI.toFixed(2)}</lowesttemperature>\n`;
    }
    if (visibilitySI !== null) {
      xml += `          <visibility>${visibilitySI.toFixed(2)}</visibility>\n`;
    }
    if (diveLogData.notes) {
      xml += `          <notes>\n`;
      xml += `            <para>${escapeXml(diveLogData.notes)}</para>\n`;
      xml += `          </notes>\n`;
    }
    xml += `        </informationafterdive>\n`;

    xml += `      </dive>\n`;
    xml += `    </repetitiongroup>\n`;
    xml += `  </profiledata>\n`;

    xml += `</uddf>`;

    return xml;
  }

  window.UDDF_EXPORTER = { exportToUddf };
})(window);
