/* storage.js - file listing, final flush and status messages for the page.
 *
 * Companion to pre.js: options() returns the object passed to
 * initEmscripten; pre.js then attaches storagePersistent and flushStorage
 * to it. Persistence is off when the options contain persist: false, in
 * which case this manager stays silent.
 */

export function createStorageManager({ filesElement, statusElement, displayName }) {
  let game = null;
  let before = {};
  const moduleOptions = {};

  const enabled = () => moduleOptions.persist !== false;
  const root = () => moduleOptions.persistDir || "/data";

  // Display name -> "mtime:size", so a later snapshot can detect changes.
  // displayName() may map a raw file name for display, or return null to
  // leave the file out of the listing.
  const snapshot = () => {
    const snap = {};
    if (!game) return snap;
    try {
      for (const f of game.FS.readdir(root())) {
        if (f === "." || f === "..") continue;
        const name = displayName ? displayName(f) : f;
        if (!name) continue;
        try {
          const st = game.FS.stat(root() + "/" + f);
          snap[name] = st.mtime.getTime() + ":" + st.size;
        } catch (e) {}
      }
    } catch (e) {}
    return snap;
  };

  const render = (snap) => {
    const names = Object.keys(snap).sort();
    filesElement.textContent = names.length
      ? "Stored files: " + names.join(", ")
      : "";
  };

  const report = (fresh) => {
    if (moduleOptions.storagePersistent === false) {
      statusElement.textContent =
        "Browser storage could not be written - files were not kept this session.";
      return;
    }
    statusElement.textContent =
      fresh.length > 0
        ? "Stored (" + fresh.join(", ") + ") — reload the page to continue."
        : "Reload the page to restart.";
  };

  const finish = () => {
    if (!enabled()) return;
    const after = snapshot();
    render(after);
    const fresh = Object.keys(after).filter((n) => before[n] !== after[n]);
    if (moduleOptions.storagePersistent === false) return report(fresh);

    // A full flush also carries deletions. The program has stopped writing,
    // so it is safe here.
    let tries = 0;
    (function persist() {
      moduleOptions.flushStorage().then(handle, handle);
      function handle(err) {
        if (!err) return report(fresh);
        if (++tries < 20) return setTimeout(persist, 1500);
        console.error("utw: could not persist files:", err);
        moduleOptions.storagePersistent = false;
        report(fresh);
      }
    })();
  };

  return {
    // Pass this exact object to initEmscripten: pre.js attaches
    // flushStorage() and storagePersistent to it.
    options(extra) {
      const opts = Object.assign(moduleOptions, extra);
      if (enabled()) moduleOptions.onExit = finish;
      return opts;
    },

    attach(module) {
      game = module;
      if (!enabled()) return;
      before = snapshot();
      render(before);
      if (moduleOptions.storagePersistent === false)
        statusElement.textContent =
          "Warning: browser storage is unavailable - files will not survive a page reload.";
    },

    fail(error) {
      console.error(error);
      statusElement.textContent =
        "Failed to start the program (" + error + "). See the console for details.";
    },
  };
}
