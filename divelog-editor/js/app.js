/*
  Main Web Application Logic for divelog-editor
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
  const { UNITS, CONVERSIONS, STANDARD_GASES } = window.UDDF_SCHEMA;
  const { exportToUddf } = window.UDDF_EXPORTER;
  const { parseUddfXml } = window.UDDF_PARSER;

  // Minimal jQuery-style DOM helpers for succinct element & value access
  const $ = (id) => document.getElementById(id);
  const $val = (id, val) => {
    const el = typeof id === 'string' ? $(id) : id;
    if (!el) return '';
    if (val !== undefined) {
      el.value = val;
      return val;
    }
    return el.value;
  };

  let currentUnit = UNITS.METRIC;
  let activeWaypoints = null; // Store raw profile waypoints from imported files

  document.addEventListener('DOMContentLoaded', () => {
    const form = $('diveForm');
    const unitToggle = $('unitToggle');
    const gasPreset = $('gasPreset');
    const customGasContainer = $('customGasContainer');
    const gasNameInput = $('gasName');
    const gasO2Input = $('gasO2');
    const gasHeInput = $('gasHe');
    const gasValidationWarning = $('gasValidationWarning');
    const xmlOutput = $('xmlOutput');

    const btnExportXml = $('btnExportXml');
    const btnCopyXml = $('btnCopyXml');
    const btnLoadSample = $('btnLoadSample');
    const btnNewDive = $('btnNewDive');
    const fileImport = $('fileImport');
    const statusMsg = $('statusMsg');

    // Initialise DateTime picker to current local time
    function initialiseDateTime() {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      $val('dateTime', now.toISOString().slice(0, 16));
    }
    initialiseDateTime();

    function getFormData() {
      const selectedPreset = $val('gasPreset');
      let gasName = 'Air';
      let gasO2 = 21;
      let gasHe = 0;

      if (selectedPreset === 'custom') {
        gasName = $val('gasName') || 'Custom';
        gasO2 = parseFloat($val('gasO2') || 21);
        gasHe = parseFloat($val('gasHe') || 0);
      } else if (STANDARD_GASES[selectedPreset]) {
        const preset = STANDARD_GASES[selectedPreset];
        gasName = preset.name;
        gasO2 = preset.o2 * 100;
        gasHe = preset.he * 100;
      }

      return {
        diveNumber: $val('diveNumber'),
        dateTime: $val('dateTime'),
        siteName: $val('siteName'),
        maxDepth: $val('maxDepth'),
        duration: $val('duration'),
        gasName,
        gasO2,
        gasHe,
        startPressure: $val('startPressure'),
        endPressure: $val('endPressure'),
        diverFirstName: $val('diverFirstName'),
        diverLastName: $val('diverLastName'),
        buddyName: $val('buddyName'),
        siteLocation: $val('siteLocation'),
        siteCountry: $val('siteCountry'),
        latitude: $val('latitude'),
        longitude: $val('longitude'),
        tankVolume: $val('tankVolume'),
        apparatus: $val('apparatus'),
        suitType: $val('suitType'),
        leadQuantity: $val('leadQuantity'),
        purpose: $val('purpose'),
        airTemp: $val('airTemp'),
        waterTemp: $val('waterTemp'),
        visibility: $val('visibility'),
        notes: $val('notes'),
        customWaypoints: activeWaypoints
      };
    }

    function updateXmlPreview() {
      try {
        const data = getFormData();
        const xml = exportToUddf(data, currentUnit);
        xmlOutput.textContent = xml;
      } catch (err) {
        xmlOutput.textContent = 'Error generating UDDF XML: ' + err.message;
      }
    }

    // Validate custom gas O2 + He <= 100%
    function validateGasMix() {
      if (gasPreset.value === 'custom') {
        const o2 = parseFloat(gasO2Input.value || 0);
        const he = parseFloat(gasHeInput.value || 0);
        if (o2 + he > 100) {
          gasValidationWarning.style.display = 'block';
        } else {
          gasValidationWarning.style.display = 'none';
        }
      } else {
        gasValidationWarning.style.display = 'none';
      }
    }

    function handleUnitChange(newUnit) {
      if (newUnit === currentUnit) return;
      const isTargetImperial = newUnit === UNITS.IMPERIAL;

      const maxDepthVal = $val('maxDepth');
      const startPressureVal = $val('startPressure');
      const endPressureVal = $val('endPressure');
      const tankVolumeVal = $val('tankVolume');
      const leadQuantityVal = $val('leadQuantity');
      const airTempVal = $val('airTemp');
      const waterTempVal = $val('waterTemp');
      const visibilityVal = $val('visibility');

      if (maxDepthVal) {
        const val = parseFloat(maxDepthVal);
        $val('maxDepth', isTargetImperial ? CONVERSIONS.metresToFeet(val).toFixed(1) : CONVERSIONS.feetToMetres(val).toFixed(1));
      }

      if (startPressureVal) {
        const val = parseFloat(startPressureVal);
        $val('startPressure', isTargetImperial ? Math.round(CONVERSIONS.barToPsi(val)) : Math.round(CONVERSIONS.psiToBar(val)));
      }

      if (endPressureVal) {
        const val = parseFloat(endPressureVal);
        $val('endPressure', isTargetImperial ? Math.round(CONVERSIONS.barToPsi(val)) : Math.round(CONVERSIONS.psiToBar(val)));
      }

      if (tankVolumeVal) {
        const val = parseFloat(tankVolumeVal);
        $val('tankVolume', isTargetImperial ? Math.round(CONVERSIONS.litresToCuft(val)) : Math.round(CONVERSIONS.cuftToLitres(val)));
      }

      if (leadQuantityVal) {
        const val = parseFloat(leadQuantityVal);
        $val('leadQuantity', isTargetImperial ? (CONVERSIONS.kgToLbs(val)).toFixed(1) : (CONVERSIONS.lbsToKg(val)).toFixed(1));
      }

      if (airTempVal) {
        const val = parseFloat(airTempVal);
        $val('airTemp', isTargetImperial ? Math.round(CONVERSIONS.celsiusToFahrenheit(val)) : Math.round(CONVERSIONS.fahrenheitToCelsius(val)));
      }

      if (waterTempVal) {
        const val = parseFloat(waterTempVal);
        $val('waterTemp', isTargetImperial ? Math.round(CONVERSIONS.celsiusToFahrenheit(val)) : Math.round(CONVERSIONS.fahrenheitToCelsius(val)));
      }

      if (visibilityVal) {
        const val = parseFloat(visibilityVal);
        $val('visibility', isTargetImperial ? CONVERSIONS.metresToFeet(val).toFixed(1) : CONVERSIONS.feetToMetres(val).toFixed(1));
      }

      currentUnit = newUnit;

      document.querySelectorAll('.unit-depth').forEach(el => el.textContent = isTargetImperial ? '(ft)' : '(m)');
      document.querySelectorAll('.unit-pressure').forEach(el => el.textContent = isTargetImperial ? '(psi)' : '(bar)');
      document.querySelectorAll('.unit-volume').forEach(el => el.textContent = isTargetImperial ? '(cu ft)' : '(L)');
      document.querySelectorAll('.unit-weight').forEach(el => el.textContent = isTargetImperial ? '(lbs)' : '(kg)');
      document.querySelectorAll('.unit-temp').forEach(el => el.textContent = isTargetImperial ? '(°F)' : '(°C)');

      updateXmlPreview();
    }

    gasPreset.addEventListener('change', (e) => {
      if (e.target.value === 'custom') {
        customGasContainer.style.display = 'grid';
      } else {
        customGasContainer.style.display = 'none';
        const preset = STANDARD_GASES[e.target.value];
        if (preset) {
          $val('gasName', preset.name);
          $val('gasO2', preset.o2 * 100);
          $val('gasHe', preset.he * 100);
        }
      }
      validateGasMix();
      updateXmlPreview();
    });

    gasO2Input.addEventListener('input', () => { validateGasMix(); updateXmlPreview(); });
    gasHeInput.addEventListener('input', () => { validateGasMix(); updateXmlPreview(); });

    // Reset Form for New Dive
    function resetFormToNewDive() {
      activeWaypoints = null;
      $val('diveNumber', '1');
      initialiseDateTime();
      $val('siteName', '');
      $val('siteLocation', '');
      $val('siteCountry', '');
      $val('latitude', '');
      $val('longitude', '');

      $val('maxDepth', currentUnit === UNITS.IMPERIAL ? '60.0' : '18.0');
      $val('duration', '45');

      $val('gasPreset', 'air');
      customGasContainer.style.display = 'none';
      validateGasMix();

      $val('startPressure', currentUnit === UNITS.IMPERIAL ? '3000' : '200');
      $val('endPressure', currentUnit === UNITS.IMPERIAL ? '720' : '50');

      $val('diverFirstName', '');
      $val('diverLastName', '');
      $val('buddyName', '');

      $val('tankVolume', currentUnit === UNITS.IMPERIAL ? '80' : '12');
      $val('apparatus', 'open-scuba');
      $val('suitType', 'wetsuit_5mm');
      $val('leadQuantity', currentUnit === UNITS.IMPERIAL ? '13.2' : '6.0');
      $val('purpose', 'sightseeing');

      $val('airTemp', '');
      $val('waterTemp', '');
      $val('visibility', '');
      $val('notes', '');

      updateXmlPreview();
    }

    function loadSampleDive() {
      const isImp = currentUnit === UNITS.IMPERIAL;
      activeWaypoints = null;

      $val('diveNumber', '104');
      $val('siteName', 'Shark & Yolanda Reef');
      $val('siteLocation', 'Ras Mohammed National Park');
      $val('siteCountry', 'Egypt');
      $val('latitude', '27.734500');
      $val('longitude', '34.256100');

      $val('maxDepth', isImp ? '82.0' : '25.0');
      $val('duration', '52');

      $val('gasPreset', 'ean32');
      customGasContainer.style.display = 'none';
      validateGasMix();

      $val('startPressure', isImp ? '3000' : '200');
      $val('endPressure', isImp ? '720' : '50');

      $val('diverFirstName', 'Alex');
      $val('diverLastName', 'Ocean');
      $val('buddyName', 'Sam Diver');

      $val('tankVolume', isImp ? '80' : '12');
      $val('apparatus', 'open-scuba');
      $val('suitType', 'wetsuit_5mm');
      $val('leadQuantity', isImp ? '13.2' : '6.0');
      $val('purpose', 'sightseeing');

      $val('airTemp', isImp ? '86' : '30');
      $val('waterTemp', isImp ? '77' : '25');
      $val('visibility', isImp ? '98.0' : '30.0');

      $val('notes', 'Spectacular drift dive along Yolanda Reef wall. Observed grey reef sharks, giant morays, and anemone fish.');

      updateXmlPreview();
    }

    btnExportXml.addEventListener('click', () => {
      const xml = xmlOutput.textContent;
      const rawDate = $val('dateTime');
      const dateStr = rawDate ? rawDate.substring(0, 10) : new Date().toISOString().substring(0, 10);
      const siteNameRaw = $val('siteName') || 'dive_log';
      const siteNameClean = siteNameRaw.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
      const filename = `${dateStr}_${siteNameClean || 'dive_log'}.uddf`;

      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    btnCopyXml.addEventListener('click', () => {
      navigator.clipboard.writeText(xmlOutput.textContent).then(() => {
        statusMsg.style.display = 'inline';
        setTimeout(() => {
          statusMsg.style.display = 'none';
        }, 2000);
      });
    });

    function processImportedContent(xmlText) {
      const parsedData = parseUddfXml(xmlText, currentUnit);
      activeWaypoints = parsedData.customWaypoints && parsedData.customWaypoints.length > 0 ? parsedData.customWaypoints : null;

      $val('diveNumber', parsedData.diveNumber || '1');
      $val('dateTime', parsedData.dateTime || new Date().toISOString().substring(0, 16));
      $val('siteName', parsedData.siteName || '');
      $val('siteLocation', parsedData.siteLocation || '');
      $val('siteCountry', parsedData.siteCountry || '');
      $val('latitude', parsedData.latitude || '');
      $val('longitude', parsedData.longitude || '');

      $val('diverFirstName', parsedData.diverFirstName || '');
      $val('diverLastName', parsedData.diverLastName || '');
      $val('buddyName', parsedData.buddyName || '');

      $val('maxDepth', parsedData.maxDepth || '0');
      $val('duration', parsedData.duration || '45');
      $val('startPressure', parsedData.startPressure || '200');
      $val('endPressure', parsedData.endPressure || '50');

      $val('tankVolume', parsedData.tankVolume || '12');
      $val('apparatus', parsedData.apparatus || 'open-scuba');
      $val('suitType', parsedData.suitType || 'wetsuit_5mm');
      $val('leadQuantity', parsedData.leadQuantity || '6.0');
      $val('purpose', parsedData.purpose || 'sightseeing');

      $val('airTemp', parsedData.airTemp || '');
      $val('waterTemp', parsedData.waterTemp || '');
      $val('visibility', parsedData.visibility || '');
      $val('notes', parsedData.notes || '');

      if (parsedData.gasO2 === 21 && parsedData.gasHe === 0) {
        $val('gasPreset', 'air');
        customGasContainer.style.display = 'none';
      } else if (parsedData.gasO2 === 32 && parsedData.gasHe === 0) {
        $val('gasPreset', 'ean32');
        customGasContainer.style.display = 'none';
      } else if (parsedData.gasO2 === 36 && parsedData.gasHe === 0) {
        $val('gasPreset', 'ean36');
        customGasContainer.style.display = 'none';
      } else {
        $val('gasPreset', 'custom');
        customGasContainer.style.display = 'grid';
        $val('gasName', parsedData.gasName || 'Custom');
        $val('gasO2', parsedData.gasO2);
        $val('gasHe', parsedData.gasHe);
      }
      validateGasMix();
      updateXmlPreview();
    }

    fileImport.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          processImportedContent(event.target.result);
        } catch (err) {
          alert('Failed to parse UDDF file: ' + err.message);
        }
      };
      reader.readAsText(file);
    });

    // Drag and Drop File Import
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.endsWith('.xml') || file.name.endsWith('.uddf')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            try {
              processImportedContent(event.target.result);
            } catch (err) {
              alert('Failed to parse dropped UDDF file: ' + err.message);
            }
          };
          reader.readAsText(file);
        }
      }
    });

    // Keyboard Shortcuts (Cmd+S / Ctrl+S to Export)
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        btnExportXml.click();
      }
    });

    form.addEventListener('input', updateXmlPreview);
    form.addEventListener('change', updateXmlPreview);

    unitToggle.addEventListener('change', (e) => handleUnitChange(e.target.value));
    btnLoadSample.addEventListener('click', loadSampleDive);
    btnNewDive.addEventListener('click', resetFormToNewDive);

    updateXmlPreview();
  });
})(window);
