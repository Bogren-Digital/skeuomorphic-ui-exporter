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