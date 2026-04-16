/**
 * Minimum document resolution required for 1x/2x export.
 */
const MIN_RESOLUTION_FOR_2X = 144;

/**
 * Target resolutions for 1x and 2x export variants.
 */
const TARGET_PPI_2X = 144;
const TARGET_PPI_1X = 72;

/**
 * Main export function that processes all export objects in the document.
 */
async function exportAll() {
    const { app, core } = require('photoshop');
    
    const exportFolder = await getExportFolder();
    console.log("Export folder:", exportFolder.nativePath);
    
    const exportOptions = {
        format: "png",
        quality: 100,
        optimizeColors: false,
        includeICCProfile: true
    };

    const exporters = [];
    const exportObjects = getAllExportObjects(app.activeDocument, new Utilities(app, core));
    console.log("Export objects:", exportObjects);
    
    for(const exportObject of exportObjects) {
        if (exportObject instanceof GroupExportObject) {
            const groupExporter = new Exporter(app, core, exportOptions, exportFolder, {
                commandName: `Exporting ${exportObject.getName()}`
            }).withExportObject(exportObject).withExportFunction(async function(executionContext, exporter) {
                try {
                    let workingDocument = exporter.app.activeDocument;
                    console.log("Group Export object:", exporter.exportObject);

                    const groupFolder = await exporter.exportObject.getExportDirectory();
                    const subGroup = exporter.exportObject.getLayer(workingDocument);
                    console.log("Subgroup:", subGroup);

                    const exportMode = getExportMode();

                    await exporter.utils.hideAllLayers(workingDocument);

                    if (exportMode === "opaque") {
                        const backgroundLayer = exporter.utils.findLayerByName(workingDocument.layers, "Background");
                        if (backgroundLayer) {
                            backgroundLayer.visible = true;
                        }
                    }

                    await exporter.utils.toggleLayerVisibilityRecursivelyUpwards(subGroup, true);
        
                    console.log("Group bounds:", subGroup.bounds);
                    const cropBounds = exporter.exportObject.getBounds(workingDocument);

                    console.log("Created crop bounds:", cropBounds);
                    await workingDocument.crop(cropBounds);

                    const hasMultipleFrames = subGroup.layers.length > 1;
                    console.log("Has multiple frames:", hasMultipleFrames);
                    let subGroupFolder = null;
                    if (hasMultipleFrames) {
                        subGroupFolder = await groupFolder.createFolder(subGroup.name, { overwrite: true });
                    }

                    let index = 0;
                    for (const frame of subGroup.layers) {
                        frame.visible = true;
                        const fileName = hasMultipleFrames ? `${exporter.exportObject.getName()}_${index}${exporter.exportObject.getFileNameSuffix()}` : `${exporter.exportObject.getName()}${exporter.exportObject.getFileNameSuffix()}`;
                        index++;
                        const subGroupProgress = (index - 1.0) / subGroup.layers.length;
                        executionContext.reportProgress({value: subGroupProgress, commandName: `Exporting ${exporter.exportObject.getName()}`});
                        const folderToExport = hasMultipleFrames ? subGroupFolder : groupFolder;
                        const file = await folderToExport.createFile(fileName, { overwrite: true  });
                        await workingDocument.saveAs.png(file, exporter.exportOptions);
                        frame.visible = false;
                    }

                    // Export hitbox mask if it exists
                    if (exporter.exportObject.hasHitboxMask()) {
                        console.log("Exporting hitbox mask for", exporter.exportObject.getName());

                        for (const frame of subGroup.layers) {
                            frame.visible = false;
                        }

                        const hitboxMaskLayer = exporter.exportObject.getHitboxMaskLayer(workingDocument);
                        if (hitboxMaskLayer) {
                            hitboxMaskLayer.visible = true;

                            const currentWidth = workingDocument.width;
                            const currentHeight = workingDocument.height;
                            const newWidth = Math.round(currentWidth / 10);
                            const newHeight = Math.round(currentHeight / 10);

                            console.log(`Resizing hitbox mask from ${currentWidth}x${currentHeight} to ${newWidth}x${newHeight}`);

                            await workingDocument.resizeImage(newWidth, newHeight, 72, "bicubic");

                            const folderToExport = hasMultipleFrames ? subGroupFolder : groupFolder;
                            const maskFileName = exporter.exportObject.getHitboxMaskFileName();
                            const maskFile = await folderToExport.createFile(maskFileName, { overwrite: true });
                            await workingDocument.saveAs.png(maskFile, exporter.exportOptions);

                            console.log("Hitbox mask exported:", maskFileName);
                        }
                    }
                } catch (error) {
                    console.error("Error in modal execution:", error);
                    throw error;
                }
            });

            exporters.push(groupExporter);
        } else if (exportObject instanceof LayerExportObject || exportObject instanceof FirstFrameExportObject) {

            const layerExporter = new Exporter(app, core, exportOptions, exportFolder, {
                commandName: `Exporting ${exportObject.getName()}`,
            }).withExportObject(exportObject).withExportFunction(async function(executionContext, exporter) {
                try {
                    let workingDocument = exporter.app.activeDocument;
                    const layer = exporter.exportObject.getLayer(workingDocument);

                    const exportMode = getExportMode();

                    await exporter.utils.hideAllLayers(workingDocument);

                    if (exportMode === "opaque") {
                        const backgroundLayer = exporter.utils.findLayerByName(workingDocument.layers, "Background");
                        if (backgroundLayer) {
                            backgroundLayer.visible = true;
                        }
                    }

                    await exporter.utils.toggleLayerVisibilityRecursivelyUpwards(layer, true);

                    const cropBounds = exporter.exportObject.getBounds(workingDocument);
                    await workingDocument.crop(cropBounds);
                    const exportFolder = await exporter.exportObject.getExportDirectory();
                    const file = await exportFolder.createFile(exporter.exportObject.getExportFileName(), { overwrite: true });
                    await workingDocument.saveAs.png(file, exporter.exportOptions);
                } catch (error) {
                    console.error("Error in modal execution:", error);
                    throw error;
                }
            });
            
            exporters.push(layerExporter);
        }
        else {
            throw new Error(`Unsupported export object type: ${exportObject}`);
        }
    }

    // Run all exports
    for (const exporter of exporters) {
        await exporter.export();
    }
}

async function exportAll1x2x() {
    const { app, core } = require('photoshop');

    const docResolution = app.activeDocument.resolution;
    if (docResolution < MIN_RESOLUTION_FOR_2X) {
        await app.showAlert(`Document resolution is ${docResolution} PPI. Minimum ${MIN_RESOLUTION_FOR_2X} PPI is required for 1x/2x export.`);
        return;
    }

    const exportFolder = await getExportFolder();
    console.log("Export 1x/2x folder:", exportFolder.nativePath);

    const exportOptions = {
        format: "png",
        quality: 100,
        optimizeColors: false,
        includeICCProfile: true
    };

    const exporters = [];
    const exportObjects = getAllExportObjects(app.activeDocument, new Utilities(app, core));
    console.log("Export 1x/2x objects:", exportObjects);

    for (const exportObject of exportObjects) {
        if (exportObject instanceof GroupExportObject) {
            const groupExporter = new Exporter(app, core, exportOptions, exportFolder, {
                commandName: `Exporting 1x/2x ${exportObject.getName()}`
            }).withExportObject(exportObject).withExportFunction(async function(executionContext, exporter) {
                try {
                    let workingDocument = exporter.app.activeDocument;
                    const nativeResolution = workingDocument.resolution;

                    const groupFolder = await exporter.exportObject.getExportDirectory();
                    const subGroup = exporter.exportObject.getLayer(workingDocument);

                    const exportMode = getExportMode();
                    await exporter.utils.hideAllLayers(workingDocument);

                    if (exportMode === "opaque") {
                        const backgroundLayer = exporter.utils.findLayerByName(workingDocument.layers, "Background");
                        if (backgroundLayer) {
                            backgroundLayer.visible = true;
                        }
                    }

                    await exporter.utils.toggleLayerVisibilityRecursivelyUpwards(subGroup, true);

                    const cropBounds = exporter.exportObject.getBounds(workingDocument);
                    await workingDocument.crop(cropBounds);

                    // Capture native dimensions after crop (before any resize)
                    const nativeWidth = workingDocument.width;
                    const nativeHeight = workingDocument.height;

                    const hasMultipleFrames = subGroup.layers.length > 1;
                    let subGroupFolder = null;
                    if (hasMultipleFrames) {
                        subGroupFolder = await groupFolder.createFolder(subGroup.name, { overwrite: true });
                    }

                    // --- 2x export pass: resize to 144 PPI ---
                    const width2x = Math.round(nativeWidth * TARGET_PPI_2X / nativeResolution);
                    const height2x = Math.round(nativeHeight * TARGET_PPI_2X / nativeResolution);
                    await workingDocument.resizeImage(width2x, height2x, TARGET_PPI_2X, "bicubic");

                    let index = 0;
                    for (const frame of subGroup.layers) {
                        frame.visible = true;
                        const fileName = hasMultipleFrames
                            ? `${exporter.exportObject.getName()}_${index}@2x${exporter.exportObject.getFileNameSuffix()}`
                            : `${exporter.exportObject.getName()}@2x${exporter.exportObject.getFileNameSuffix()}`;
                        index++;
                        const subGroupProgress = (index - 1.0) / subGroup.layers.length * 0.5;
                        executionContext.reportProgress({value: subGroupProgress, commandName: `Exporting 2x ${exporter.exportObject.getName()}`});
                        const folderToExport = hasMultipleFrames ? subGroupFolder : groupFolder;
                        const file = await folderToExport.createFile(fileName, { overwrite: true });
                        await workingDocument.saveAs.png(file, exporter.exportOptions);
                        frame.visible = false;
                    }

                    // --- 1x export pass: resize to 72 PPI (half of 2x) ---
                    const width1x = Math.round(width2x / 2);
                    const height1x = Math.round(height2x / 2);
                    await workingDocument.resizeImage(width1x, height1x, TARGET_PPI_1X, "bicubic");

                    index = 0;
                    for (const frame of subGroup.layers) {
                        frame.visible = true;
                        const fileName = hasMultipleFrames
                            ? `${exporter.exportObject.getName()}_${index}${exporter.exportObject.getFileNameSuffix()}`
                            : `${exporter.exportObject.getName()}${exporter.exportObject.getFileNameSuffix()}`;
                        index++;
                        const subGroupProgress = 0.5 + (index - 1.0) / subGroup.layers.length * 0.5;
                        executionContext.reportProgress({value: subGroupProgress, commandName: `Exporting 1x ${exporter.exportObject.getName()}`});
                        const folderToExport = hasMultipleFrames ? subGroupFolder : groupFolder;
                        const file = await folderToExport.createFile(fileName, { overwrite: true });
                        await workingDocument.saveAs.png(file, exporter.exportOptions);
                        frame.visible = false;
                    }

                    // --- Hitbox mask: 1x only (same as current behavior) ---
                    if (exporter.exportObject.hasHitboxMask()) {
                        console.log("Exporting hitbox mask for", exporter.exportObject.getName());

                        for (const frame of subGroup.layers) {
                            frame.visible = false;
                        }

                        const hitboxMaskLayer = exporter.exportObject.getHitboxMaskLayer(workingDocument);
                        if (hitboxMaskLayer) {
                            hitboxMaskLayer.visible = true;

                            const currentWidth = workingDocument.width;
                            const currentHeight = workingDocument.height;
                            const newWidth = Math.round(currentWidth / 10);
                            const newHeight = Math.round(currentHeight / 10);

                            await workingDocument.resizeImage(newWidth, newHeight, 72, "bicubic");

                            const folderToExport = hasMultipleFrames ? subGroupFolder : groupFolder;
                            const maskFileName = exporter.exportObject.getHitboxMaskFileName();
                            const maskFile = await folderToExport.createFile(maskFileName, { overwrite: true });
                            await workingDocument.saveAs.png(maskFile, exporter.exportOptions);
                        }
                    }
                } catch (error) {
                    console.error("Error in 1x/2x modal execution:", error);
                    throw error;
                }
            });

            exporters.push(groupExporter);
        } else if (exportObject instanceof LayerExportObject || exportObject instanceof FirstFrameExportObject) {

            const layerExporter = new Exporter(app, core, exportOptions, exportFolder, {
                commandName: `Exporting 1x/2x ${exportObject.getName()}`,
            }).withExportObject(exportObject).withExportFunction(async function(executionContext, exporter) {
                try {
                    let workingDocument = exporter.app.activeDocument;
                    const nativeResolution = workingDocument.resolution;
                    const layer = exporter.exportObject.getLayer(workingDocument);

                    const exportMode = getExportMode();
                    await exporter.utils.hideAllLayers(workingDocument);

                    if (exportMode === "opaque") {
                        const backgroundLayer = exporter.utils.findLayerByName(workingDocument.layers, "Background");
                        if (backgroundLayer) {
                            backgroundLayer.visible = true;
                        }
                    }

                    await exporter.utils.toggleLayerVisibilityRecursivelyUpwards(layer, true);

                    const cropBounds = exporter.exportObject.getBounds(workingDocument);
                    await workingDocument.crop(cropBounds);

                    // Capture native dimensions after crop
                    const nativeWidth = workingDocument.width;
                    const nativeHeight = workingDocument.height;
                    const exportFolder = await exporter.exportObject.getExportDirectory();

                    // 2x export
                    const width2x = Math.round(nativeWidth * TARGET_PPI_2X / nativeResolution);
                    const height2x = Math.round(nativeHeight * TARGET_PPI_2X / nativeResolution);
                    await workingDocument.resizeImage(width2x, height2x, TARGET_PPI_2X, "bicubic");

                    executionContext.reportProgress({value: 0.5, commandName: `Exporting 2x ${exporter.exportObject.getName()}`});
                    const file2x = await exportFolder.createFile(exporter.exportObject.getExportFileName2x(), { overwrite: true });
                    await workingDocument.saveAs.png(file2x, exporter.exportOptions);

                    // 1x export
                    const width1x = Math.round(width2x / 2);
                    const height1x = Math.round(height2x / 2);
                    await workingDocument.resizeImage(width1x, height1x, TARGET_PPI_1X, "bicubic");

                    executionContext.reportProgress({value: 1.0, commandName: `Exporting 1x ${exporter.exportObject.getName()}`});
                    const file1x = await exportFolder.createFile(exporter.exportObject.getExportFileName(), { overwrite: true });
                    await workingDocument.saveAs.png(file1x, exporter.exportOptions);
                } catch (error) {
                    console.error("Error in 1x/2x modal execution:", error);
                    throw error;
                }
            });

            exporters.push(layerExporter);
        } else {
            throw new Error(`Unsupported export object type: ${exportObject}`);
        }
    }

    for (const exporter of exporters) {
        await exporter.export();
    }
}

/**
 * Exporter class that handles the export process for a single export object.
 * Manages modal execution context and document duplication for safe exports.
 */
class Exporter {
    constructor(app, core, exportOptions, exportFolder, options = {}) {
        this.app = app;
        this.core = core;
        this.exportOptions = exportOptions;
        this.exportFolder = exportFolder;
        this.utils = new Utilities(app, core);
        
        this.exportFunction = options.exportFunction || null;
        this.commandName = options.commandName || "";
        this.exportObject = options.exportObject || null;
    }
    
    /**
     * Sets the export function to be executed.
     * @param {Function} fn - The export function
     * @returns {Exporter} This exporter instance for chaining
     */
    withExportFunction(fn) {
        this.exportFunction = fn;
        return this;
    }

    /**
     * Sets the export object to be processed.
     * @param {ExportObject} exportObject - The export object
     * @returns {Exporter} This exporter instance for chaining
     */
    withExportObject(exportObject) {
        this.exportObject = exportObject;
        return this;
    }
    
    /**
     * Sets the command name for the export operation.
     * @param {string} name - The command name
     * @returns {Exporter} This exporter instance for chaining
     */
    withCommandName(name) {
        this.commandName = name;
        return this;
    }
    
    /**
     * Executes the export operation.
     * Creates a duplicate document and runs the export function in modal scope.
     */
    async export() {
        if (!this.exportFunction) {
            throw new Error("No export function defined");
        }

        let self = this;
        
        await this.utils.executeModalInDuplicateDocument(
            async (executionContext) => await self.exportFunction(executionContext, self),
            this.commandName
        );
    }
}