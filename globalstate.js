/**
 * Global state management for export settings.
 * Manages export folder path and export mode (transparent/opaque).
 */

let exportFolder = null;

let exportMode = "transparent";

/**
 * Sets the export folder path.
 * @param {Object} folderPath - The folder path object
 */
function setExportFolder(folderPath) {
    exportFolder = folderPath;
}

/**
 * Sets the export mode.
 * @param {string} mode - Export mode: "transparent" or "opaque"
 */
function setExportMode(mode) {
    exportMode = mode;
}

/**
 * Gets the current export mode.
 * @returns {string} The export mode
 */
function getExportMode() {
    return exportMode;
}

/**
 * Gets or creates the export folder.
 * If not set, creates a timestamped folder next to the document.
 * @returns {Object} The export folder
 */
async function getExportFolder() {
    if (!exportFolder) {
        const { app, core } = require('photoshop');
        const fs = require('uxp').storage.localFileSystem;
        
        const activeDocument = app.activeDocument;
        
        const docPath = activeDocument.path;
        const docName = activeDocument.name.replace(/\.[^\.]+$/, '');
        
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        
        const exportFolderName = `${docName}_${timestamp}_export`;
        
        let parentFolder;
        if (docPath) {
            parentFolder = await fs.getFolder(docPath);
        } else {
            parentFolder = await fs.getFolder();
        }

        exportFolder = await parentFolder.createFolder(exportFolderName);
    }
    return exportFolder;
}

/**
 * Clears the export folder path, forcing creation of a new folder on next export.
 */
function clearExportFolder() {
    exportFolder = null;
}