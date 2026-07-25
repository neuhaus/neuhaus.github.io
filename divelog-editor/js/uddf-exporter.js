/**
 * UDDF 3.2.1 XML Exporter
 * Serialises dive log state to valid UDDF 3.2.1 XML
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

    const gasId = `gas_${(diveLogData.gasName || 'air').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    const siteNameStr = diveLogData.siteName || 'Unknown Dive Site';
    const locParts = [diveLogData.siteLocation, diveLogData.siteCountry].filter(Boolean);
    const locationStr = locParts.join(', ');
    const siteId = `site_${siteNameStr.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    const ownerId = 'diver_owner';
    const buddyId = diveLogData.buddyName ? `buddy_${diveLogData.buddyName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : '';
    const suitId = 'suit_1';
    const tankId = 'tank_1';
    const profileId = `profile_dive_1-${Date.now()}`;

    const nowIso = new Date().toISOString().split('.')[0] + 'Z';
    let diveDateTime = nowIso;
    if (diveLogData.dateTime) {
      let dt = diveLogData.dateTime.length === 16 ? `${diveLogData.dateTime}:00` : diveLogData.dateTime;
      if (!dt.endsWith('Z')) dt += 'Z';
      diveDateTime = dt;
    }

    let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
    xml += `<uddf xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="3.2.3" xmlns="http://www.streit.cc/uddf/3.2/">\n`;

    // 1. Generator
    xml += `  <generator>\n`;
    xml += `    <name>divelog-editor</name>\n`;
    xml += `    <type>logbook</type>\n`;
    xml += `    <manufacturer id="manuf_divelog_editor">\n`;
    xml += `      <name>divelog-editor</name>\n`;
    xml += `    </manufacturer>\n`;
    xml += `    <version>1.0.0</version>\n`;
    xml += `    <datetime>${nowIso}</datetime>\n`;
    xml += `  </generator>\n`;

    // 2. Diver
    xml += `  <diver>\n`;
    xml += `    <owner id="${ownerId}">\n`;
    xml += `      <personal>\n`;
    xml += `        <firstname>${escapeXml(diveLogData.diverFirstName || 'Diver')}</firstname>\n`;
    xml += `        <lastname>${escapeXml(diveLogData.diverLastName || '')}</lastname>\n`;
    xml += `      </personal>\n`;

    // Equipment Definitions (Suit & Protection)
    let suitName = '';
    let suitCategory = 'wet-suit';
    if (diveLogData.suitType && diveLogData.suitType !== 'none') {
      suitName = 'Nasstauchanzug';
      if (diveLogData.suitType === 'drysuit') { suitName = 'Trockentauchanzug'; suitCategory = 'dry-suit'; }
      else if (diveLogData.suitType === 'shorty') { suitName = 'Shorty'; suitCategory = 'wet-suit'; }
      else if (diveLogData.suitType === 'wetsuit_3mm') { suitName = '3mm Nasstauchanzug'; suitCategory = 'wet-suit'; }
      else if (diveLogData.suitType === 'wetsuit_5mm') { suitName = '5mm Nasstauchanzug'; suitCategory = 'wet-suit'; }
      else if (diveLogData.suitType === 'wetsuit_7mm') { suitName = '7mm Nasstauchanzug'; suitCategory = 'wet-suit'; }

      xml += `      <equipment>\n`;
      xml += `        <suit id="${suitId}">\n`;
      xml += `          <name>${escapeXml(suitName)}</name>\n`;
      xml += `          <suittype>${suitCategory}</suittype>\n`;
      xml += `        </suit>\n`;
      xml += `      </equipment>\n`;
    }
    xml += `    </owner>\n`;

    if (diveLogData.buddyName) {
      xml += `    <buddy id="${buddyId}">\n`;
      xml += `      <personal>\n`;
      xml += `        <firstname>${escapeXml(diveLogData.buddyName)}</firstname>\n`;
      xml += `        <lastname></lastname>\n`;
      xml += `      </personal>\n`;
      xml += `    </buddy>\n`;
    }
    xml += `  </diver>\n`;

    // 3. Divesite
    xml += `  <divesite>\n`;
    xml += `    <site id="${escapeXml(siteId)}">\n`;
    xml += `      <name>${escapeXml(siteNameStr)}</name>\n`;
    if (locationStr || diveLogData.latitude || diveLogData.longitude) {
      xml += `      <geography>\n`;
      if (locationStr) xml += `        <location>${escapeXml(locationStr)}</location>\n`;
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

    // 5. Profile Data
    xml += `  <profiledata>\n`;
    xml += `    <repetitiongroup id="rg_1">\n`;
    xml += `      <dive id="dive_1">\n`;

    // Information Before Dive
    xml += `        <informationbeforedive>\n`;
    xml += `          <link ref="${profileId}"/>\n`;
    if (buddyId) {
      xml += `          <link ref="${buddyId}"/>\n`;
    }
    xml += `          <link ref="${escapeXml(siteId)}"/>\n`;
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

    // Waypoints (Only include <samples> if real waypoints exist, e.g. from imported dive file)
    const waypoints = diveLogData.customWaypoints;
    if (waypoints && waypoints.length > 0) {
      xml += `        <samples>\n`;
      waypoints.forEach((wp) => {
        xml += `          <waypoint>\n`;
        xml += `            <divetime>${Math.round(wp.time)}</divetime>\n`;
        xml += `            <depth>${parseFloat(wp.depth).toFixed(2)}</depth>\n`;
        if (wp.temp !== null && wp.temp !== undefined) {
          xml += `            <temperature>${parseFloat(wp.temp).toFixed(2)}</temperature>\n`;
        }
        xml += `            <switchmix ref="${gasId}"/>\n`;
        if (wp.pressure) {
          xml += `            <tankpressure>${Math.round(wp.pressure)}</tankpressure>\n`;
        }
        xml += `          </waypoint>\n`;
      });
      xml += `        </samples>\n`;
    }

    // Tank Data
    xml += `        <tankdata>\n`;
    xml += `          <link ref="${gasId}"/>\n`;
    const tankVolRaw = parseFloat(diveLogData.tankVolume || 0);
    if (tankVolRaw > 0) {
      xml += `          <tankvolume>${tankVolRaw.toFixed(1)}</tankvolume>\n`;
    }
    xml += `          <tankpressurebegin>${Math.round(startPressureSI)}</tankpressurebegin>\n`;
    xml += `          <tankpressureend>${Math.round(endPressureSI)}</tankpressureend>\n`;
    xml += `        </tankdata>\n`;

    // Information After Dive (Ordered according to strict XSD sequence)
    xml += `        <informationafterdive>\n`;
    if (waterTempSI !== null) {
      xml += `          <lowesttemperature>${waterTempSI.toFixed(2)}</lowesttemperature>\n`;
    }
    xml += `          <greatestdepth>${depthSI.toFixed(2)}</greatestdepth>\n`;
    if (visibilitySI !== null) {
      xml += `          <visibility>${visibilitySI.toFixed(2)}</visibility>\n`;
    }
    xml += `          <notes>\n`;
    xml += `            <para>Summary: ${escapeXml(diveLogData.notes || '')}\n</para>\n`;
    xml += `            <para>Environment:  \n</para>\n`;
    xml += `            <para>Gas:  \n</para>\n`;
    xml += `            <para>Gear:  \n</para>\n`;
    xml += `            <para>Issues:  \n</para>\n`;
    xml += `          </notes>\n`;
    if (durationSec > 0) {
      xml += `          <diveduration>${Math.round(durationSec)}</diveduration>\n`;
    }
    if ((diveLogData.suitType && diveLogData.suitType !== 'none') || leadKg > 0) {
      xml += `          <equipmentused>\n`;
      if (leadKg > 0) {
        xml += `            <leadquantity>${leadKg.toFixed(1)}</leadquantity>\n`;
      }
      if (diveLogData.suitType && diveLogData.suitType !== 'none') {
        xml += `            <link ref="${suitId}"/>\n`;
      }
      xml += `          </equipmentused>\n`;
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
